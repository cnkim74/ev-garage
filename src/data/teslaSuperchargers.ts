import type { Station } from '../lib/queries';

// 한국 테슬라 슈퍼차저 (OpenStreetMap, 2026-06 수집 · 39곳)
// 공공(환경부) 데이터에 없는 폐쇄망이라 별도 시드. 실시간 사용가능은 비공개 → stalls(기수)만 표기.
interface TeslaSeed {
  nm: string;
  lat: number;
  lng: number;
  stalls: number; // 충전기 수 (0 = 미상)
}

const SEED: TeslaSeed[] = [
  { nm: '수원 테슬라 슈퍼차저', lat: 37.2636305, lng: 126.9967324, stalls: 4 },
  { nm: '천안 테슬라 슈퍼차저', lat: 36.7552705, lng: 127.2243911, stalls: 6 },
  { nm: '신탄진 테슬라 슈퍼차저', lat: 36.4237104, lng: 127.4199059, stalls: 6 },
  { nm: '화성 테슬라 슈퍼차저', lat: 37.1356178, lng: 126.8957333, stalls: 6 },
  { nm: '동탄 테슬라 슈퍼차저', lat: 37.2008836, lng: 127.0980436, stalls: 3 },
  { nm: '용인-기흥 테슬라 슈퍼차저', lat: 37.2255693, lng: 127.1217404, stalls: 6 },
  { nm: '성남-분당 테슬라 슈퍼차저', lat: 37.3406355, lng: 127.1067004, stalls: 6 },
  { nm: '성남 판교 테슬라 슈퍼차저', lat: 37.4038076, lng: 127.1093709, stalls: 4 },
  { nm: '논산 테슬라 슈퍼차저', lat: 36.1290507, lng: 127.1297441, stalls: 6 },
  { nm: '강릉 테슬라 슈퍼차저', lat: 37.8054462, lng: 128.9045781, stalls: 6 },
  { nm: '충주 테슬라 슈퍼차저', lat: 37.0014551, lng: 127.835807, stalls: 8 },
  { nm: '진천 테슬라 슈퍼차저', lat: 36.9427758, lng: 127.4314816, stalls: 8 },
  { nm: '상주 테슬라 슈퍼차저', lat: 36.5154343, lng: 128.1636235, stalls: 6 },
  { nm: '군산 테슬라 슈퍼차저', lat: 35.9371529, lng: 126.8556611, stalls: 8 },
  { nm: '함양 테슬라 슈퍼차저', lat: 35.5245841, lng: 127.7532126, stalls: 6 },
  { nm: '순천 테슬라 슈퍼차저', lat: 34.9630705, lng: 127.525519, stalls: 8 },
  { nm: '서귀포 테슬라 슈퍼차저', lat: 33.2499901, lng: 126.4090304, stalls: 8 },
  { nm: '진주 테슬라 슈퍼차저', lat: 35.1804732, lng: 128.1400471, stalls: 6 },
  { nm: '원주 테슬라 슈퍼차저', lat: 37.435129, lng: 127.8179739, stalls: 6 },
  { nm: '여주 테슬라 슈퍼차저', lat: 37.240153, lng: 127.6135179, stalls: 8 },
  { nm: '속초 테슬라 슈퍼차저', lat: 38.1803577, lng: 128.6125163, stalls: 4 },
  { nm: '가평 테슬라 슈퍼차저', lat: 37.6865245, lng: 127.4937299, stalls: 6 },
  { nm: '부산 테슬라 슈퍼차저', lat: 35.1604253, lng: 129.1637, stalls: 4 },
  { nm: '부산-연제 테슬라 슈퍼차저', lat: 35.1883882, lng: 129.1099978, stalls: 4 },
  { nm: '부산-남구 테슬라 슈퍼차저', lat: 35.1482466, lng: 129.0654663, stalls: 4 },
  { nm: '부산-강서 테슬라 슈퍼차저', lat: 35.2194115, lng: 128.9884244, stalls: 6 },
  { nm: '대구 테슬라 슈퍼차저', lat: 35.9072313, lng: 128.6129445, stalls: 6 },
  { nm: '대구-이시아폴리스 테슬라 슈퍼차저', lat: 35.9229845, lng: 128.635855, stalls: 6 },
  { nm: '광주 테슬라 슈퍼차저', lat: 35.1472718, lng: 126.838181, stalls: 6 },
  { nm: '의왕 테슬라 슈퍼차저', lat: 37.3758498, lng: 127.0097222, stalls: 3 },
  { nm: '서울-구로 테슬라 슈퍼차저', lat: 37.4798779, lng: 126.895475, stalls: 9 },
  { nm: '서울-여의도 테슬라 슈퍼차저', lat: 37.525621, lng: 126.9258467, stalls: 5 },
  { nm: '서울-서초 테슬라 슈퍼차저', lat: 37.4839973, lng: 127.0173957, stalls: 6 },
  { nm: '서울-테헤란 테슬라 슈퍼차저', lat: 37.5000089, lng: 127.0323086, stalls: 4 },
  { nm: '광명 테슬라 슈퍼차저', lat: 37.4178578, lng: 126.8813937, stalls: 3 },
  { nm: '고양 테슬라 슈퍼차저', lat: 37.6617898, lng: 126.7509379, stalls: 4 },
  { nm: '안양 테슬라 슈퍼차저', lat: 37.3930083, lng: 126.9620854, stalls: 6 },
  { nm: '제주 테슬라 슈퍼차저', lat: 33.492548, lng: 126.5071242, stalls: 8 },
  { nm: '제천 테슬라 슈퍼차저', lat: 37.0719343, lng: 128.1919931, stalls: 0 },
];

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function toStation(seed: TeslaSeed, from?: { lat: number; lng: number }): Station {
  return {
    statId: `tesla:${seed.nm}`,
    statNm: seed.nm,
    addr: null,
    lat: seed.lat,
    lng: seed.lng,
    busiNm: '테슬라 슈퍼차저',
    parkingFree: false,
    available: 0,
    total: seed.stalls,
    distanceKm: from ? haversineKm(from.lat, from.lng, seed.lat, seed.lng) : null,
    isTesla: true,
  };
}

/** 기준 좌표에서 가까운 순으로 정렬된 테슬라 슈퍼차저 목록 */
export function teslaSuperchargersNear(from: { lat: number; lng: number }): Station[] {
  return SEED.map((s) => toStation(s, from)).sort(
    (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity),
  );
}

export const TESLA_COUNT = SEED.length;
