-- Grup Pemuda 友: perbaikan aman daftar member publik dan status online.
-- Jalankan sekali di Supabase SQL Editor. Tidak menghapus data.

create table if not exists public.member_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now()
);

alter table public.member_presence
  add column if not exists last_seen_at timestamptz not null default now();

alter table public.member_presence enable row level security;

drop policy if exists "member_presence_insert_self" on public.member_presence;
create policy "member_presence_insert_self" on public.member_presence
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "member_presence_update_self" on public.member_presence;
create policy "member_presence_update_self" on public.member_presence
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "member_presence_select_authenticated" on public.member_presence;
create policy "member_presence_select_authenticated" on public.member_presence
  for select to authenticated using (true);

grant select, insert, update on public.member_presence to authenticated;

-- PENTING: pertahankan urutan enam kolom lama pada view yang sudah ada.
-- last_seen_at ditambahkan paling akhir agar CREATE OR REPLACE VIEW kompatibel.
create or replace view public.public_member_status as
select
  p.display_name,
  p.created_at,
  p.avatar_url,
  coalesce(mp.last_seen_at > now() - interval '2 minutes', false) as is_online,
  p.user_id,
  p.public_user_id,
  mp.last_seen_at
from public.staff_profiles p
left join public.member_presence mp on mp.user_id = p.user_id
where p.role = 'member'
  and coalesce(p.approval_status, 'approved') = 'approved';

grant select on public.public_member_status to anon, authenticated;

-- Direktori publik ringkas; hanya member yang telah disetujui.
create or replace view public.public_member_directory as
select display_name, created_at, avatar_url
from public.staff_profiles
where role = 'member'
  and coalesce(approval_status, 'approved') = 'approved';

grant select on public.public_member_directory to anon, authenticated;

-- Direktori chat untuk akun login; email tidak dibagikan.
create or replace view public.chat_member_directory as
select user_id, display_name, role, avatar_url, created_at
from public.staff_profiles
where role in ('owner', 'admin')
   or (role = 'member' and coalesce(approval_status, 'approved') = 'approved');
revoke all on public.chat_member_directory from anon, public;
grant select on public.chat_member_directory to authenticated;

notify pgrst, 'reload schema';
