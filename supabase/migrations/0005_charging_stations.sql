-- ============================================================
-- EV 차고 — 0005 충전소 캐시 테이블
-- 공공 API(data.go.kr)가 느려서, charger-stations 함수가 read-through 캐시로 사용.
-- 함수(service_role)만 읽고 쓴다. (RLS 활성화 + 정책 없음 → 일반 사용자 직접 접근 불가)
-- ============================================================

create table public.charging_stations (
  stat_id text primary key,
  stat_nm text,
  addr text,
  lat double precision,
  lng double precision,
  busi_nm text,
  parking_free boolean,
  zcode text,
  floor_type text,        -- 'F'(지상) | 'B'(지하)
  floor_num integer,
  available integer,      -- 충전대기(stat=2) 대수 (동기화 시점 기준)
  total integer,
  synced_at timestamptz default now()
);
create index charging_stations_zcode_idx on public.charging_stations(zcode);

alter table public.charging_stations enable row level security;
-- 정책 없음: service_role(Edge Function)만 접근
