-- Jalankan sekali di Supabase SQL Editor untuk mengaktifkan background global.
-- Memastikan semua key background yang memang digunakan website dapat dibaca publik.
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
drop policy if exists "public reads home background" on public.site_settings;
drop policy if exists "public reads website backgrounds" on public.site_settings;
create policy "public reads website backgrounds" on public.site_settings
  for select to anon, authenticated
  using (key in ('home_background','groups_background','members_background','intro_background','rules_background','global_background'));
drop policy if exists "owner manages site settings" on public.site_settings;
create policy "owner manages site settings" on public.site_settings
  for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community-media','community-media',true,52428800,
  array['image/jpeg','image/png','image/webp','image/gif','image/avif','video/mp4','video/webm','video/ogg'])
on conflict (id) do update set public=true, file_size_limit=52428800, allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "public reads community media" on storage.objects;
create policy "public reads community media" on storage.objects for select to anon, authenticated using (bucket_id='community-media');
drop policy if exists "authenticated uploads own community media" on storage.objects;
create policy "authenticated uploads own community media" on storage.objects for insert to authenticated with check (
  bucket_id='community-media' and (storage.foldername(name))[2]=auth.uid()::text
);
