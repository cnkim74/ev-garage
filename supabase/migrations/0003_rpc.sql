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
