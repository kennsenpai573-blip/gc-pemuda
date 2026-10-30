-- FIX PEMBUAT BORDER — Grup Pemuda
-- Jalankan sekali di Supabase > SQL Editor menggunakan akun project owner.
-- Kebijakan ini hanya memberi pengelolaan kepada akun yang role-nya owner.

-- 1. Pastikan tabel tersedia. Jika tabel sudah ada, jangan menghapus datanya.
create table if not exists public.custom_avatar_borders (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  price integer not null default 1000 check (price >= 0),
  image_url text not null,
  storage_path text,
  shop_item_id uuid references public.wallet_shop_items(id) on delete set null,
  animation text not null default 'pulse',
  glow_color text not null default '#b65cff',
  glow_width integer not null default 6 check (glow_width between 0 and 20),
  glow_brightness integer not null default 70 check (glow_brightness between 0 and 150),
  glow_speed integer not null default 50 check (glow_speed between 0 and 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.custom_avatar_borders add column if not exists storage_path text;
alter table public.custom_avatar_borders add column if not exists shop_item_id uuid references public.wallet_shop_items(id) on delete set null;
alter table public.custom_avatar_borders add column if not exists animation text not null default 'pulse';
alter table public.custom_avatar_borders add column if not exists glow_color text not null default '#b65cff';
alter table public.custom_avatar_borders add column if not exists glow_width integer not null default 6;
alter table public.custom_avatar_borders add column if not exists glow_brightness integer not null default 70;
alter table public.custom_avatar_borders add column if not exists glow_speed integer not null default 50;
alter table public.custom_avatar_borders add column if not exists is_active boolean not null default true;
alter table public.custom_avatar_borders add column if not exists updated_at timestamptz not null default now();

-- Table privileges: RLS below still restricts changes to Owner.
grant usage on schema public to anon, authenticated;
grant select on public.custom_avatar_borders to anon, authenticated;
grant insert, update, delete on public.custom_avatar_borders to authenticated;
alter table public.custom_avatar_borders enable row level security;

drop policy if exists "Public can read active custom borders" on public.custom_avatar_borders;
drop policy if exists "Owner manages custom borders" on public.custom_avatar_borders;
drop policy if exists "Active borders readable by everyone" on public.custom_avatar_borders;
drop policy if exists "Owner can manage custom borders" on public.custom_avatar_borders;

create policy "Active borders readable by everyone"
on public.custom_avatar_borders for select to anon, authenticated
using (
  is_active = true OR EXISTS (
    select 1 from public.staff_profiles p
    where p.user_id = (select auth.uid())
      and lower(trim(coalesce(p.role, ''))) = 'owner'
  )
);

create policy "Owner can manage custom borders"
on public.custom_avatar_borders for all to authenticated
using (EXISTS (
  select 1 from public.staff_profiles p
  where p.user_id = (select auth.uid())
    and lower(trim(coalesce(p.role, ''))) = 'owner'
))
with check (EXISTS (
  select 1 from public.staff_profiles p
  where p.user_id = (select auth.uid())
    and lower(trim(coalesce(p.role, ''))) = 'owner'
));

-- 2. Bucket community-media harus sudah ada di Supabase Storage.
-- Beri akses hanya untuk folder custom-borders/, bukan semua file bucket.
drop policy if exists "Owner uploads custom borders" on storage.objects;
drop policy if exists "Owner updates custom borders" on storage.objects;
drop policy if exists "Owner deletes custom borders" on storage.objects;
drop policy if exists "Public reads custom border assets" on storage.objects;

create policy "Owner uploads custom borders"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'community-media'
  and (storage.foldername(name))[1] = 'custom-borders'
  and exists (select 1 from public.staff_profiles p
    where p.user_id = (select auth.uid())
      and lower(trim(coalesce(p.role, ''))) = 'owner')
);

create policy "Owner updates custom borders"
on storage.objects for update to authenticated
using (
  bucket_id = 'community-media'
  and (storage.foldername(name))[1] = 'custom-borders'
  and exists (select 1 from public.staff_profiles p
    where p.user_id = (select auth.uid())
      and lower(trim(coalesce(p.role, ''))) = 'owner')
)
with check (
  bucket_id = 'community-media'
  and (storage.foldername(name))[1] = 'custom-borders'
  and exists (select 1 from public.staff_profiles p
    where p.user_id = (select auth.uid())
      and lower(trim(coalesce(p.role, ''))) = 'owner')
);

create policy "Owner deletes custom borders"
on storage.objects for delete to authenticated
using (
  bucket_id = 'community-media'
  and (storage.foldername(name))[1] = 'custom-borders'
  and exists (select 1 from public.staff_profiles p
    where p.user_id = (select auth.uid())
      and lower(trim(coalesce(p.role, ''))) = 'owner')
);

create policy "Public reads custom border assets"
on storage.objects for select to anon, authenticated
using (bucket_id = 'community-media' and (storage.foldername(name))[1] = 'custom-borders');

-- VERIFIKASI: setelah login dengan akun Owner, query ini harus menampilkan akunmu.
select user_id, role from public.staff_profiles
where user_id = auth.uid();
