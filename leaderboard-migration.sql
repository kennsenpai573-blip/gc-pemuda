-- Leaderboard Grup Pemuda: +5 poin per pesan yang berhasil masuk ke chat publik.
-- Pesan pribadi pada tabel member_messages tidak pernah menambah poin.

alter table public.staff_profiles
  add column if not exists points integer not null default 0 check (points >= 0),
  add column if not exists tier text not null default 'Warrior';

create or replace function public.leaderboard_tier_for_points(p_points integer)
returns text language sql immutable set search_path = public
as $$
  select case
    when greatest(coalesce(p_points,0),0) >= 1500 then 'Mythical Immortal'
    when greatest(coalesce(p_points,0),0) >= 1000 then 'Mythical Glory'
    when greatest(coalesce(p_points,0),0) >= 750 then 'Mythical Honor'
    when greatest(coalesce(p_points,0),0) >= 500 then 'Mythic'
    when greatest(coalesce(p_points,0),0) >= 400 then 'Legend'
    when greatest(coalesce(p_points,0),0) >= 300 then 'Epic'
    when greatest(coalesce(p_points,0),0) >= 200 then 'Grand Master'
    when greatest(coalesce(p_points,0),0) >= 100 then 'Master'
    when greatest(coalesce(p_points,0),0) >= 50 then 'Elite'
    else 'Warrior'
  end;
$$;

-- Keep tier synchronized whenever a trusted database operation changes points.
create or replace function public.sync_staff_tier()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  new.points := greatest(coalesce(new.points,0),0);
  new.tier := public.leaderboard_tier_for_points(new.points);
  return new;
end;
$$;
drop trigger if exists staff_profiles_sync_tier on public.staff_profiles;
create trigger staff_profiles_sync_tier
before insert or update of points on public.staff_profiles
for each row execute function public.sync_staff_tier();

-- The award is performed server-side by PostgreSQL after the public message is inserted.
create or replace function public.award_public_chat_points()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  update public.staff_profiles
     set points = points + 5
   where user_id = new.sender_id;
  return new;
end;
$$;
drop trigger if exists public_chat_award_points on public.public_chat_messages;
create trigger public_chat_award_points
after insert on public.public_chat_messages
for each row execute function public.award_public_chat_points();

-- Safe leaderboard projection: only public profile fields, no email or private chat content.
create or replace view public.leaderboard_public as
select user_id, display_name, role, points, tier, avatar_url
from public.staff_profiles
where coalesce(approval_status,'approved') = 'approved';
revoke all on public.leaderboard_public from anon, public;
grant select on public.leaderboard_public to authenticated;

-- Authenticated users may read the public leaderboard; no direct points update policy is added.
