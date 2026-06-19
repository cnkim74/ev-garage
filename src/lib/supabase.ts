import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { ENV, isSupabaseConfigured } from './env';
import type { Database } from '../types/database';

if (!isSupabaseConfigured) {
  // 앱을 죽이지 않고 경고만 — 설정 안내 화면(onboarding)에서 처리한다.
  console.warn(
    '[supabase] EXPO_PUBLIC_SUPABASE_URL / ANON_KEY 가 비어 있습니다. .env 를 확인하세요.',
  );
}

export const supabase = createClient<Database>(
  ENV.supabaseUrl || 'http://localhost',
  ENV.supabaseAnonKey || 'public-anon-key',
  {
    auth: {
      // 웹에서는 AsyncStorage 대신 localStorage 기본값 사용
      storage: Platform.OS === 'web' ? undefined : AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
