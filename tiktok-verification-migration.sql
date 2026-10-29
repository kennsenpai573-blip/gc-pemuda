-- TikTok verification: internal badge, not TikTok's official verification
create table if not exists public.tiktok_verifications (
  user_id uuid primary key references public.staff_profiles(user_id) on delete cascade,
  username text not null check (char_length(username) between 2 and 40),
  profile_url text not null,
  status text not null default 'pending' check (status in ('pending','verified','rejected')),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.tiktok_verifications enable row level security;
drop policy if exists "TikTok verification public read verified" on public.tiktok_verifications;
create policy "TikTok verification public read verified" on public.tiktok_verifications for select to anon, authenticated using (status = 'verified' or auth.uid() = user_id or public.current_user_is_owner());
drop policy if exists "TikTok member submit own" on public.tiktok_verifications;
create policy "TikTok member submit own" on public.tiktok_verifications for insert to authenticated with check (auth.uid() = user_id and status = 'pending');
drop policy if exists "TikTok member update own pending" on public.tiktok_verifications;
create policy "TikTok member update own pending" on public.tiktok_verifications for update to authenticated using (auth.uid() = user_id and status <> 'verified') with check (auth.uid() = user_id and status = 'pending');
drop policy if exists "TikTok owner manage verification" on public.tiktok_verifications;
create policy "TikTok owner manage verification" on public.tiktok_verifications for all to authenticated using (public.current_user_is_owner()) with check (public.current_user_is_owner());
grant select, insert, update on public.tiktok_verifications to authenticated;
grant select on public.tiktok_verifications to anon;

-- Expose member UUID as the last view column so public profile cards can look up verified TikTok links.
create or replace view public.public_member_status as
select p.display_name, p.created_at, p.avatar_url,
       coalesce(mp.last_seen_at > now() - interval '2 minutes', false) as is_online,
       p.user_id
from public.staff_profiles p
left join public.member_presence mp on mp.user_id = p.user_id
where p.role = 'member'
  and coalesce(p.approval_status, 'approved') = 'approved';
grant select on public.public_member_status to anon, authenticated;
