-- Jalankan di Supabase SQL Editor sebelum memakai menu Pembuat Border.
create table if not exists public.custom_avatar_borders (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  price integer not null default 1000 check (price >= 0),
  image_url text not null,
  storage_path text,
  shop_item_id uuid references public.wallet_shop_items(id) on delete set null,
  animation text not null default 'pulse' check (animation in ('pulse','rotate','shimmer','none')),
  glow_color text not null default '#b65cff',
  glow_width integer not null default 6 check (glow_width between 0 and 20),
  glow_brightness integer not null default 70 check (glow_brightness between 0 and 150),
  glow_speed integer not null default 50 check (glow_speed between 0 and 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.custom_avatar_borders enable row level security;
drop policy if exists "Public can read active custom borders" on public.custom_avatar_borders;
create policy "Public can read active custom borders" on public.custom_avatar_borders for select using (is_active = true or exists (select 1 from public.staff_profiles p where p.user_id = auth.uid() and p.role = 'owner'));
drop policy if exists "Owner manages custom borders" on public.custom_avatar_borders;
create policy "Owner manages custom borders" on public.custom_avatar_borders for all using (exists (select 1 from public.staff_profiles p where p.user_id = auth.uid() and p.role = 'owner') ) with check (exists (select 1 from public.staff_profiles p where p.user_id = auth.uid() and p.role = 'owner'));
-- Upload uses the existing community-media bucket. If it is not public, set it public in Storage settings
-- or configure a read policy for public assets; do not expose private user media.

alter table public.custom_avatar_borders add column if not exists shop_item_id uuid references public.wallet_shop_items(id) on delete set null;
