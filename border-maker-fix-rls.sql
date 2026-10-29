-- FIX RLS Pembuat Border — Grup Pemuda
-- Jalankan di Supabase > SQL Editor menggunakan akun project owner.
-- Kebijakan ini tidak memberi hak mengelola border kepada semua member.

-- 1) Hak akses tabel (RLS tetap menjadi pengaman utama)
grant select on table public.custom_avatar_borders to anon, authenticated;
grant insert, update, delete on table public.custom_avatar_borders to authenticated;

alter table public.custom_avatar_borders enable row level security;

drop policy if exists "Public can read active custom borders" on public.custom_avatar_borders;
drop policy if exists "Owner manages custom borders" on public.custom_avatar_borders;
drop policy if exists "Active borders readable by everyone" on public.custom_avatar_borders;
drop policy if exists "Owner can manage custom borders" on public.custom_avatar_borders;

create policy "Active borders readable by everyone"
on public.custom_avatar_borders
for select to anon, authenticated
using (
  is_active = true
  or exists (
    select 1 from public.staff_profiles p
    where p.user_id = (select auth.uid())
      and lower(coalesce(p.role, '')) = 'owner'
  )
);

create policy "Owner can manage custom borders"
on public.custom_avatar_borders
for all to authenticated
using (
  exists (
    select 1 from public.staff_profiles p
    where p.user_id = (select auth.uid())
      and lower(coalesce(p.role, '')) = 'owner'
  )
)
with check (
  exists (
    select 1 from public.staff_profiles p
    where p.user_id = (select auth.uid())
      and lower(coalesce(p.role, '')) = 'owner'
  )
);

-- 2) Storage policies untuk bucket community-media.
-- File border disimpan di folder "custom-borders/".
-- Pastikan bucket community-media sudah dibuat di Storage.
-- Jangan jadikan seluruh bucket publik hanya untuk memperbaiki izin upload.

drop policy if exists "Owner uploads custom borders" on storage.objects;
drop policy if exists "Owner updates custom borders" on storage.objects;
drop policy if exists "Owner deletes custom borders" on storage.objects;
drop policy if exists "Public reads custom border assets" on storage.objects;

create policy "Owner uploads custom borders"
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'community-media'
  and (storage.foldername(name))[1] = 'custom-borders'
  and exists (
    select 1 from public.staff_profiles p
    where p.user_id = (select auth.uid())
      and lower(coalesce(p.role, '')) = 'owner'
  )
);

create policy "Owner updates custom borders"
on storage.objects
for update to authenticated
using (
  bucket_id = 'community-media'
  and (storage.foldername(name))[1] = 'custom-borders'
  and exists (
    select 1 from public.staff_profiles p
    where p.user_id = (select auth.uid())
      and lower(coalesce(p.role, '')) = 'owner'
  )
)
with check (
  bucket_id = 'community-media'
  and (storage.foldername(name))[1] = 'custom-borders'
  and exists (
    select 1 from public.staff_profiles p
    where p.user_id = (select auth.uid())
      and lower(coalesce(p.role, '')) = 'owner'
  )
);

create policy "Owner deletes custom borders"
on storage.objects
for delete to authenticated
using (
  bucket_id = 'community-media'
  and (storage.foldername(name))[1] = 'custom-borders'
  and exists (
    select 1 from public.staff_profiles p
    where p.user_id = (select auth.uid())
      and lower(coalesce(p.role, '')) = 'owner'
  )
);

-- Kalau URL gambar dibuat dengan getPublicUrl(), objek harus dapat dibaca publik.
-- Policy SELECT ini hanya untuk folder custom-borders, bukan seluruh bucket.
create policy "Public reads custom border assets"
on storage.objects
for select to anon, authenticated
using (
  bucket_id = 'community-media'
  and (storage.foldername(name))[1] = 'custom-borders'
);

-- 3) Verifikasi identitas Owner. Query ini harus mengembalikan baris akun Owner
-- setelah login menggunakan akun yang dipakai membuka admin.html.
select user_id, role
from public.staff_profiles
where user_id = auth.uid();
