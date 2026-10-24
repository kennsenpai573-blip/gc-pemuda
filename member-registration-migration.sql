-- Jalankan sekali di Supabase SQL Editor setelah backup.
-- Membuat profil role=member otomatis saat akun baru mendaftar lewat Supabase Auth.
create or replace function public.handle_new_member_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.staff_profiles (user_id, display_name, email, role, approval_status)
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

-- Drop/recreate only this trigger, not user data or other triggers.
drop trigger if exists on_auth_user_created_member_profile on auth.users;
create trigger on_auth_user_created_member_profile
after insert on auth.users
for each row execute function public.handle_new_member_signup();

-- Public directory view exposes ONLY display name and join date, never email or UUID.
create or replace view public.public_member_directory as
select display_name, created_at, avatar_url
from public.staff_profiles
where role = 'member';

grant select on public.public_member_directory to anon, authenticated;

-- Keep row-level security enabled. The view is intentionally limited to public fields.
