-- Jalankan sekali di Supabase SQL Editor setelah membuat backup.
-- Existing profiles become approved to avoid locking out current members/Owner.
-- New signups are pending until the Owner approves them.

alter table public.staff_profiles
  add column if not exists approval_status text;

update public.staff_profiles
set approval_status = 'approved'
where approval_status is null;

alter table public.staff_profiles
  alter column approval_status set default 'pending';

alter table public.staff_profiles
  alter column approval_status set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'staff_profiles_approval_status_check'
      and conrelid = 'public.staff_profiles'::regclass
  ) then
    alter table public.staff_profiles
      add constraint staff_profiles_approval_status_check
      check (approval_status in ('pending', 'approved', 'rejected'));
  end if;
end $$;

create or replace function public.handle_new_member_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.staff_profiles
    (user_id, display_name, email, role, approval_status)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'Member'), 60),
    new.email,
    'member',
    'pending'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- Trigger is replaced without deleting user data.
drop trigger if exists on_auth_user_created_member_profile on auth.users;
create trigger on_auth_user_created_member_profile
after insert on auth.users
for each row execute function public.handle_new_member_signup();

-- Owner's existing owner-manages-staff-profiles policy permits the approval update.
-- Members can read only their own status; browser code signs out pending/rejected members.
