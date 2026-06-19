import { QueryClient } from '@tanstack/react-query';

/**
 * 지하주차장 등 약신호 환경을 고려한 기본 옵션.
 * - 재시도 2회, 지수 백오프
 * - staleTime 30초로 과도한 재요청 방지
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});
