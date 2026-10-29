-- Public-safe leaderboard list for approved members. No view is replaced or dropped.
-- Run once in Supabase SQL Editor. Exposes only public profile/ranking fields.
create or replace function public.list_public_leaderboard()
returns table (
  user_id uuid,
  display_name text,
  role text,
  avatar_url text,
  points integer,
  approval_status text
)
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select p.user_id, p.display_name, p.role::text, p.avatar_url,
         greatest(coalesce(p.points, 0), 0)::integer,
         coalesce(p.approval_status, 'approved')::text
  from public.staff_profiles p
  where p.role = 'member'
    and coalesce(p.approval_status, 'approved') = 'approved'
  order by greatest(coalesce(p.points, 0), 0) desc, p.display_name asc
  limit 100;
$$;

revoke all on function public.list_public_leaderboard() from public;
grant execute on function public.list_public_leaderboard() to anon, authenticated;
notify pgrst, 'reload schema';
