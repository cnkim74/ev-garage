import { View } from 'react-native';

import { colors } from '../lib/theme';
import type { ContractStatus } from '../lib/contract';

const STATUS_COLOR: Record<ContractStatus, string> = {
  green: colors.leaf,
  amber: colors.amber,
  red: colors.terracotta,
};

/** 사용률 가로 막대 게이지 (pct: 0~1+, 1 초과 시 100% 채움 + red 톤은 호출부에서) */
export function Gauge({ pct, status }: { pct: number; status: ContractStatus }) {
  const clamped = Math.max(0, Math.min(pct, 1));
  return (
    <View className="h-6 w-full overflow-hidden rounded-pill bg-sand">
      <View
        className="h-full rounded-pill"
        style={{ width: `${clamped * 100}%`, backgroundColor: STATUS_COLOR[status] }}
      />
    </View>
  );
}
