import { ScreenHeader, Placeholder } from '../../components/Card';
import { Screen } from '../../components/Screen';

export default function Home() {
  return (
    <Screen>
      <ScreenHeader title="우리 차고" subtitle="가족 차량 한눈에 보기" />
      <Placeholder note="① 홈 대시보드 — 차량 카드·약정 게이지·다음 할 일 (Phase 3에서 구현)" />
    </Screen>
  );
}
