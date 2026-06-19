// 충전소 조회 — read-through 캐시.
// 1) charging_stations 테이블에서 해당 zcode 데이터를 읽는다(빠름).
// 2) 캐시가 없거나 오래되면(>TTL) 공공 API(data.go.kr, 느림)를 1회 호출해 채우고 반환.
// 3) 거리 계산·정렬·필터는 메모리에서 처리.
//
// 배포:  supabase functions deploy charger-stations
// 시크릿: DATA_GO_KR_KEY (공공 API). SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 는 자동 주입.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const BASE = 'http://apis.data.go.kr/B552584/EvCharger/getChargerInfo';
const TTL_MS = 60 * 60 * 1000; // 1시간

interface StationRow {
  stat_id: string;
  stat_nm: string | null;
  addr: string | null;
  lat: number | null;
  lng: number | null;
  busi_nm: string | null;
  parking_free: boolean;
  zcode: string;
  floor_type: string | null;
  floor_num: number | null;
  available: number;
  total: number;
  synced_at?: string;
}

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

async function fetchFromPublic(zcode: string, key: string): Promise<StationRow[]> {
  const rawKey = key.trim();
  const serviceKey = rawKey.includes('%') ? rawKey : encodeURIComponent(rawKey);
  const url = `${BASE}?serviceKey=${serviceKey}&pageNo=1&numOfRows=800&zcode=${zcode}`;
  const resp = await fetch(url);
  const text = await resp.text();
  if (!resp.ok) throw new Error(`공공 API ${resp.status}`);

  const items = [...text.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
  const byStation = new Map<string, StationRow>();
  for (const it of items) {
    const statId = tag(it, 'statId');
    if (!statId) continue;
    const sLat = parseFloat(tag(it, 'lat') ?? '');
    const sLng = parseFloat(tag(it, 'lng') ?? '');
    let s = byStation.get(statId);
    if (!s) {
      s = {
        stat_id: statId,
        stat_nm: tag(it, 'statNm'),
        addr: tag(it, 'addr'),
        lat: Number.isFinite(sLat) ? sLat : null,
        lng: Number.isFinite(sLng) ? sLng : null,
        busi_nm: tag(it, 'busiNm'),
        parking_free: (tag(it, 'parkingFree') ?? '').toUpperCase() === 'Y',
        zcode,
        floor_type: tag(it, 'floorType'),
        floor_num: parseInt(tag(it, 'floorNum') ?? '', 10) || null,
        available: 0,
        total: 0,
      };
      byStation.set(statId, s);
    }
    s.total += 1;
    if (tag(it, 'stat') === '2') s.available += 1;
  }
  return [...byStation.values()];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const { lat, lng, zcode, freeOnly, limit } = await req.json().catch(() => ({}));
    if (typeof lat !== 'number' || typeof lng !== 'number' || !zcode) {
      return json({ error: 'lat, lng(숫자)과 zcode 가 필요합니다.' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1) 캐시 읽기
    const { data: cached } = await supabase
      .from('charging_stations')
      .select('*')
      .eq('zcode', String(zcode));

    let rows: StationRow[] = cached ?? [];
    const fresh =
      rows.length > 0 &&
      rows.some((r) => r.synced_at && new Date(r.synced_at).getTime() > Date.now() - TTL_MS);

    // 2) 없거나 오래되면 공공 API 로 채움
    if (!fresh) {
      const key = Deno.env.get('DATA_GO_KR_KEY');
      if (!key) {
        if (rows.length === 0) return json({ error: 'DATA_GO_KR_KEY 미설정' }, 500);
      } else {
        try {
          const fetched = await fetchFromPublic(String(zcode), key);
          if (fetched.length > 0) {
            const now = new Date().toISOString();
            const withTs = fetched.map((r) => ({ ...r, synced_at: now }));
            await supabase.from('charging_stations').upsert(withTs, { onConflict: 'stat_id' });
            rows = withTs;
          }
        } catch (_e) {
          // 공공 API 실패 시 기존 캐시(있으면)로 폴백
          if (rows.length === 0) return json({ error: '충전소 데이터를 불러오지 못했어요.' }, 502);
        }
      }
    }

    // 3) 거리 계산·필터·정렬
    let stations = rows
      .filter((r) => (freeOnly ? r.parking_free : true))
      .map((r) => ({
        statId: r.stat_id,
        statNm: r.stat_nm ?? '',
        addr: r.addr,
        lat: r.lat,
        lng: r.lng,
        busiNm: r.busi_nm,
        parkingFree: r.parking_free,
        floorType: r.floor_type,
        floorNum: r.floor_num,
        available: r.available ?? 0,
        total: r.total ?? 0,
        distanceKm: r.lat != null && r.lng != null ? haversineKm(lat, lng, r.lat, r.lng) : null,
      }));
    stations.sort((a, b) => (a.distanceKm ?? 9e9) - (b.distanceKm ?? 9e9));
    const take = typeof limit === 'number' && limit > 0 ? limit : 50;

    const syncedAt = rows.length ? rows[0].synced_at ?? null : null;
    return json({ stations: stations.slice(0, take), syncedAt, cached: fresh });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : '알 수 없는 오류' }, 500);
  }
});
