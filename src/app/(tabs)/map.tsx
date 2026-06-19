import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { Card, ScreenHeader } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { StationMap } from '../../components/StationMap';
import {
  useFavorites,
  useNearbyStations,
  useToggleFavorite,
  type Station,
} from '../../lib/queries';
import { colors } from '../../lib/theme';
import { useAuth } from '../../providers/auth';

interface Region {
  zcode: string;
  name: string;
  lat: number;
  lng: number;
}
// 칩으로 보여줄 주요 지역 (시도코드)
const REGIONS: Region[] = [
  { zcode: '11', name: '서울', lat: 37.5663, lng: 126.9779 },
  { zcode: '41', name: '경기', lat: 37.275, lng: 127.009 },
  { zcode: '28', name: '인천', lat: 37.4563, lng: 126.7052 },
  { zcode: '47', name: '경북·안동', lat: 36.5684, lng: 128.7294 },
  { zcode: '26', name: '부산', lat: 35.1796, lng: 129.0756 },
  { zcode: '30', name: '대전', lat: 36.3504, lng: 127.3845 },
];

// GPS 좌표 → 가장 가까운 시도 추정 (전국 시도 중심좌표). 공공 API zcode 조회용.
const SIDO: Region[] = [
  { zcode: '11', name: '서울', lat: 37.5663, lng: 126.9779 },
  { zcode: '26', name: '부산', lat: 35.1796, lng: 129.0756 },
  { zcode: '27', name: '대구', lat: 35.8714, lng: 128.6014 },
  { zcode: '28', name: '인천', lat: 37.4563, lng: 126.7052 },
  { zcode: '29', name: '광주', lat: 35.1595, lng: 126.8526 },
  { zcode: '30', name: '대전', lat: 36.3504, lng: 127.3845 },
  { zcode: '31', name: '울산', lat: 35.5384, lng: 129.3114 },
  { zcode: '36', name: '세종', lat: 36.48, lng: 127.289 },
  { zcode: '41', name: '경기', lat: 37.4138, lng: 127.5183 },
  { zcode: '42', name: '강원', lat: 37.8228, lng: 128.1555 },
  { zcode: '43', name: '충북', lat: 36.6357, lng: 127.4917 },
  { zcode: '44', name: '충남', lat: 36.6588, lng: 126.6728 },
  { zcode: '45', name: '전북', lat: 35.7175, lng: 127.153 },
  { zcode: '46', name: '전남', lat: 34.8679, lng: 126.991 },
  { zcode: '47', name: '경북', lat: 36.4919, lng: 128.8889 },
  { zcode: '48', name: '경남', lat: 35.4606, lng: 128.2132 },
  { zcode: '50', name: '제주', lat: 33.4996, lng: 126.5312 },
];

function nearestRegion(lat: number, lng: number): Region {
  let best = SIDO[0];
  let bestD = Infinity;
  for (const r of SIDO) {
    const d = (r.lat - lat) ** 2 + (r.lng - lng) ** 2;
    if (d < bestD) {
      bestD = d;
      best = r;
    }
  }
  return best;
}

