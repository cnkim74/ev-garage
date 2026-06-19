/** @type {import('tailwindcss').Config} */
// 디자인 토큰은 PROJECT_BRIEF.md §8 (와이어프레임 추출) 기준.
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // 배경/텍스트
        cream: '#f4f1ea', // --bg  크림 (기본 배경)
        ink: '#2b2a27', // --ink  먹 (기본 텍스트)
        // 상태/강조
        terracotta: '#c75b39', // --accent  강조 / 약정 초과
        leaf: '#3f8f5f', // --green   여유 / 사용가능
        amber: '#c8961f', // --amber   주의 / 혼잡
        ocean: '#3a6ea5', // --blue    정보 / 내 위치
        // 보조 톤 (크림 위 카드/구분선)
        sand: '#e9e4d8',
        muted: '#8a857b',
      },
      borderRadius: {
        card: '20px',
        pill: '999px',
      },
      fontFamily: {
        // Pretendard 적용은 expo-font 로딩 후 연결 (Phase 후속)
        sans: ['Pretendard', 'System'],
      },
    },
  },
  plugins: [],
};
