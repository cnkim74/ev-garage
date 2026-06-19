-- ============================================================
-- EV 차고 — 0004 충전소 도착 난이도(구조화)
-- 가족 단위로 충전소별 핵심 정보(주차비·충전 중 무료시간·지상/지하 층)를 1건 유지.
-- ============================================================

create table public.station_facts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  station_ext_id text not null,
  parking_fee text check (parking_fee in ('free', 'paid', 'conditional')), -- 무료/유료/조건부
  parking_fee_note text,                       -- 요금·조건 메모 (예: 시간당 1,000원)
  charging_free_minutes integer
    check (charging_free_minutes is null or charging_free_minutes >= 0),    -- 충전 중 무료시간(분)
  floor_type text check (floor_type in ('ground', 'underground')),         -- 지상/지하
  floor_level integer,                          -- 층수 (지상 N층 / 지하 N층)
  extra_note text,                              -- 자유 메모
  updated_by uuid references public.profiles(id),
  updated_at timestamptz default now(),
  unique (family_id, station_ext_id)
);
create index station_facts_station_idx on public.station_facts(station_ext_id);

alter table public.station_facts enable row level security;

create policy station_facts_all on public.station_facts
  for all using (family_id = public.my_family_id())
  with check (family_id = public.my_family_id());
