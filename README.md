# — Grup Pemuda`友

Website komunitas WhatsApp: halaman publik, daftar grup, intro member, aturan, dashboard Owner, statistik kunjungan, dan API publik.

## Isi project
- `index.html`, `styles.css`, `app.js`: website publik
- `admin.html`, `admin.js`: dashboard Owner
- `config.js`: URL dan publishable/anon key Supabase untuk frontend
- `supabase/schema.sql`: tabel dan Row Level Security (RLS)
- `api/groups.js`: endpoint GET `/api/groups`
- `vercel.json`: rewrite API

## Implementasi lewat HP Android

### 1. Buat project Supabase
1. Buka https://supabase.com dan buat project baru.
2. Simpan password database di tempat aman.
3. Buka SQL Editor, pilih New query.
4. Salin seluruh isi `supabase/schema.sql`, lalu Run.
5. Buka Project Settings > API (atau Data API / API Keys). Salin Project URL dan publishable key (atau anon key legacy).
6. Buka `config.js` dan ganti `https://PROJECT_ID.supabase.co` serta `PASTE_SUPABASE_PUBLISHABLE_OR_ANON_KEY_DI_SINI`.
   - Key frontend publishable/anon memang digunakan di browser; keamanan berasal dari RLS.
   - JANGAN pernah masukkan `service_role` atau secret key ke `config.js`, GitHub, atau kode frontend.

### 2. Buat akun Owner
1. Di Supabase buka Authentication > Users > Add user, buat email dan password milikmu.
2. Salin UUID user tersebut.
3. Di SQL Editor jalankan perintah berikut dengan UUID akunmu:
   `insert into public.owner_profiles (user_id) values ('UUID-AKUN-OWNER-DI-SINI');`
4. Jangan menonaktifkan RLS. Dashboard akan memeriksa apakah akun terdaftar di `owner_profiles`.

### 3. Upload ke GitHub
1. Ekstrak ZIP ini. Upload isi folder project ke repository GitHub baru, bukan ZIP di dalam ZIP.
2. Pastikan `index.html`, `app.js`, `admin.html`, `package.json`, `vercel.json`, folder `api/`, dan folder `supabase/` berada di root repository.
3. Jika editor GitHub di HP sulit untuk banyak file, gunakan GitHub web editor atau upload file satu per satu.

### 4. Deploy ke Vercel
1. Buka https://vercel.com, login dengan GitHub.
2. Add New > Project, pilih repository.
3. Framework preset: Vite. Build command `npm run build`, output directory `dist`.
4. Tambahkan Environment Variables:
   - `SUPABASE_URL` = Project URL Supabase
   - `SUPABASE_ANON_KEY` = publishable/anon key (bukan service_role)
5. Deploy. Setelah sukses, buka domain Vercel.

### 5. Tes website
- Buka domain Vercel, halaman publik seharusnya tampil.
- Buka `/admin.html`, login menggunakan akun Owner.
- Tambahkan grup memakai link undangan WhatsApp yang valid.
- Cek daftar grup tampil di halaman publik.
- Kirim intro contoh dan setujui dari dashboard.
- Cek endpoint `https://DOMAIN-KAMU.vercel.app/api/groups` untuk JSON grup publik.

## Catatan keamanan dan batasan awal
- Dashboard hanya untuk Owner yang dimasukkan ke `owner_profiles`; RLS tetap wajib aktif.
- Statistik saat ini menghitung event kunjungan, bukan pengunjung unik dan bisa dipengaruhi bot. Pengiriman event dibatasi satu kali per tab sesi.
- Form intro publik belum memiliki CAPTCHA/rate limit. Sebelum promosi besar, tambahkan perlindungan spam dan moderasi.
- Profil intro yang disetujui saat ini dimoderasi di dashboard tetapi belum ditampilkan sebagai daftar profil publik.
- API hanya GET dan hanya mengembalikan grup yang dipublikasikan.
- Link undangan WhatsApp bersifat publik bagi siapa pun yang melihatnya; gunakan link grup yang memang ingin dibagikan.
- Paket gratis Supabase/Vercel punya kuota dan kebijakan yang dapat berubah.
