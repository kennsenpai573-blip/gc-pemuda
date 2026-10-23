-- Jalankan di Supabase > SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.owner_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.community_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '',
  category text not null default 'Komunitas umum',
  invite_url text not null check (invite_url ~ '^https://chat\.whatsapp\.com/[A-Za-z0-9]+$'),
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.member_intros (
  id uuid primary key default gen_random_uuid(),
  nickname text not null check (char_length(nickname) between 1 and 40),
  interest text not null check (char_length(interest) between 1 and 80),
  bio text not null check (char_length(bio) between 1 and 400),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.site_visits (
  id bigint generated always as identity primary key,
  path text not null default '/',
  created_at timestamptz not null default now()
);

alter table public.owner_profiles enable row level security;
alter table public.community_groups enable row level security;
alter table public.member_intros enable row level security;
alter table public.site_visits enable row level security;

create or replace function public.is_community_owner()
returns boolean language sql stable security definer
set search_path = public
as $$ select exists (select 1 from public.owner_profiles where user_id = auth.uid()); $$;

drop policy if exists "owners can read own profile" on public.owner_profiles;
create policy "owners can read own profile" on public.owner_profiles
for select to authenticated using (user_id = auth.uid());

drop policy if exists "public reads published groups" on public.community_groups;
create policy "public reads published groups" on public.community_groups
for select to anon, authenticated using (is_published = true or public.is_community_owner());

drop policy if exists "owners manage groups" on public.community_groups;
create policy "owners manage groups" on public.community_groups
for all to authenticated using (public.is_community_owner()) with check (public.is_community_owner());

drop policy if exists "public submits intro" on public.member_intros;
create policy "public submits intro" on public.member_intros
for insert to anon, authenticated with check (
  status = 'pending' and char_length(nickname) between 1 and 40
  and char_length(interest) between 1 and 80 and char_length(bio) between 1 and 400
);

drop policy if exists "owners read intros" on public.member_intros;
create policy "owners read intros" on public.member_intros
for select to authenticated using (public.is_community_owner());

drop policy if exists "owners moderate intros" on public.member_intros;
create policy "owners moderate intros" on public.member_intros
for update to authenticated using (public.is_community_owner()) with check (public.is_community_owner());

drop policy if exists "public records visit" on public.site_visits;
create policy "public records visit" on public.site_visits
for insert to anon, authenticated with check (char_length(path) <= 300);

drop policy if exists "owners read visits" on public.site_visits;
create policy "owners read visits" on public.site_visits
for select to authenticated using (public.is_community_owner());

-- SETELAH membuat akun Owner melalui Authentication > Users, ganti UUID di bawah:
-- insert into public.owner_profiles (user_id) values ('UUID-AKUN-OWNER-DI-SINI');
-- Jangan membuat policy yang mengizinkan publik menulis ke owner_profiles.
