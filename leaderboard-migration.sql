-- Grup Pemuda: koin harian chat publik, dibagikan pukul 15.00 WIB.
-- Jalankan sekali di Supabase SQL Editor. Tidak menghapus data lama.

alter table public.staff_profiles
  add column if not exists points integer not null default 0 check (points >= 0),
  add column if not exists tier text not null default 'Warrior';

create table if not exists public.daily_chat_coins (
  user_id uuid primary key references public.staff_profiles(user_id) on delete cascade,
  pending_coins integer not null default 0 check (pending_coins >= 0),
  pending_messages integer not null default 0 check (pending_messages >= 0),
  updated_at timestamptz not null default now()
);
create table if not exists public.daily_coin_payouts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.staff_profiles(user_id) on delete cascade,
  payout_date date not null,
  coins integer not null,
  messages integer not null,
  created_at timestamptz not null default now(),
  unique(user_id, payout_date)
);

create or replace function public.leaderboard_tier_for_points(p_points integer)
returns text language sql immutable set search_path = public as $$
  select case when greatest(coalesce(p_points,0),0)>=1500 then 'Mythical Immortal'
  when greatest(coalesce(p_points,0),0)>=1000 then 'Mythical Glory'
  when greatest(coalesce(p_points,0),0)>=750 then 'Mythical Honor'
  when greatest(coalesce(p_points,0),0)>=500 then 'Mythic'
  when greatest(coalesce(p_points,0),0)>=400 then 'Legend'
  when greatest(coalesce(p_points,0),0)>=300 then 'Epic'
  when greatest(coalesce(p_points,0),0)>=200 then 'Grand Master'
  when greatest(coalesce(p_points,0),0)>=100 then 'Master'
  when greatest(coalesce(p_points,0),0)>=50 then 'Elite' else 'Warrior' end;
$$;
create or replace function public.sync_staff_tier()
returns trigger language plpgsql security definer set search_path=public as $$
begin new.points:=greatest(coalesce(new.points,0),0); new.tier:=public.leaderboard_tier_for_points(new.points); return new; end; $$;
drop trigger if exists staff_profiles_sync_tier on public.staff_profiles;
create trigger staff_profiles_sync_tier before insert or update of points on public.staff_profiles for each row execute function public.sync_staff_tier();

-- Pesan publik menambah penampungan koin, bukan total leaderboard secara langsung.
create or replace function public.collect_daily_chat_coins()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.daily_chat_coins(user_id,pending_coins,pending_messages,updated_at)
  values(new.sender_id,50,1,now())
  on conflict(user_id) do update set pending_coins=public.daily_chat_coins.pending_coins+50,
    pending_messages=public.daily_chat_coins.pending_messages+1, updated_at=now();
  return new;
end; $$;
drop trigger if exists public_chat_collect_daily_coins on public.public_chat_messages;
create trigger public_chat_collect_daily_coins after insert on public.public_chat_messages for each row execute function public.collect_daily_chat_coins();

-- Aman dipanggil ulang: unique(user_id,payout_date) mencegah pembayaran ganda.
-- Mengambil koin yang sudah terkumpul lalu mengosongkan penampungan.
create or replace function public.distribute_daily_chat_coins()
returns integer language plpgsql security definer set search_path=public as $$
declare r record; payout_day date; processed integer:=0;
begin
  payout_day := (now() at time zone 'Asia/Jakarta')::date;
  for r in select user_id,pending_coins,pending_messages from public.daily_chat_coins where pending_coins>0 for update loop
    insert into public.daily_coin_payouts(user_id,payout_date,coins,messages)
    values(r.user_id,payout_day,r.pending_coins,r.pending_messages)
    on conflict(user_id,payout_date) do nothing;
    if found then
      update public.staff_profiles set points=points+r.pending_coins where user_id=r.user_id;
      update public.daily_chat_coins set pending_coins=0,pending_messages=0,updated_at=now() where user_id=r.user_id;
      processed:=processed+1;
    end if;
  end loop;
  return processed;
end; $$;

-- Scheduler: pg_cron dijalankan pada UTC. 08:00 UTC = 15:00 WIB.
-- Bila pg_cron tersedia, jadwalkan otomatis; jika extension/permission tidak tersedia,
-- jalankan select public.distribute_daily_chat_coins(); via Supabase Cron/pg_cron.
do $$ begin
  create extension if not exists pg_cron;
  if not exists(select 1 from cron.job where jobname='grup-pemuda-daily-coins-1500-wib') then
    perform cron.schedule('grup-pemuda-daily-coins-1500-wib','0 8 * * *','select public.distribute_daily_chat_coins();');
  end if;
exception when others then
  raise notice 'pg_cron belum bisa dijadwalkan otomatis. Aktifkan pg_cron di Supabase atau gunakan SQL Editor/Cron untuk menjalankan public.distribute_daily_chat_coins() setiap pukul 15.00 WIB. Detail: %', sqlerrm;
end $$;

create or replace view public.leaderboard_public as
select p.user_id,p.display_name,p.role,p.points,p.tier,p.avatar_url,
       coalesce(c.pending_coins,0) as pending_coins,
       coalesce(c.pending_messages,0) as pending_messages
from public.staff_profiles p left join public.daily_chat_coins c on c.user_id=p.user_id
where coalesce(p.approval_status,'approved')='approved';
revoke all on public.leaderboard_public from anon,public;
grant select on public.leaderboard_public to authenticated;
revoke all on public.daily_chat_coins from anon,public,authenticated;
revoke all on public.daily_coin_payouts from anon,public,authenticated;
