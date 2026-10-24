-- Leaderboard manual: Owner memilih tepat 5 atau kurang member, tanpa poin.
-- Jalankan sekali di Supabase SQL Editor. Tidak menghapus data lama.

create table if not exists public.manual_leaderboard (
  rank integer primary key check (rank between 1 and 5),
  user_id uuid not null unique references public.staff_profiles(user_id) on delete cascade,
  note text not null default '' check (char_length(note) <= 120),
  updated_at timestamptz not null default now()
);

create or replace function public.current_user_is_owner()
returns boolean language sql stable security definer
set search_path = public set row_security = off as $$
  select exists (select 1 from public.staff_profiles where user_id = auth.uid() and role = 'owner');
$$;
revoke all on function public.current_user_is_owner() from public;
grant execute on function public.current_user_is_owner() to authenticated;

alter table public.manual_leaderboard enable row level security;
drop policy if exists manual_leaderboard_read_authenticated on public.manual_leaderboard;
drop policy if exists manual_leaderboard_owner_insert on public.manual_leaderboard;
drop policy if exists manual_leaderboard_owner_update on public.manual_leaderboard;
drop policy if exists manual_leaderboard_owner_delete on public.manual_leaderboard;
create policy manual_leaderboard_read_authenticated on public.manual_leaderboard for select to authenticated using (true);
create policy manual_leaderboard_owner_insert on public.manual_leaderboard for insert to authenticated with check (public.current_user_is_owner());
create policy manual_leaderboard_owner_update on public.manual_leaderboard for update to authenticated using (public.current_user_is_owner()) with check (public.current_user_is_owner());
create policy manual_leaderboard_owner_delete on public.manual_leaderboard for delete to authenticated using (public.current_user_is_owner());
 grant select, insert, update, delete on public.manual_leaderboard to authenticated;
