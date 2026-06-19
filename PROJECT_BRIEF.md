# PROJECT_BRIEF.md — EV 부부·가족 차량관리 앱

> 이 문서는 Claude Code에 그대로 물려 개발을 시작하기 위한 명세서입니다.
> "무엇을, 어떤 순서로, 어떻게" 만들지를 한 곳에 정리합니다.

---

## 0. 한 줄 정의

전기차를 쓰는 **부부·가족**이 한 화면에서 **렌트 약정거리 · 충전소 도착 난이도 · 충전 가계부**를 함께 관리하는 **모바일 우선(Expo)** 앱.
충전소 "찾기/결제" 경쟁은 하지 않는다. 메이저 앱이 안 하는 **차량 살림 관리**가 핵심이다.

### 차별화 3가지 (이것만은 반드시 우리가 더 잘한다)
1. **렌트 약정거리 트래커** — 남은 여유 / 일평균 페이스 / 만료 시점 초과 예상 자동 계산
2. **충전소 도착 난이도** — 주차비·셀프/회차시간·지하 몇 층·진입 게이트를 사용자가 사진·메모로 채우는 위키
3. **가족 공유** — 부부가 같은 차량·충전 기록을 실시간으로 함께 본다

---

## 1. 기술 스택

| 영역 | 선택 | 이유 |
|---|---|---|
| 앱 | **Expo (React Native)** + Expo Router | 모바일 우선. iOS/Android 한 코드. 웹 미리보기도 가능 |
| 스타일 | **NativeWind** (Tailwind 문법) | 와이어프레임 톤을 빠르게 옮김 |
| 백엔드 | **Supabase** (Auth + Postgres + Realtime + Storage) | 로그인·DB·실시간 가족 공유·사진 저장 한 번에 |
| 서버 상태 | **TanStack Query** | API 캐싱·재시도, 지하주차장 약신호 대응 |
| 위치/지도 | `expo-location` + **카카오맵**(WebView 또는 react-native-kakao-map) | 한국 충전소 위치 표시 |
| 푸시 | `expo-notifications` | 충전 완료·약정거리 경고 알림 |
| 카메라 | `expo-camera` / `expo-image-picker` | 충전소 현장 사진 |
| 빌드/배포 | **EAS Build / EAS Submit** | 스토어 빌드·서명 자동화 |

> 개발·테스트 단계에서는 **Expo Go** 앱으로 두 사람 실제 폰에 바로 띄워 사용.
> 스토어 제출 시점에만 Apple 개발자 계정(연 $99) / Google Play(1회 $25) 필요.

---

## 2. 데이터 모델 (Supabase / Postgres)

```sql
-- 가족(공유 단위)
create table families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- 사용자 프로필 (auth.users 와 1:1)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  family_id uuid references families(id) on delete set null,
  display_name text,
  created_at timestamptz default now()
);

-- 차량
create table vehicles (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  nickname text not null,                 -- "EV6", "아이오닉5"
  model text,
  ownership_type text not null default 'own',  -- 'own' | 'rent' | 'lease'
  current_odo_km integer not null default 0,    -- 현재 주행거리
  plate text,
  created_at timestamptz default now()
);

-- 렌트/리스 약정 (ownership_type 이 rent/lease 일 때)
create table rent_contracts (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  contract_distance_km integer not null,  -- 약정 한도 (예: 50000)
  start_odo_km integer not null default 0, -- 계약 시작 시 주행거리
  start_date date not null,
  end_date date not null,
  notes text
);

-- 주행거리 기록 (페이스 분석용, 여러 번 찍음)
create table odo_readings (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  odo_km integer not null,
  recorded_at timestamptz default now(),
  recorded_by uuid references profiles(id)
);

-- 충전 기록 (가계부)
create table charge_logs (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  station_ext_id text,        -- 공공API 충전소 ID (선택)
  operator text,              -- 운영기관명
  kwh numeric,
  cost_krw integer,
  charged_at timestamptz default now(),
  recorded_by uuid references profiles(id)
);

-- 충전소 도착 난이도 메모 (위키형, 가족 단위 또는 공개)
create table station_notes (
  id uuid primary key default gen_random_uuid(),
  station_ext_id text not null,
  family_id uuid references families(id),  -- null 이면 공개
  kind text not null,         -- 'parking' | 'access' | 'tip'
  content text,
  photo_path text,            -- Supabase Storage 경로
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- 즐겨찾기 충전소
create table favorites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  station_ext_id text not null,
  unique(family_id, station_ext_id)
);
```

