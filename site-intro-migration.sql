-- Intro video website: memakai tabel site_settings yang sudah digunakan pengaturan background.
-- Jalankan sekali di Supabase SQL Editor. Pastikan kebijakan SELECT publik untuk site_settings sudah ada;
-- jika belum, policy di bawah mengizinkan hanya membaca key site_intro secara publik.
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
drop policy if exists "Public can read site intro" on public.site_settings;
create policy "Public can read site intro" on public.site_settings for select to anon, authenticated using (key = 'site_intro');
-- Penulisan tetap harus mengikuti policy staff/owner yang sudah ada di project. Jangan buat policy write publik.
