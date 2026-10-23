# Supabase setup — — Grup Pemuda`友

## Yang perlu diisi
File `config.js` menggunakan dua nilai publik:
- `SUPABASE_URL`: Project URL dari Supabase.
- `SUPABASE_ANON_KEY`: publishable key (atau anon key lama).

Jangan memasukkan `service_role` atau secret key ke file frontend.

## Membuat koneksi
1. Buka https://supabase.com/dashboard dan pilih project.
2. Buka Project Settings → API Keys (nama menu bisa berbeda menurut tampilan dashboard).
3. Salin Project URL dan publishable/anon key.
4. Buka `config.js`, ganti kedua placeholder, simpan.
5. Buka SQL Editor, jalankan `schema.sql` hanya untuk project baru.
6. Buat akun Owner di Authentication → Users → Add user.
7. Salin UUID akun Owner dan jalankan:
   `insert into public.staff_profiles(user_id,display_name,email,role) values('UUID-OWNER','Owner Utama','EMAIL-OWNER','owner');`
8. Deploy ulang project.

## Project Supabase yang sudah dipakai
Jangan jalankan skema tanpa meninjau tabel dan policies yang sudah ada. Buat backup dahulu. File `schema.sql` ditujukan untuk project baru; migrasi project lama perlu disesuaikan agar tabel dan kebijakan lama tidak bertabrakan.

## Memastikan koneksi
Setelah mengisi config dan deploy:
- Halaman publik harus memuat daftar grup (atau pesan bahwa belum ada grup).
- Buka `/admin.html`; coba login dengan akun Owner.
- Jika login sukses tetapi ditolak, periksa baris `staff_profiles` untuk UUID tersebut dan pastikan role `owner`.
- Jika request gagal, periksa Project URL/key, tabel, dan RLS.

## Kunci dan privasi
- Publishable/anon key boleh digunakan frontend, tetapi harus dilindungi oleh RLS.
- Jangan pernah commit password database, service_role key, atau secret key ke GitHub.
- Undangan WhatsApp yang dipublikasikan dapat diakses siapa pun.


## Mengaktifkan pendaftaran member
1. Backup project/database sebelum migrasi.
2. Buka Supabase → SQL Editor → New query.
3. Salin isi `member-registration-migration.sql`, lalu jalankan sekali.
4. Deploy file project ini ke Vercel.
5. Buka `/register.html` untuk mendaftar dan `/members.html` untuk melihat direktori.
6. Pastikan Authentication → URL Configuration memiliki Site URL domain Vercel dan redirect URL yang sesuai. Jika konfirmasi email aktif, pengguna perlu mengonfirmasi email.


## Build Vercel dan API
1. Di repository root, jalankan `npm install`, `npm run check`, lalu `npm run build`.
2. Pastikan Vercel menggunakan `npm run build` dan output `dist`. `vite.config.js` mengikutkan semua halaman HTML.
3. Tambahkan `SUPABASE_URL` dan `SUPABASE_ANON_KEY` sebagai Environment Variables Vercel untuk endpoint `/api/groups`. Gunakan hanya publishable/anon key.
4. Uji `https://DOMAIN-KAMU/api/groups` setelah deploy. Endpoint mengembalikan grup yang `is_published=true`; error konfigurasi harus ditangani di Environment Variables, bukan dengan menaruh secret di frontend.