export default function MapTab() {
  const { profile } = useAuth();
  const familyId = profile?.family_id ?? null;
  const router = useRouter();

  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [region, setRegion] = useState<Region | null>(null); // 선택 시 GPS 대신 사용
  const [freeOnly, setFreeOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  function openStation(s: Station) {
    router.push({
      pathname: '/station/[id]',
      params: {
        id: s.statId,
        nm: s.statNm,
        addr: s.addr ?? '',
        busi: s.busiNm ?? '',
        avail: String(s.available),
        total: String(s.total),
        free: s.parkingFree ? '1' : '0',
        dist: s.distanceKm != null ? s.distanceKm.toFixed(1) : '',
        ft: s.floorType ?? '',
        fn: s.floorNum != null ? String(s.floorNum) : '',
      },
    });
  }

  async function requestGps() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (!region) setRegion(REGIONS[0]); // 거부 시 기본 지역으로 폴백
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setRegion(null);
    } catch {
      if (!region) setRegion(REGIONS[0]);
    }
  }

  useEffect(() => {
    requestGps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const usingGps = !region && !!gps;
  const lat = region ? region.lat : gps?.lat;
  const lng = region ? region.lng : gps?.lng;
  // GPS 사용 시에도 가장 가까운 시도코드를 추정해 공공 API 조회 정확도/속도 확보
  const zcode = region
    ? region.zcode
    : gps
      ? nearestRegion(gps.lat, gps.lng).zcode
      : undefined;
  const ready = lat != null && lng != null;

  const stationsQ = useNearbyStations({ lat, lng, zcode, freeOnly, enabled: ready });
  const favsQ = useFavorites(familyId);
  const toggleFav = useToggleFavorite(familyId);

  return (
    <Screen>
      <ScreenHeader title="충전소" subtitle="내 주변 충전소 · 실시간 사용가능" />

      <View className="mb-2 flex-row flex-wrap gap-2">
        <Pressable
          onPress={() => (gps ? setRegion(null) : requestGps())}
          className={`rounded-pill border px-3 py-1.5 ${
            usingGps ? 'border-ocean bg-ocean/10' : 'border-sand'
          }`}>
          <Text className={usingGps ? 'text-ocean' : 'text-muted'}>📍 내 위치</Text>
        </Pressable>
        {REGIONS.map((r) => {
          const active = region?.zcode === r.zcode;
          return (
            <Pressable
              key={r.zcode}
              onPress={() => setRegion(r)}
              className={`rounded-pill border px-3 py-1.5 ${
                active ? 'border-ocean bg-ocean/10' : 'border-sand'
              }`}>
              <Text className={active ? 'text-ocean' : 'text-muted'}>{r.name}</Text>
            </Pressable>
          );
        })}
      </View>

      <View className="mb-3 flex-row items-center gap-2">
        <Pressable
          onPress={() => setFreeOnly((v) => !v)}
          className={`rounded-pill border px-4 py-2 ${
            freeOnly ? 'border-leaf bg-leaf/10' : 'border-sand'
          }`}>
          <Text className={freeOnly ? 'text-leaf' : 'text-muted'}>주차비 무료만</Text>
        </Pressable>
        <Text className="text-xs text-muted">
          {usingGps ? '내 위치 기준 거리순' : region ? `${region.name} 기준 거리순` : ''}
        </Text>
        <View className="flex-1" />
        <View className="flex-row overflow-hidden rounded-pill border border-sand">
          {(['list', 'map'] as const).map((m) => (
            <Pressable
              key={m}
              onPress={() => setViewMode(m)}
              className={`px-3 py-1.5 ${viewMode === m ? 'bg-ocean/10' : ''}`}>
              <Text className={viewMode === m ? 'text-ocean' : 'text-muted'}>
                {m === 'list' ? '리스트' : '지도'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {!ready ? (
        <View className="flex-row items-center">
          <ActivityIndicator color={colors.terracotta} />
          <Text className="ml-2 text-sm text-muted">위치 확인 중… (또는 위 지역을 선택하세요)</Text>
        </View>
      ) : stationsQ.isLoading ? (
        <View className="flex-row items-center">
          <ActivityIndicator color={colors.terracotta} />
          <Text className="ml-2 text-sm text-muted">충전소 불러오는 중…</Text>
        </View>
      ) : stationsQ.isError ? (
        <Card>
          <Text className="text-sm font-semibold text-ink">충전소를 불러오지 못했어요</Text>
          <Text className="mt-1 text-xs text-muted">
            {(stationsQ.error as Error)?.message}
          </Text>
          <Text className="mt-2 text-xs text-muted">
            공공데이터포털 인증키(charger-stations 함수의 DATA_GO_KR_KEY)가 설정되어야 실제
            충전소가 표시됩니다.
          </Text>
          <View className="mt-3">
            <Button variant="outline" label="다시 시도" onPress={() => stationsQ.refetch()} />
          </View>
        </Card>
      ) : !stationsQ.data?.length ? (
        <Card>
          <Text className="text-sm text-muted">주변에 표시할 충전소가 없어요.</Text>
        </Card>
      ) : viewMode === 'map' ? (
        <StationMap
          stations={stationsQ.data}
          center={{ lat: lat as number, lng: lng as number }}
          onSelect={openStation}
        />
      ) : (
        stationsQ.data.map((s) => (
          <StationRow
            key={s.statId}
            station={s}
            faved={favsQ.data?.has(s.statId) ?? false}
            onToggleFav={() =>
              familyId &&
              toggleFav.mutate({ stationExtId: s.statId, on: !(favsQ.data?.has(s.statId) ?? false) })
            }
            onPress={() => openStation(s)}
          />
        ))
      )}
    </Screen>
  );
}

function StationRow({
  station: s,
  faved,
  onToggleFav,
  onPress,
}: {
  station: Station;
  faved: boolean;
  onToggleFav: () => void;
  onPress: () => void;
}) {
  const availColor = s.available > 0 ? colors.leaf : s.total > 0 ? colors.amber : colors.muted;
  return (
    <Card className="mb-3">
      <View className="flex-row items-start justify-between">
        <Pressable className="flex-1 pr-2" onPress={onPress}>
          <Text className="text-base font-bold text-ink">{s.statNm}</Text>
          <Text className="mt-0.5 text-xs text-muted">
            {s.busiNm ?? '—'}
            {s.distanceKm != null ? ` · ${s.distanceKm.toFixed(1)}km` : ''}
          </Text>
          <View className="mt-2 flex-row items-center gap-2">
            <Text className="text-sm font-semibold" style={{ color: availColor }}>
              사용가능 {s.available}/{s.total}
            </Text>
            {s.parkingFree ? (
              <View className="rounded-pill bg-leaf/10 px-2 py-0.5">
                <Text className="text-[11px] text-leaf">주차무료</Text>
              </View>
            ) : null}
          </View>
        </Pressable>
        <Pressable onPress={onToggleFav} hitSlop={8} className="px-1">
          <Text className="text-xl" style={{ color: faved ? colors.amber : colors.muted }}>
            {faved ? '★' : '☆'}
          </Text>
        </Pressable>
      </View>
    </Card>
  );
}
