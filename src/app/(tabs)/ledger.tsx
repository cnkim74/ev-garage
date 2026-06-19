import { ScreenHeader, Placeholder } from '../../components/Card';
import { Screen } from '../../components/Screen';

export default function Ledger() {
  return (
    <Screen>
      <ScreenHeader title="충전 가계부" subtitle="이번 달 충전비 · kWh · 평균 단가" />
      <Placeholder note="⑤ 충전 가계부 — 월 합계·6개월 막대차트·사업소별·수동 입력 (Phase 3에서 구현)" />
    </Screen>
  );
}
