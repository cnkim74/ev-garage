-- ============================================================
-- EV 차고 — 0001 초기 스키마
-- PROJECT_BRIEF.md §2 데이터 모델 + 초대코드/트리거 보강
-- ============================================================

create extension if not exists pgcrypto;

-- ── 가족(공유 단위) ─────────────────────────────────────────
create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,           -- 가족 합류용 6자리 코드
  created_at timestamptz default now()
);

-- ── 사용자 프로필 (auth.users 와 1:1) ───────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  family_id uuid references public.families(id) on delete set null,
  display_name text,
  created_at timestamptz default now()
);
create index profiles_family_id_idx on public.profiles(family_id);

-- ── 차량 ────────────────────────────────────────────────────
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  nickname text not null,                       -- "EV6", "아이오닉5"
  model text,
  ownership_type text not null default 'own'
    check (ownership_type in ('own', 'rent', 'lease')),
  current_odo_km integer not null default 0,    -- 현재 주행거리
  plate text,
  created_at timestamptz default now()
);
create index vehicles_family_id_idx on public.vehicles(family_id);

-- ── 렌트/리스 약정 (ownership_type 이 rent/lease 일 때) ──────
create table public.rent_contracts (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  contract_distance_km integer not null check (contract_distance_km > 0),
  start_odo_km integer not null default 0,
  start_date date not null,
  end_date date not null,
  notes text,
  check (end_date >= start_date)
);
create index rent_contracts_vehicle_id_idx on public.rent_contracts(vehicle_id);

-- ── 주행거리 기록 (페이스 분석용) ───────────────────────────
create table public.odo_readings (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  odo_km integer not null check (odo_km >= 0),
  recorded_at timestamptz default now(),
  recorded_by uuid references public.profiles(id)
);
create index odo_readings_vehicle_id_idx on public.odo_readings(vehicle_id, recorded_at desc);

-- ── 충전 기록 (가계부) ──────────────────────────────────────
create table public.charge_logs (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  station_ext_id text,         -- 공공API 충전소 ID (선택)
  operator text,               -- 운영기관명
  kwh numeric check (kwh is null or kwh >= 0),
  cost_krw integer check (cost_krw is null or cost_krw >= 0),
  charged_at timestamptz default now(),
  recorded_by uuid references public.profiles(id)
);
create index charge_logs_vehicle_id_idx on public.charge_logs(vehicle_id, charged_at desc);

-- ── 충전소 도착 난이도 메모 (위키형) ────────────────────────
create table public.station_notes (
  id uuid primary key default gen_random_uuid(),
  station_ext_id text not null,
  family_id uuid references public.families(id) on delete cascade, -- null 이면 공개
  kind text not null check (kind in ('parking', 'access', 'tip')),
  content text,
  photo_path text,             -- Supabase Storage 경로
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);
create index station_notes_station_idx on public.station_notes(station_ext_id);

-- ── 즐겨찾기 충전소 ─────────────────────────────────────────
create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  station_ext_id text not null,
  created_at timestamptz default now(),
  unique (family_id, station_ext_id)
);

-- ============================================================
-- 트리거 / 함수
-- ============================================================

-- 새 auth 유저 가입 시 profiles 행 자동 생성
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 주행거리 기록 추가 시 vehicles.current_odo_km 를 최신(최대)값으로 갱신
create or replace function public.bump_vehicle_odo()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.vehicles
     set current_odo_km = greatest(current_odo_km, new.odo_km)
   where id = new.vehicle_id;
  return new;
end;
$$;

drop trigger if exists on_odo_reading_insert on public.odo_readings;
create trigger on_odo_reading_insert
  after insert on public.odo_readings
  for each row execute function public.bump_vehicle_odo();