> **RLS(Row Level Security) 필수**: 모든 테이블은 "내 family_id 와 같은 행만" 읽기/쓰기 허용.
> station_notes 의 공개 메모(family_id is null)는 누구나 읽기 가능, 작성자만 수정.
> Claude Code 에 RLS 정책까지 함께 작성하도록 지시할 것.

---

## 3. 약정거리 계산 로직 (핵심 — 정확히 구현)

```ts
// 입력: rent_contracts + 최신 current_odo_km + 오늘 날짜
const used = currentOdoKm - startOdoKm;            // 약정 기간 누적 주행
const remaining = contractDistanceKm - used;        // 남은 여유 (음수면 이미 초과)
const usedPct = used / contractDistanceKm;

const totalDays = daysBetween(startDate, endDate);
const elapsedDays = daysBetween(startDate, today);
const remainingDays = Math.max(daysBetween(today, endDate), 1);

const currentDailyAvg = used / Math.max(elapsedDays, 1);     // 현재 페이스
const safeDailyAvg = remaining / remainingDays;              // 안전 페이스
const projectedEndOdo = currentOdoKm + currentDailyAvg * remainingDays;
const projectedOverage = projectedEndOdo - (startOdoKm + contractDistanceKm);
// projectedOverage > 0 이면 만료 시 초과 예상

// 상태 색
// green: currentDailyAvg <= safeDailyAvg * 0.9
// amber: safeDailyAvg*0.9 < currentDailyAvg <= safeDailyAvg
// red  : currentDailyAvg > safeDailyAvg  (초과 위험)
```

> ⚠️ **법적 안전장치**: 화면에는 위약금 금액을 단정하지 말 것.
> "만료 시 약 +X km 초과 예상 (추정치이며 위약금·정산은 계약서를 확인하세요)" 로만 표시.

---

## 4. 화면 명세 (와이어프레임 기준)

라우팅: Expo Router 파일 기반. 하단 탭 5개.

### 인증/온보딩 (`/(auth)`)
- 이메일/소셜 로그인 (Supabase Auth)
- 첫 로그인 시: 가족 만들기 or 초대코드로 합류 → 차량 1대 등록

### ① 홈 — 차고 (`/(tabs)/index`)
- 가족의 차량 카드 목록. 차량마다 약정거리 여유를 색·게이지로 요약
- "다음 할 일" 카드: 충전 권장, 보험/점검 만료 알림
- 자가 차량(own)은 약정 게이지 대신 주행거리만 표시

### ② 약정거리 트래커 (`/(tabs)/contract`)
- 큰 게이지(사용 %) + 남은 km
- 현재 일평균 vs 안전 일평균
- 만료 시 초과 예상 + 추정 안내문구
- 주행거리 새로 입력 → odo_readings 에 기록 + vehicles.current_odo_km 갱신

### ③ 충전소 지도 (`/(tabs)/map`)
- expo-location 으로 현재 위치
- 카카오맵에 충전소 핀 (사용가능=초록 / 혼잡·1대=노랑 / 만차·고장=빨강)
- 상단 필터칩: 사업소별(환경부/테슬라/EVSIS…), **'주차비 무료만'** 토글
- 하단 리스트: 거리순 + 실시간 사용가능 대수

### ④ 충전소 상세 (`/station/[id]`)
- 실시간 사용가능 대수 + 갱신 시각
- **도착 난이도 카드**: 주차비 / 주차방식·회차시간 / 지하 층·구역 / 진입 팁
- 유저 현장 사진·메모 (station_notes), "+추가" 버튼
- 즐겨찾기 토글

### ⑤ 충전 가계부 (`/(tabs)/ledger`)
- 이번 달 총 충전비 / kWh / 평균 단가
- 최근 6개월 막대 차트
- 사업소별 합계
- 충전 기록 수동 추가 (kWh, 비용, 사업소)

### 설정 (`/(tabs)/settings`)
- 가족원 초대(초대코드), 차량 추가/편집, 알림 설정, 로그아웃

