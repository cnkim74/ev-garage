import { useLocalSearchParams } from 'expo-router';

import { Card, ScreenHeader, Placeholder } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { Text } from 'react-native';

export default function StationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Screen>
      <ScreenHeader title="충전소 상세" subtitle={`station_ext_id: ${id ?? '—'}`} />
      <Card className="mb-4">
        <Text className="text-sm text-muted">
          실시간 사용가능 대수 · 도착 난이도 카드(주차비/회차/지하층/진입 팁) · 유저 사진 메모.
        </Text>
      </Card>
      <Placeholder note="④ 충전소 상세 — 도착 난이도 위키 (Phase 4에서 구현)" />
    </Screen>
  );
}
