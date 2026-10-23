-- Jalankan di Supabase SQL Editor satu kali.
-- Menambahkan foto profil member dan pengaturan background halaman utama.
alter table public.staff_profiles add column if not exists avatar_url text;
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
drop policy if exists "public reads home background" on public.site_settings;
create policy "public reads home background" on public.site_settings for select to anon, authenticated using (key = 'home_background');
drop policy if exists "owner manages site settings" on public.site_settings;
create policy "owner manages site settings" on public.site_settings for all to authenticated using (public.is_owner()) with check (public.is_owner());
-- Member hanya dapat memperbarui kolom avatar_url miliknya melalui policy RLS.
drop policy if exists "member updates own avatar" on public.staff_profiles;
create policy "member updates own avatar" on public.staff_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Storage bucket publik untuk URL media yang ditampilkan pada website.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community-media', 'community-media', true, 52428800,
  array['image/jpeg','image/png','image/webp','image/gif','image/avif','video/mp4','video/webm','video/ogg'])
on conflict (id) do update set public = true, file_size_limit = 52428800,
  allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "public reads community media" on storage.objects;
create policy "public reads community media" on storage.objects for select to anon, authenticated using (bucket_id = 'community-media');
drop policy if exists "authenticated uploads own community media" on storage.objects;
create policy "authenticated uploads own community media" on storage.objects for insert to authenticated with check (
  bucket_id = 'community-media' and (storage.foldername(name))[2] = auth.uid()::text
);
drop policy if exists "users update own community media" on storage.objects;
create policy "users update own community media" on storage.objects for update to authenticated using (
  bucket_id = 'community-media' and (storage.foldername(name))[2] = auth.uid()::text
) with check (bucket_id = 'community-media' and (storage.foldername(name))[2] = auth.uid()::text);

-- Proteksi tambahan: member biasa hanya boleh mengubah avatar_url miliknya,
-- bukan nama, role, email, atau status persetujuan.
create or replace function public.protect_member_profile_fields()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() = old.user_id and not public.is_staff() then
    if new.user_id is distinct from old.user_id
      or new.display_name is distinct from old.display_name
      or new.email is distinct from old.email
      or new.role is distinct from old.role
      or new.approval_status is distinct from old.approval_status
      or new.created_at is distinct from old.created_at then
      raise exception 'Member hanya boleh mengubah foto profil sendiri';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists protect_member_profile_fields on public.staff_profiles;
create trigger protect_member_profile_fields before update on public.staff_profiles
for each row execute function public.protect_member_profile_fields();
