-- User ID publik otomatis 8 digit. Jalankan sekali di Supabase SQL Editor.
-- ID bukan UUID Auth, tidak mengandung email, dan dibuat server-side.
create extension if not exists pgcrypto;
alter table public.staff_profiles add column if not exists public_user_id text;

create or replace function public.generate_public_user_id()
returns text language plpgsql volatile security definer set search_path = '' as $$
declare candidate text;
begin
  loop
    candidate := lpad((floor(random() * 100000000)::bigint)::text, 8, '0');
    if candidate <> '00000000' and not exists (select 1 from public.staff_profiles where public_user_id = candidate) then
      return candidate;
    end if;
  end loop;
end; $$;

-- Backfill member lama yang belum memiliki ID.
do $$ declare r record; new_id text; begin
  for r in select user_id from public.staff_profiles where public_user_id is null or public_user_id !~ '^[0-9]{8}$' loop
    new_id := public.generate_public_user_id();
    update public.staff_profiles set public_user_id = new_id where user_id = r.user_id;
  end loop;
end $$;

create unique index if not exists staff_profiles_public_user_id_uidx on public.staff_profiles(public_user_id);
alter table public.staff_profiles alter column public_user_id set default public.generate_public_user_id();

-- Ensure every newly registered account receives an ID, including if older signup trigger is used.
create or replace function public.ensure_profile_user_id()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.public_user_id is null or new.public_user_id !~ '^[0-9]{8}$' then
    new.public_user_id := public.generate_public_user_id();
  end if;
  return new;
end; $$;
drop trigger if exists staff_profiles_assign_public_user_id on public.staff_profiles;
create trigger staff_profiles_assign_public_user_id before insert or update of public_user_id on public.staff_profiles
for each row execute function public.ensure_profile_user_id();

-- Recreate public views with ID included; keep private fields hidden.
create or replace view public.public_member_directory as
select display_name, created_at, avatar_url, user_id, public_user_id
from public.staff_profiles
where role = 'member' and coalesce(approval_status, 'approved') = 'approved';
grant select on public.public_member_directory to anon, authenticated;

create or replace view public.public_member_status as
select p.display_name, p.created_at, p.avatar_url,
       coalesce(mp.last_seen_at > now() - interval '2 minutes', false) as is_online, p.user_id, p.public_user_id
from public.staff_profiles p left join public.member_presence mp on mp.user_id = p.user_id
where p.role = 'member' and coalesce(p.approval_status, 'approved') = 'approved';
grant select on public.public_member_status to anon, authenticated;

create or replace view public.chat_member_directory as
select user_id, display_name, role, avatar_url, created_at, public_user_id
from public.staff_profiles
where role in ('owner', 'admin') or (role = 'member' and coalesce(approval_status, 'approved') = 'approved');
revoke all on public.chat_member_directory from anon, public;
grant select on public.chat_member_directory to authenticated;
