-- Pisahkan POIN (level) dari SALDO (belanja toko). Jalankan di Supabase SQL Editor setelah saldo-ecosystem-migration.sql.
-- Level dihitung dari poin: Level 1 mulai dari 0 poin, naik 1 level setiap 100 poin, berlanjut melewati Level 100.

alter table public.staff_profiles add column if not exists points integer not null default 0;

create table if not exists public.member_point_daily_claims (
  user_id uuid not null references auth.users(id) on delete cascade,
  claim_date date not null,
  points integer not null default 20,
  created_at timestamptz not null default now(),
  primary key (user_id, claim_date)
);
alter table public.member_point_daily_claims enable row level security;
revoke all on public.member_point_daily_claims from anon, authenticated;
grant select on public.member_point_daily_claims to authenticated;
drop policy if exists member_read_own_daily_point_claims on public.member_point_daily_claims;
create policy member_read_own_daily_point_claims on public.member_point_daily_claims for select to authenticated using (user_id = auth.uid());

create table if not exists public.member_point_transactions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null check (amount <> 0),
  points_after integer not null check (points_after >= 0),
  note text not null default '',
  created_at timestamptz not null default now()
);
alter table public.member_point_transactions enable row level security;
revoke all on public.member_point_transactions from anon, authenticated;

create or replace function public.wallet_claim_daily() returns bigint
language plpgsql security definer set search_path=public set row_security=off as $$
declare v_points integer; v_date date := (now() at time zone 'Asia/Jakarta')::date;
begin
  if auth.uid() is null then raise exception 'Login diperlukan'; end if;
  if not exists(select 1 from public.staff_profiles where user_id=auth.uid()) then raise exception 'Profil member tidak ditemukan'; end if;
  insert into public.member_point_daily_claims(user_id,claim_date,points) values(auth.uid(),v_date,20);
  update public.staff_profiles set points=coalesce(points,0)+20 where user_id=auth.uid() returning points into v_points;
  insert into public.member_point_transactions(user_id,amount,points_after,note) values(auth.uid(),20,v_points,'Bonus poin harian');
  return v_points::bigint;
exception when unique_violation then raise exception 'Bonus poin harian sudah diambil';
end; $$;

create or replace function public.wallet_claim_mission(p_mission_id uuid) returns bigint
language plpgsql security definer set search_path=public set row_security=off as $$
declare m public.wallet_missions%rowtype; v_key text; v_points integer;
begin
  if auth.uid() is null then raise exception 'Login diperlukan'; end if;
  select * into m from public.wallet_missions where id=p_mission_id and is_active=true;
  if not found then raise exception 'Misi tidak tersedia'; end if;
  v_key := case m.cadence when 'daily' then to_char(now() at time zone 'Asia/Jakarta','YYYY-MM-DD') when 'weekly' then to_char(date_trunc('week',now() at time zone 'Asia/Jakarta'),'IYYY-IW') else 'once' end;
  insert into public.wallet_mission_claims(mission_id,user_id,period_key,reward) values(m.id,auth.uid(),v_key,m.reward);
  update public.staff_profiles set points=coalesce(points,0)+m.reward::integer where user_id=auth.uid() returning points into v_points;
  if not found then raise exception 'Profil member tidak ditemukan'; end if;
  insert into public.member_point_transactions(user_id,amount,points_after,note) values(auth.uid(),m.reward::integer,v_points,'Poin misi: '||m.title);
  return v_points::bigint;
exception when unique_violation then raise exception 'Misi ini sudah diklaim untuk periode ini';
end; $$;

create or replace function public.wallet_public_purchase_level(p_user_id uuid)
returns table(total_spent bigint, purchase_count bigint, level_no integer, level_name text, next_target bigint, progress_percent integer)
language sql stable security definer set search_path=public set row_security=off as $$
  with stats as (
    select coalesce(p.points,0)::bigint as points,
      coalesce((select sum((-t.amount)::bigint) from public.wallet_transactions t where t.user_id=p_user_id and t.amount<0 and t.note like 'Belanja:%'),0)::bigint as spent,
      coalesce((select count(*) from public.wallet_transactions t where t.user_id=p_user_id and t.amount<0 and t.note like 'Belanja:%'),0)::bigint as purchases
    from public.staff_profiles p where p.user_id=p_user_id
  )
  select s.points, s.purchases, (1 + floor(s.points / 100.0))::integer,
    'Level '||(1 + floor(s.points / 100.0))::integer,
    ((floor(s.points / 100.0)+1)*100)::bigint,
    (s.points % 100)::integer
  from stats s
  where auth.uid() is not null and exists(select 1 from public.staff_profiles p where p.user_id=p_user_id and p.role='member');
$$;

revoke all on function public.wallet_claim_daily() from public,anon;
revoke all on function public.wallet_claim_mission(uuid) from public,anon;
revoke all on function public.wallet_public_purchase_level(uuid) from public,anon;
grant execute on function public.wallet_claim_daily() to authenticated;
grant execute on function public.wallet_claim_mission(uuid) to authenticated;
grant execute on function public.wallet_public_purchase_level(uuid) to authenticated;

-- Read-only daftar bingkai terpasang untuk ditampilkan pada avatar publik.
create or replace function public.public_member_avatar_frames()
returns table(user_id uuid, avatar_frame text)
language sql stable security definer set search_path=public set row_security=off as $$
  select sp.user_id, coalesce(sp.avatar_frame,'')
  from public.staff_profiles sp
  where sp.role='member' and sp.avatar_frame is not null;
$$;
revoke all on function public.public_member_avatar_frames() from public;
grant execute on function public.public_member_avatar_frames() to anon, authenticated;
