import '../global.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { queryClient } from '../lib/query';
import { colors } from '../lib/theme';
import { AuthProvider, useAuth } from '../providers/auth';

/** 로그인/가족 보유 상태에 따라 라우트 그룹을 강제 이동 */
function useAuthRedirect() {
  const { loading, session, hasFamily, configured } = useAuth();
  const segments = useSegments() as string[];
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const onOnboarding = segments[1] === 'onboarding';

    // 미설정 또는 미로그인 → 로그인 화면
    if (!configured || !session) {
      if (!inAuthGroup) router.replace('/(auth)/sign-in');
      return;
    }

    // 로그인했지만 가족 없음 → 온보딩
    if (!hasFamily) {
      if (!onOnboarding) router.replace('/(auth)/onboarding');
      return;
    }

    // 정상 → 탭으로
    if (inAuthGroup) router.replace('/(tabs)');
  }, [loading, session, hasFamily, configured, segments, router]);
}

function RootNavigator() {
  const { loading } = useAuth();
  useAuthRedirect();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-cream">
        <ActivityIndicator color={colors.terracotta} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.cream } }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="station/[id]"
        options={{ presentation: 'card', headerShown: true, title: '충전소', headerTintColor: colors.ink }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <StatusBar style="dark" />
            <RootNavigator />
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
