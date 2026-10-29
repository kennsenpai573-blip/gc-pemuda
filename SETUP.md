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


## Status Online/Offline dan Profil Member

- Jalankan `member-presence-migration.sql` satu kali di Supabase SQL Editor. Migrasi ini membuat tabel heartbeat dan view publik yang tidak menampilkan UUID/email.
- Setelah deploy, member yang login ke Dashboard akan mengirim heartbeat berkala. Status dianggap **Online (hijau)** jika heartbeat kurang dari 2 menit; selain itu **Offline (merah)**.
- Pada halaman `members.html`, ketuk kartu/foto/nama member untuk membuka modal profil. Baris leaderboard di dashboard juga bisa diketuk untuk membuka profil.
- Fitur ini belum aktif di website live sampai SQL dijalankan dan project terbaru dideploy ke Vercel.

### Verifikasi TikTok
Jalankan `tiktok-verification-migration.sql` di Supabase SQL Editor. Setelah deployment, member mengirim username dan link profil dari dashboard. Owner meninjau akun secara manual melalui tab **Verifikasi TikTok**. Profil TikTok yang sudah disetujui tampil sebagai tautan yang dapat diketuk di profil publik.


## Integrasi status bot WhatsApp (tahap 1)
1. Jalankan `bot-presence-migration.sql` di Supabase SQL Editor. Ini hanya membuat tabel status dan tidak mengubah tabel member.
2. Di Pterodactyl, tambahkan environment variables `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` pada server bot. Gunakan secret/service-role key dari Supabase; jangan pernah menaruhnya di file website, GitHub, atau chat.
3. Tambahkan `web-integration.js` dari paket integrasi bot ke folder yang sama dengan `index.js`, lalu ikuti `BOT-INTEGRATION-SETUP.txt` di paket tersebut untuk dua perubahan kecil di `index.js`.
4. Setelah bot restart, login Owner di `/admin.html` lalu buka tab `🤖 Bot WhatsApp`.

Catatan: status online hanya akurat jika bot berhasil menulis heartbeat. Jika env belum dipasang, bot tetap berjalan normal dan fitur integrasi tidak aktif.

## Level member publik berdasarkan pembelian toko
1. Setelah `saldo-migration.sql` dan `saldo-ecosystem-migration.sql` berhasil, jalankan `purchase-level-migration.sql` di Supabase SQL Editor.
2. Deploy seluruh project terbaru.
3. Ketika member lain membuka profil publik melalui daftar member/leaderboard, profil menampilkan level, total poin yang dibelanjakan, jumlah pembelian, dan progres ke level berikutnya.
4. Level dihitung dari transaksi toko `Belanja:` saja; transfer hadiah dan bonus/misi tidak menaikkan level.

Ambang level awal: Pemula (<500), Kolektor (500), Pemburu Bintang (1.000), Kolektor Elite (2.500), Legenda Toko (5.000 poin dibelanjakan). Angka dihitung dari poin virtual yang dibelanjakan, bukan uang sungguhan.


### Bingkai avatar
Untuk mengaktifkan bingkai avatar, jalankan `avatar-frame-migration.sql` di Supabase SQL Editor setelah migrasi ekonomi saldo. Member membeli item kategori **Bingkai** di halaman Saldo, lalu membuka **Koleksi saya** dan menekan **Pasang**. Bingkai tersimpan pada profil dan ditampilkan di dashboard serta modal profil publik. Pastikan kebijakan RLS `staff_profiles` mengizinkan member membaca profil publik dan memperbarui kolom profil miliknya sendiri.


### Bingkai avatar gratis untuk member baru

Migrasi `avatar-frame-migration.sql` juga menyediakan **Bingkai Dasar** seharga 0 poin. Bingkainya sederhana dengan garis abu-abu tipis, cocok untuk member yang baru mulai. Bingkai lain seperti Ungu, Emas, Es, Mawar, dan Neon tetap berbayar menggunakan saldo virtual. Jika migrasi bingkai sudah pernah dijalankan, jalankan kembali file `avatar-frame-migration.sql`; query ini memeriksa nama dan kategori agar item yang sama tidak digandakan.


## Perbaikan pembelian item gratis
Jika pembelian Bingkai Dasar 0 poin memunculkan error `wallet_transactions_amount_check`, jalankan `wallet-purchase-free-fix.sql` di Supabase SQL Editor satu kali. Fungsi yang diperbarui tidak membuat transaksi `amount=0`; pembelian berbayar tetap mencatat transaksi negatif dan memotong saldo. Setelah itu deploy project terbaru dari ZIP ke Vercel/GitHub.


## Pemisahan Saldo, Poin, dan Level
Setelah `saldo-migration.sql` dan `saldo-ecosystem-migration.sql`, jalankan `point-level-separation-migration.sql` di Supabase SQL Editor. Bonus harian dan hadiah misi menambah poin level saja; pembelian memakai saldo virtual. Level dihitung 1 + floor(poin / 100), jadi terus naik tanpa tier atau batas maksimum.
