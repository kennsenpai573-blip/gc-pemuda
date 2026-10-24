-- Grup Pemuda友: status online/offline member + view publik tanpa UUID/email.
-- Jalankan sekali di Supabase SQL Editor. Tidak menghapus tabel atau data lama.
create table if not exists public.member_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now()
);

alter table public.member_presence enable row level security;

-- Member hanya boleh memperbarui status dirinya sendiri.
drop policy if exists "member_presence_insert_self" on public.member_presence;
create policy "member_presence_insert_self" on public.member_presence
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "member_presence_update_self" on public.member_presence;
create policy "member_presence_update_self" on public.member_presence
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Status hanya perlu dibaca oleh akun login; view publik di bawah menyembunyikan UUID.
drop policy if exists "member_presence_select_authenticated" on public.member_presence;
create policy "member_presence_select_authenticated" on public.member_presence
  for select to authenticated using (true);

grant select, insert, update on public.member_presence to authenticated;

create or replace view public.public_member_status as
select p.display_name, p.created_at, p.avatar_url,
       coalesce(mp.last_seen_at > now() - interval '2 minutes', false) as is_online
from public.staff_profiles p
left join public.member_presence mp on mp.user_id = p.user_id
where p.role = 'member'
  and coalesce(p.approval_status, 'approved') = 'approved';

grant select on public.public_member_status to anon, authenticated;
