import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/** 크림 배경 + SafeArea 기본 화면 래퍼 */
export function Screen({
  children,
  scroll = true,
}: {
  children: React.ReactNode;
  scroll?: boolean;
}) {
  return (
    <SafeAreaView className="flex-1 bg-cream" edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-5 pt-2 pb-10"
          keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View className="flex-1 px-5 pt-2">{children}</View>
      )}
    </SafeAreaView>
  );
}
