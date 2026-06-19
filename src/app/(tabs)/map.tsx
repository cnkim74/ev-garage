import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { Card, ScreenHeader } from '../../components/Card';
import { Screen } from '../../components/Screen';
import {
  useFavorites,
  useNearbyStations,
  useToggleFavorite,
  type Station,
} from '../../lib/queries';
import { colors } from '../../lib/theme';
import { useAuth } from '../../providers/auth';

export default function MapTab() {
  const { profile } = useAuth();
  const familyId = profile?.family_id ?? null;
  const router = useRouter();

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locErr, setLocErr] = useState<string | null>(null);
  const [freeOnly, setFreeOnly] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocErr('위치 권한이 필요해요. 권한을 허용하면 가까운 충전소를 보여드려요.');
          return;
        }
        const pos = await Location.getCurrentPositionAsync({});
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {
        setLocErr('현재 위치를 가져오지 못했어요.');
      }
    })();
  }, []);

  const stationsQ = useNearbyStations({ lat: coords?.lat, lng: coords?.lng, freeOnly });
  const favsQ = useFavorites(familyId);
  const toggleFav = useToggleFavorite(familyId);

  return (
    <Screen>
      <ScreenHeader title="충전소" subtitle="내 주변 충전소 · 실시간 사용가능" />

      <View className="mb-3 flex-row gap-2">
        <Pressable
          onPress={() => setFreeOnly((v) => !v)}
          className={`rounded-pill border px-4 py-2 ${
            freeOnly ? 'border-leaf bg-leaf/10' : 'border-sand'
          }`}>
          <Text className={freeOnly ? 'text-leaf' : 'text-muted'}>주차비 무료만</Text>
        </Pressable>
      </View>

      {locErr ? (
        <Card>
          <Text className="text-sm text-muted">{locErr}</Text>
        </Card>
      ) : !coords ? (
        <View className="flex-row items-center">
          <ActivityIndicator color={colors.terracotta} />
          <Text className="ml-2 text-sm text-muted">현재 위치 확인 중…</Text>
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
            onPress={() =>
              router.push({
                pathname: '/station/[id]',
                params: {
                  id: s.statId,
                  nm: s.statNm,
                  addr: s.addr ?? '',
                  busi: s.busiNm ?? '',
                  avail: String(s.available),
                  total: String(s.total),
                  free: s.parkingFree ? '1' : '',
                  dist: s.distanceKm != null ? s.distanceKm.toFixed(1) : '',
                },
              })
            }
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
