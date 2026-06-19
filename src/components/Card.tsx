import { View, Text } from 'react-native';

/** 크림 배경 위 카드 */
export function Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <View
      className={`rounded-card border border-sand bg-white/60 p-5 ${className}`}>
      {children}
    </View>
  );
}

/** 화면 상단 타이틀 + 부제 */
export function ScreenHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View className="mb-4 mt-2">
      <Text className="text-2xl font-bold text-ink">{title}</Text>
      {subtitle ? <Text className="mt-1 text-base text-muted">{subtitle}</Text> : null}
    </View>
  );
}

/** 아직 구현 전 화면용 플레이스홀더 */
export function Placeholder({ note }: { note: string }) {
  return (
    <Card className="items-center py-10">
      <Text className="text-center text-base text-muted">{note}</Text>
    </Card>
  );
}
