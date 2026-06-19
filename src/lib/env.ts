/**
 * 환경 변수 접근 단일 창구.
 * EXPO_PUBLIC_* 는 빌드 타임에 인라인되므로 process.env 에서 직접 읽는다.
 */
export const ENV = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  dataGoKrKey: process.env.EXPO_PUBLIC_DATA_GO_KR_KEY ?? '',
  kakaoMapKey: process.env.EXPO_PUBLIC_KAKAO_MAP_KEY ?? '',
};

/** Supabase 설정이 채워졌는지 (미설정 시 안내 화면용) */
export const isSupabaseConfigured =
  ENV.supabaseUrl.startsWith('http') && ENV.supabaseAnonKey.length > 20;
