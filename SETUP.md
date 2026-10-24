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

## Persetujuan pendaftaran member oleh Owner

1. Buat backup project dan database sebelum mengubah skema.
2. Buka Supabase Dashboard → SQL Editor, lalu jalankan `member-approval-migration.sql` satu kali. Migrasi ini mempertahankan profil lama dengan status `approved`; akun baru otomatis `pending`.
3. Pastikan akun Owner yang sudah ada tetap memiliki `role = 'owner'` di `staff_profiles`.
4. Deploy ulang website dari project ini.
5. Owner masuk ke `admin.html` lalu buka tab **Pendaftaran**. Pendaftaran baru tampil di sana. Owner dapat memilih **Setujui** atau **Tolak**.
6. Member berstatus `pending` atau `rejected` tidak dapat membuka Dashboard Member. Setelah disetujui, member dapat login (dan tetap harus mengonfirmasi email jika fitur konfirmasi email Supabase aktif).

Catatan: notifikasi pendaftaran tampil di dashboard Owner saat dashboard dimuat/di-refresh; ini bukan push notification ke luar browser. Jangan pernah menaruh `service_role` key di kode frontend.

## Membuka direktori member untuk semua member

Jika member biasa tidak bisa melihat member lain, jalankan `member-visibility-migration.sql` satu kali di **Supabase → SQL Editor → New query → Run**. Migrasi ini membuat direktori publik berisi nama, foto profil, dan tanggal bergabung (tanpa email/UUID), serta direktori chat untuk semua member yang sudah disetujui. Setelah itu deploy ulang project ke Vercel. Halaman utama akan menampilkan hingga enam member terbaru; halaman **Member Terdaftar** menampilkan daftar lengkap.


## Leaderboard manual oleh Owner
Jalankan `manual-leaderboard-migration.sql` di Supabase SQL Editor. Setelah deployment, Owner membuka Ruang Owner & Admin → 🏆 Leaderboard untuk memilih member dan menetapkan peringkat 1–5. Peringkat tidak menggunakan poin.
