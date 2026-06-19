// 한국환경공단 전기차 충전소 정보(공공데이터포털 15076352) 프록시.
// serviceKey 는 서버 시크릿(DATA_GO_KR_KEY)으로만 보관하고, 정규화된 JSON 을 돌려준다.
//
// 배포:  supabase functions deploy charger-stations
// 시크릿: supabase secrets set DATA_GO_KR_KEY=발급받은_일반(Decoding)_인증키
//
// 호출(앱): supabase.functions.invoke('charger-stations',
//             { body: { lat, lng, zcode?, freeOnly?, limit? } })
//
// ⚠️ 발급 후 실제 응답으로 파라미터·필드명(stat 코드 등)을 한번 확인해 보정할 것.

import { corsHeaders } from '../_shared/cors.ts';

const BASE = 'http://apis.data.go.kr/B552584/EvCharger/getChargerInfo';

interface Charger {
  chgerId: string;
  type: string | null;
  stat: string | null; // 1통신이상 2충전대기 3충전중 4운영중지 5점검중 9미확인
  statUpdDt: string | null;
}
interface Station {
  statId: string;
  statNm: string;
  addr: string | null;
  lat: number | null;
  lng: number | null;
  busiNm: string | null;
  parkingFree: boolean;
  chargers: Charger[];
  available: number; // 충전대기(2) 대수
  total: number;
  distanceKm: number | null;
}

// <tag>value</tag> 추출 (CDATA 포함)
function tag(block: string, name: string): string | null {
  const m = new RegExp(`<${name}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${name}>`).exec(block);
  return m ? m[1].trim() : null;
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const key = Deno.env.get('DATA_GO_KR_KEY');
    if (!key) return json({ error: 'DATA_GO_KR_KEY 가 설정되지 않았습니다.' }, 500);

    const { lat, lng, zcode, freeOnly, limit, numOfRows } = await req.json().catch(() => ({}));
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return json({ error: 'lat, lng(숫자)이 필요합니다.' }, 400);
    }

    // serviceKey 인코딩 자동 처리:
    // - Encoding 키(이미 %2B 등 포함) → 그대로 사용(이중 인코딩 방지)
    // - Decoding 키(원문) → encodeURIComponent
    const rawKey = key.trim();
    const serviceKey = rawKey.includes('%') ? rawKey : encodeURIComponent(rawKey);
    // 공공 API가 zcode 조회 시 느려서 건수를 제한(기본 250). 클라이언트가 조절 가능.
    const rows = Math.min(Math.max(parseInt(String(numOfRows), 10) || 250, 10), 1000);
    const rest = new URLSearchParams({ pageNo: '1', numOfRows: String(rows) });
    if (zcode) rest.set('zcode', String(zcode)); // 시도코드(2자리). 없으면 전국(느릴 수 있음)

    const resp = await fetch(`${BASE}?serviceKey=${serviceKey}&${rest.toString()}`);
    const text = await resp.text();
    if (!resp.ok) return json({ error: `공공 API 오류 ${resp.status}`, detail: text.slice(0, 300) }, 502);

    // XML <item> 파싱 (charger 단위 행 → station 단위로 그룹)
    const items = [...text.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
    if (items.length === 0) {
      const msg = tag(text, 'resultMsg') ?? tag(text, 'returnAuthMsg');
      return json({ stations: [], note: msg ?? '결과 없음 (zcode/키 확인)' });
    }

    const byStation = new Map<string, Station>();
    for (const it of items) {
      const statId = tag(it, 'statId');
      if (!statId) continue;
      const sLat = parseFloat(tag(it, 'lat') ?? '');
      const sLng = parseFloat(tag(it, 'lng') ?? '');
      let s = byStation.get(statId);
      if (!s) {
        s = {
          statId,
          statNm: tag(it, 'statNm') ?? '',
          addr: tag(it, 'addr'),
          lat: Number.isFinite(sLat) ? sLat : null,
          lng: Number.isFinite(sLng) ? sLng : null,
          busiNm: tag(it, 'busiNm'),
          parkingFree: (tag(it, 'parkingFree') ?? '').toUpperCase() === 'Y',
          chargers: [],
          available: 0,
          total: 0,
          distanceKm: null,
        };
        byStation.set(statId, s);
      }
      const stat = tag(it, 'stat');
      s.chargers.push({
        chgerId: tag(it, 'chgerId') ?? '',
        type: tag(it, 'chgerType'),
        stat,
        statUpdDt: tag(it, 'statUpdDt'),
      });
      s.total += 1;
      if (stat === '2') s.available += 1; // 충전대기 = 사용 가능
    }

    let stations = [...byStation.values()];
    if (freeOnly) stations = stations.filter((s) => s.parkingFree);
    for (const s of stations) {
      s.distanceKm = s.lat != null && s.lng != null ? haversineKm(lat, lng, s.lat, s.lng) : null;
    }
    stations.sort((a, b) => (a.distanceKm ?? 9e9) - (b.distanceKm ?? 9e9));
    const take = typeof limit === 'number' && limit > 0 ? limit : 50;

    return json({ stations: stations.slice(0, take) });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : '알 수 없는 오류' }, 500);
  }
});
