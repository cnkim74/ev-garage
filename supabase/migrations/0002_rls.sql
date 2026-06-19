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
