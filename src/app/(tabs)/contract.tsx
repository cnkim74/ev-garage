import { ScreenHeader, Placeholder } from '../../components/Card';
import { Screen } from '../../components/Screen';

export default function Contract() {
  return (
    <Screen>
      <ScreenHeader title="약정거리" subtitle="남은 여유 · 일평균 페이스 · 만료 예상" />
      <Placeholder note="② 약정거리 트래커 — 게이지·페이스·초과 예상 (Phase 2에서 먼저 구현)" />
    </Screen>
  );
}
