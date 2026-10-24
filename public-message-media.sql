-- Grup Pemuda: dukungan lampiran foto/video di Public Message.
-- Jalankan satu kali di Supabase SQL Editor. Tidak menghapus pesan atau chat lama.

alter table public.public_chat_messages
  add column if not exists media_url text,
  add column if not exists media_type text;

-- Izinkan pesan berisi teks, media, atau keduanya. Pesan lama tetap valid.
alter table public.public_chat_messages alter column body drop not null;
alter table public.public_chat_messages drop constraint if exists public_chat_messages_body_check;
alter table public.public_chat_messages
  add constraint public_chat_messages_body_check
  check (
    (char_length(trim(coalesce(body, ''))) between 1 and 2000)
    or media_url is not null
  );
alter table public.public_chat_messages drop constraint if exists public_chat_messages_media_type_check;
alter table public.public_chat_messages
  add constraint public_chat_messages_media_type_check
  check (media_type is null or media_type in (
    'image/jpeg','image/png','image/webp','image/gif','image/avif',
    'video/mp4','video/webm','video/ogg'
  ));

-- Gunakan bucket komunitas yang sudah ada. Maksimal 25 MB per file.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community-media', 'community-media', true, 26214400,
  array['image/jpeg','image/png','image/webp','image/gif','image/avif','video/mp4','video/webm','video/ogg'])
on conflict (id) do update set
  public = true,
  file_size_limit = 26214400,
  allowed_mime_types = excluded.allowed_mime_types;

-- File hanya boleh diunggah ke folder public-chat/<user-id>/ milik pengirim.
drop policy if exists "members upload public chat media" on storage.objects;
create policy "members upload public chat media"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'community-media'
  and (storage.foldername(name))[1] = 'public-chat'
  and (storage.foldername(name))[2] = auth.uid()::text
  and exists (
    select 1 from public.staff_profiles p
    where p.user_id = auth.uid()
      and coalesce(p.approval_status, 'approved') = 'approved'
  )
);

-- Public bucket media can be viewed by chat participants/site visitors via public URL.
-- Existing policy "public reads community media" from background-profile-migration.sql handles SELECT.


-- Poin tier: setiap pesan publik yang valid menambah tepat 50 poin langsung.
-- Menggantikan trigger koin harian lama agar tidak terjadi award ganda.
drop trigger if exists public_chat_collect_daily_coins on public.public_chat_messages;
create or replace function public.award_public_chat_points()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.staff_profiles
    set points = coalesce(points, 0) + 50
    where user_id = new.sender_id
      and coalesce(approval_status, 'approved') = 'approved';
  return new;
end;
$$;
drop trigger if exists public_chat_award_50_points on public.public_chat_messages;
create trigger public_chat_award_50_points
after insert on public.public_chat_messages
for each row execute function public.award_public_chat_points();
