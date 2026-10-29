PERBAIKAN LEADERBOARD — Grup Pemuda

1. Supabase > SQL Editor.
2. Buka dan jalankan seluruh isi leaderboard-public-access-fix.sql.
3. Pastikan SQL berhasil tanpa error.
4. Deploy seluruh isi folder gc-pemuda-main ke repo GitHub yang terhubung ke Vercel.
5. Setelah deployment selesai, buka /leaderboard.html lalu refresh.

Perbaikan ini mengubah sumber data leaderboard menjadi RPC publik yang hanya mengembalikan profil member yang disetujui dan kolom ranking yang dibutuhkan. Tidak menghapus view atau tabel. Nilai poin tetap mengikuti staff_profiles.points. Jika member lain memiliki 0 poin, mereka tetap ditampilkan setelah member dengan poin lebih tinggi.
