-- ===== EV 차고 전체 마이그레이션 (0001 + 0002 + 0003) =====
-- Supabase SQL Editor 에 그대로 붙여넣고 Run

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


-- ============================================================
-- EV 차고 — 0002 RLS (Row Level Security)
-- 원칙: "내 family_id 와 같은 행만" 읽기/쓰기.
--       station_notes 공개 메모(family_id is null)는 누구나 읽기, 작성자만 수정.
-- ============================================================

-- ── 헬퍼: 현재 유저의 family_id (RLS 재귀 방지 위해 security definer) ──
create or replace function public.my_family_id()
returns uuid
language sql
stable
security definer set search_path = public
as $$
  select family_id from public.profiles where id = auth.uid();
$$;

-- 헬퍼: 특정 차량이 내 가족 소유인지
create or replace function public.vehicle_in_my_family(v uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.vehicles
    where id = v and family_id = public.my_family_id()
  );
$$;

-- RLS 활성화
alter table public.families       enable row level security;
alter table public.profiles       enable row level security;
alter table public.vehicles       enable row level security;
alter table public.rent_contracts enable row level security;
alter table public.odo_readings   enable row level security;
alter table public.charge_logs    enable row level security;
alter table public.station_notes  enable row level security;
alter table public.favorites      enable row level security;

-- ── families ────────────────────────────────────────────────
-- 본인 가족만 조회. 생성은 RPC(create_family)로 처리하므로 정책 불필요.
create policy families_select on public.families
  for select using (id = public.my_family_id());
create policy families_update on public.families
  for update using (id = public.my_family_id())
  with check (id = public.my_family_id());

-- ── profiles ────────────────────────────────────────────────
-- 본인 + 같은 가족 멤버 조회. 본인 행만 수정/삽입.
create policy profiles_select on public.profiles
  for select using (
    id = auth.uid() or family_id = public.my_family_id()
  );
create policy profiles_insert on public.profiles
  for insert with check (id = auth.uid());
create policy profiles_update on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

-- ── vehicles ────────────────────────────────────────────────
create policy vehicles_select on public.vehicles
  for select using (family_id = public.my_family_id());
create policy vehicles_insert on public.vehicles
  for insert with check (family_id = public.my_family_id());
create policy vehicles_update on public.vehicles
  for update using (family_id = public.my_family_id())
  with check (family_id = public.my_family_id());
create policy vehicles_delete on public.vehicles
  for delete using (family_id = public.my_family_id());

-- ── rent_contracts (차량을 통해 가족 확인) ──────────────────
create policy rent_contracts_all on public.rent_contracts
  for all using (public.vehicle_in_my_family(vehicle_id))
  with check (public.vehicle_in_my_family(vehicle_id));

-- ── odo_readings ────────────────────────────────────────────
create policy odo_readings_all on public.odo_readings
  for all using (public.vehicle_in_my_family(vehicle_id))
  with check (public.vehicle_in_my_family(vehicle_id));

-- ── charge_logs ─────────────────────────────────────────────
create policy charge_logs_all on public.charge_logs
  for all using (public.vehicle_in_my_family(vehicle_id))
  with check (public.vehicle_in_my_family(vehicle_id));

-- ── station_notes (공개 메모 + 가족 메모) ───────────────────
-- 조회: 공개(family_id is null) 이거나 내 가족 메모
create policy station_notes_select on public.station_notes
  for select using (
    family_id is null or family_id = public.my_family_id()
  );
-- 작성: 본인이 작성자이고, 공개 또는 내 가족 메모
create policy station_notes_insert on public.station_notes
  for insert with check (
    created_by = auth.uid()
    and (family_id is null or family_id = public.my_family_id())
  );
-- 수정/삭제: 작성자만
create policy station_notes_update on public.station_notes
  for update using (created_by = auth.uid())
  with check (created_by = auth.uid());
create policy station_notes_delete on public.station_notes
  for delete using (created_by = auth.uid());

-- ── favorites ───────────────────────────────────────────────
create policy favorites_all on public.favorites
  for all using (family_id = public.my_family_id())
  with check (family_id = public.my_family_id());


-- ============================================================
-- EV 차고 — 0003 RPC (가족 생성/합류)
-- 클라이언트에서 supabase.rpc('create_family', ...) 로 호출.
-- security definer 로 RLS 우회하되, 함수 내부에서 본인(auth.uid) 만 갱신.
-- ============================================================

-- 6자리 초대코드 생성 (혼동되는 0/O/1/I 제외)
create or replace function public.gen_invite_code()
returns text
language sql
volatile
as $$
  select string_agg(
    substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
           (floor(random() * 32) + 1)::int, 1), '')
  from generate_series(1, 6);
$$;

-- 가족 만들기 + 현재 유저를 그 가족에 소속시키기
create or replace function public.create_family(p_name text, p_display_name text default null)
returns public.families
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_family public.families;
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다.';
  end if;

  -- 유니크한 초대코드 확보 (충돌 시 재시도)
  loop
    v_code := public.gen_invite_code();
    exit when not exists (select 1 from public.families where invite_code = v_code);
  end loop;

  insert into public.families (name, invite_code)
  values (coalesce(nullif(trim(p_name), ''), '우리 가족'), v_code)
  returning * into v_family;

  update public.profiles
     set family_id = v_family.id,
         display_name = coalesce(nullif(trim(p_display_name), ''), display_name)
   where id = v_uid;

  return v_family;
end;
$$;

-- 초대코드로 가족 합류
create or replace function public.join_family(p_code text, p_display_name text default null)
returns public.families
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_family public.families;
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_family
    from public.families
   where invite_code = upper(trim(p_code));

  if v_family.id is null then
    raise exception '초대코드를 찾을 수 없습니다.';
  end if;

  update public.profiles
     set family_id = v_family.id,
         display_name = coalesce(nullif(trim(p_display_name), ''), display_name)
   where id = v_uid;

  return v_family;
end;
$$;

grant execute on function public.create_family(text, text) to authenticated;
grant execute on function public.join_family(text, text) to authenticated;
