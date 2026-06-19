import { ScreenHeader, Placeholder } from '../../components/Card';
import { Screen } from '../../components/Screen';

export default function MapTab() {
  return (
    <Screen>
      <ScreenHeader title="충전소" subtitle="내 주변 충전소 · 실시간 사용가능" />
      <Placeholder note="③ 충전소 지도 — 카카오맵·핀·필터·거리순 리스트 (Phase 4, 공공 API 연동)" />
    </Screen>
  );
}
