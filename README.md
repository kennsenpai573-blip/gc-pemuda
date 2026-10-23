# — Grup Pemuda`友 v2 — Owner & Admin

## Peran
- **Owner:** kendali penuh dalam aplikasi; mengatur peran, mengelola grup, intro, dan statistik.
- **Admin:** mengelola grup, moderasi intro, menambah/menghapus profil Member. Tidak bisa memberi peran Admin/Owner.
- **Member:** profil anggota. Akun login perlu dibuat di Supabase Authentication.

## Setup dari HP Android
1. Buat project baru di https://supabase.com.
2. SQL Editor → New query → jalankan seluruh `supabase/schema.sql`.
3. Project Settings → API / API Keys: salin Project URL dan publishable key/anon key.
4. Ganti placeholder di `config.js`. Jangan pakai service_role/secret key di frontend.
5. Authentication → Users → Add user, buat akun Owner. Salin UUID user.
6. Jalankan di SQL Editor, dengan nilai akun milikmu:
   `insert into public.staff_profiles(user_id,display_name,email,role) values('UUID-OWNER','Owner Utama','EMAIL-OWNER','owner');`
7. Upload isi ZIP ke root repository GitHub. Jangan upload ZIP bersarang.
8. Import repository di https://vercel.com. Build `npm run build`, output `dist`.
9. Vercel Environment Variables: `SUPABASE_URL` dan `SUPABASE_ANON_KEY` (publishable/anon key saja).
10. Deploy. Buka `/admin.html` untuk ruang staf.

## Menambah member/admin
1. Buat user login di Supabase → Authentication → Users → Add user.
2. Salin UUID user, lalu login sebagai Owner di `/admin.html`.
3. Tab Member → masukkan UUID dan nama. Owner bisa memilih Member atau Admin.
4. Admin hanya bisa menambahkan profil berperan Member dan menghapus profil Member.
5. Menghapus profil tidak menghapus akun Auth. Untuk mencabut akses login sepenuhnya, Owner harus menonaktifkan/menghapus user di Supabase Authentication.

## Penting
- Skema ini ditujukan untuk project baru. Jika project lama berisi data, backup dulu dan buat migrasi khusus; jangan menimpa database produksi.
- RLS menegakkan hak akses. Jangan menonaktifkannya.
- Intro hanya ditinjau staf; halaman daftar profil publik belum termasuk.
- Statistik menghitung event kunjungan, bukan pengunjung unik.
- Form publik perlu rate limit/CAPTCHA sebelum dipromosikan luas.


## Panduan koneksi Supabase
Baca `supabase/SETUP.md` untuk langkah mengisi Project URL dan publishable/anon key, membuat akun Owner, dan menguji koneksi. Jangan gunakan service_role/secret key pada frontend.

## Pengaturan Supabase tanpa mengedit kode dari nol
Buka halaman `supabase-setup.html` setelah website berjalan, tempel Project URL dan Publishable/anon public key, lalu unduh `config.js`. Ganti file `config.js` di repository dan deploy ulang di Vercel. Form membuat file di browser; konfigurasi tidak otomatis tersimpan ke hosting.


## Fitur Daftar Member
- Pintasan publik: `/register.html` untuk pendaftaran dan `/members.html` untuk direktori member.
- Sebelum digunakan, buka Supabase SQL Editor dan jalankan `member-registration-migration.sql` satu kali. Ini menambahkan trigger profil member otomatis dan view publik yang hanya menampilkan nama serta tanggal bergabung.
- Supabase Auth dapat meminta konfirmasi email sesuai pengaturan project. Jangan pernah menaruh service-role key di frontend.


## Dashboard Member
- Buka `/member.html` untuk login dan melihat dashboard pribadi.
- Dashboard menampilkan nama, email akun, tanggal bergabung, dan pintasan ke grup, form intro, serta direktori member.
- Akun harus sudah terdaftar melalui `/register.html` dan profilnya dibuat oleh trigger `member-registration-migration.sql`.
- Dashboard menggunakan Supabase Auth dan hanya membaca profil akun yang sedang login; tidak menaruh password di tabel profil.
- Akun Owner/Admin tetap dapat memakai `/admin.html` untuk pengelolaan website.


## Chat pribadi antar-member (WhatsApp-style)
- Dashboard `/member.html` kini memiliki daftar kontak dan percakapan satu lawan satu. Pesan diperbarui otomatis setiap beberapa detik.
- Setiap pesan menampilkan nama pengirim dan role resmi (`Member`, `Admin`, atau `Owner`) dari direktori Supabase; pengguna tidak dapat mengetik atau memilih role sendiri.
- Jalankan `member-chat-migration.sql` satu kali di Supabase SQL Editor setelah `staff_profiles` tersedia. File ini membuat tabel pesan, indeks, RLS policies, dan view kontak terbatas yang tidak mengekspos email.
- RLS hanya mengizinkan pengguna terautentikasi membaca pesan yang mereka kirim atau terima dan mengirim pesan dengan `sender_id` akun login. Jangan menonaktifkan RLS.
- Chat ini versi teks pribadi, belum mendukung grup, media, panggilan, indikator online, atau status pesan dibaca.
