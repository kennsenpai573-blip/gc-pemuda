create extension if not exists pgcrypto;
create table if not exists public.staff_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default 'Member' check(char_length(display_name) between 1 and 60),
 email text, role text not null default 'member' check(role in ('owner','admin','member')),
 approval_status text not null default 'pending' check(approval_status in ('pending','approved','rejected')),
 created_at timestamptz not null default now()
);
create table if not exists public.community_groups (
 id uuid primary key default gen_random_uuid(), name text not null check(char_length(name) between 1 and 80),
 description text not null default '', category text not null default 'Komunitas umum',
 invite_url text not null check(invite_url ~ '^https://chat\.whatsapp\.com/[A-Za-z0-9]+$'),
 is_published boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists public.member_intros (
 id uuid primary key default gen_random_uuid(), nickname text not null check(char_length(nickname) between 1 and 40),
 interest text not null check(char_length(interest) between 1 and 80), bio text not null check(char_length(bio) between 1 and 400),
 status text not null default 'pending' check(status in ('pending','approved','rejected')), created_at timestamptz not null default now()
);
create table if not exists public.site_visits (
 id bigint generated always as identity primary key, path text not null default '/', created_at timestamptz not null default now()
);
alter table public.staff_profiles enable row level security;
alter table public.community_groups enable row level security;
alter table public.member_intros enable row level security;
alter table public.site_visits enable row level security;
create or replace function public.current_staff_role() returns text language sql stable security definer set search_path=public
as $$ select role from public.staff_profiles where user_id=auth.uid() limit 1; $$;
create or replace function public.is_owner() returns boolean language sql stable security definer set search_path=public
as $$ select coalesce(public.current_staff_role()='owner',false); $$;
create or replace function public.is_staff() returns boolean language sql stable security definer set search_path=public
as $$ select coalesce(public.current_staff_role() in ('owner','admin'),false); $$;
drop policy if exists "profile self read" on public.staff_profiles;
create policy "profile self read" on public.staff_profiles for select to authenticated using(user_id=auth.uid() or public.is_staff());
drop policy if exists "owner manages staff profiles" on public.staff_profiles;
create policy "owner manages staff profiles" on public.staff_profiles for all to authenticated using(public.is_owner()) with check(public.is_owner());
drop policy if exists "admin adds member profiles" on public.staff_profiles;
create policy "admin adds member profiles" on public.staff_profiles for insert to authenticated with check(public.current_staff_role()='admin' and role='member');
drop policy if exists "admin removes member profiles" on public.staff_profiles;
create policy "admin removes member profiles" on public.staff_profiles for delete to authenticated using(public.current_staff_role()='admin' and role='member');
drop policy if exists "public reads published groups" on public.community_groups;
create policy "public reads published groups" on public.community_groups for select to anon,authenticated using(is_published=true or public.is_staff());
drop policy if exists "staff inserts groups" on public.community_groups;
create policy "staff inserts groups" on public.community_groups for insert to authenticated with check(public.is_staff());
drop policy if exists "staff updates groups" on public.community_groups;
create policy "staff updates groups" on public.community_groups for update to authenticated using(public.is_staff()) with check(public.is_staff());
drop policy if exists "staff deletes groups" on public.community_groups;
create policy "staff deletes groups" on public.community_groups for delete to authenticated using(public.is_staff());
drop policy if exists "public submits intro" on public.member_intros;
create policy "public submits intro" on public.member_intros for insert to anon,authenticated with check(status='pending' and char_length(nickname) between 1 and 40 and char_length(interest) between 1 and 80 and char_length(bio) between 1 and 400);
drop policy if exists "staff reads intros" on public.member_intros;
create policy "staff reads intros" on public.member_intros for select to authenticated using(public.is_staff());
drop policy if exists "staff moderates intros" on public.member_intros;
create policy "staff moderates intros" on public.member_intros for update to authenticated using(public.is_staff()) with check(public.is_staff());
drop policy if exists "owner deletes intros" on public.member_intros;
create policy "owner deletes intros" on public.member_intros for delete to authenticated using(public.is_owner());
drop policy if exists "public records visit" on public.site_visits;
create policy "public records visit" on public.site_visits for insert to anon,authenticated with check(char_length(path)<=300);
drop policy if exists "staff reads visits" on public.site_visits;
create policy "staff reads visits" on public.site_visits for select to authenticated using(public.is_staff());
-- Buat akun Owner di Authentication > Users, lalu jalankan di SQL Editor:
-- insert into public.staff_profiles(user_id,display_name,email,role) values('UUID-OWNER','Owner Utama','EMAIL-OWNER','owner');
-- Jangan pernah menaruh service_role/secret key di browser.
