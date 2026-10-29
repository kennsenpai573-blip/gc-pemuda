-- Aktifkan pencatatan kunjungan halaman utama untuk publik, member, admin, dan Owner.
-- Satu event dicatat setiap kali halaman utama dimuat. Tidak menyimpan nama/email/IP.
-- Jalankan sekali di Supabase SQL Editor.
create table if not exists public.site_visits (
  id bigint generated always as identity primary key,
  path text not null default '/',
  created_at timestamptz not null default now()
);

alter table public.site_visits enable row level security;

drop policy if exists "public records visit" on public.site_visits;
create policy "public records visit"
  on public.site_visits for insert to anon, authenticated
  with check (char_length(path) between 1 and 300);

drop policy if exists "staff reads visits" on public.site_visits;
create policy "staff reads visits"
  on public.site_visits for select to authenticated
  using (public.is_staff());

grant insert on public.site_visits to anon, authenticated;
grant select on public.site_visits to authenticated;

grant usage, select on sequence public.site_visits_id_seq to anon, authenticated;

create or replace function public.get_public_site_stats()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'visitors', (select count(*) from public.site_visits),
    'members', (select count(*) from public.staff_profiles where approval_status = 'approved' and role = 'member'),
    'groups', (select count(*) from public.community_groups where is_published = true)
  );
$$;
revoke all on function public.get_public_site_stats() from public;
grant execute on function public.get_public_site_stats() to anon, authenticated;
