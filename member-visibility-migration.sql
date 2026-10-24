-- Grup Pemuda友: tampilkan profil publik yang aman dan direktori chat untuk semua member.
-- Jalankan satu kali di Supabase SQL Editor. Tidak menghapus atau mengubah data member.

alter table public.staff_profiles add column if not exists avatar_url text;

-- Halaman publik hanya menampilkan profil member yang sudah disetujui.
-- Tidak mengekspos email, UUID, atau status moderasi.
create or replace view public.public_member_directory as
select display_name, created_at, avatar_url
from public.staff_profiles
where role = 'member'
  and coalesce(approval_status, 'approved') = 'approved';

grant select on public.public_member_directory to anon, authenticated;

-- Semua akun terdaftar dapat melihat daftar kontak untuk chat pribadi dan nama/role
-- pengirim chat publik. View hanya memuat data profil publik, tanpa email.
-- Kolom baru ditambahkan di akhir agar kompatibel dengan view lama.
create or replace view public.chat_member_directory as
select user_id, display_name, role, avatar_url, created_at
from public.staff_profiles
where role in ('owner', 'admin')
   or (role = 'member' and coalesce(approval_status, 'approved') = 'approved');

revoke all on public.chat_member_directory from anon, public;
grant select on public.chat_member_directory to authenticated;

-- Views PostgreSQL default dijalankan dengan hak pemilik view sehingga kebijakan
-- profile-self-only pada staff_profiles tidak menyembunyikan member lain dari direktori.
-- Pastikan tabel staff_profiles tetap memakai RLS dan jangan pernah mengekspos email di view.