---

## 5. 외부 데이터

### 공공데이터포털 — 한국환경공단 전기자동차 충전소 정보
- URL: https://www.data.go.kr/data/15076352/openapi.do
- 회원가입 → 활용신청 → 인증키 발급 (개발계정 1,000건/일, 운영계정 확장 가능)
- 제공 필드(확인 후 사용): 충전소ID, 충전기ID, 충전소명, 위도(lat), 경도(lng),
  운영기관명(busiNm), 주소(addr), 충전용량, 충전방식, **주차료무료여부(parkingFree)**,
  충전기상태(stat: 충전가능/충전중/고장 등), 상태갱신일시
- 5분 간격 갱신. **파라미터·코드값은 발급 후 공식 문서로 확정할 것.**

> 환경 변수: 인증키는 `.env` 의 `EXPO_PUBLIC_DATA_GO_KR_KEY` 로. 깃에 커밋 금지.
> 카카오맵: `EXPO_PUBLIC_KAKAO_MAP_KEY`.

---

## 6. 만드는 순서 (Phase) — 순서가 전략이다

> 외부 API 승인이 필요 없고, 차별화 핵심이고, 부부가 당장 쓸 것부터.

- **Phase 0 — 골격 (반나절)**
  Expo 앱 스캐폴드 + NativeWind + Supabase 연결 + Expo Go 로 빈 화면 폰에 띄우기
- **Phase 1 — 인증 + 데이터 모델**
  Supabase 테이블 + RLS, 로그인, 가족 만들기/합류, 차량 1대 등록
- **Phase 2 — ② 약정거리 트래커 (먼저 완성)** ⭐
  외부 API 불필요. 계산 로직 + 게이지 화면. 여기서 "쓸 수 있는 앱"을 손에 쥔다
- **Phase 3 — ① 홈 대시보드 + ⑤ 가계부**
  차량 요약·할 일·충전 기록(수동 입력)
- **Phase 4 — ③ 지도 + ④ 상세 (공공 API)**
  인증키 발급 → 충전소 연동 → 도착 난이도 위키
- **Phase 5 — 알림 + EAS 빌드**
  푸시 알림, TestFlight/내부테스트, 이후 스토어 제출

---

## 7. Claude Code 시작 명령어

```bash
# Phase 0
npx create-expo-app@latest ev-garage
cd ev-garage

# 핵심 패키지
npx expo install expo-router expo-location expo-notifications expo-camera expo-image-picker
npm install @supabase/supabase-js @tanstack/react-query
npm install nativewind tailwindcss

# Supabase 클라이언트, NativeWind 설정, Expo Router 구조 잡기
# (Claude Code 에 아래 작업을 순서대로 지시)
```

### Claude Code 에 줄 첫 지시 (예시)
> "이 PROJECT_BRIEF.md 를 읽고 Phase 0 와 Phase 1 을 진행해줘.
> 1) NativeWind 와 Supabase 클라이언트를 설정하고
> 2) `.env.example` 을 만들고
> 3) Supabase 테이블 생성 SQL 과 RLS 정책을 `supabase/migrations` 에 작성하고
> 4) Expo Router 로 (auth) / (tabs) 구조와 5개 탭 빈 화면을 잡아줘.
> 색·폰트는 첨부한 와이어프레임 톤(테라코타 #c75b39, 크림 #f4f1ea)을 따라줘."

---

## 8. 디자인 토큰 (와이어프레임에서 추출)

```
--bg     #f4f1ea  (크림)
--ink    #2b2a27  (먹)
--accent #c75b39  (테라코타 — 강조/초과)
--green  #3f8f5f  (여유/사용가능)
--amber  #c8961f  (주의/혼잡)
--blue   #3a6ea5  (정보/내 위치)
radius   18~22px,  폰트 Pretendard 계열
```

---

## 9. 하지 말 것 (스코프 가드)

- 충전 결제 직접 처리 ❌ (메이저 앱 영역, 결제 PG·사업자 제휴 부담)
- 충전소 DB 자체 구축 ❌ (공공 API 사용)
- 위약금 금액 단정 ❌ (추정·안내만)
- 처음부터 전국 공개 서비스 ❌ (부부 → 지인 EV 유저 → 안동 커뮤니티 순으로 확장)
