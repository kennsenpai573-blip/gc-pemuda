# Pemisahan Login Member dan Admin

- Login Member: `/member.html`
- Login Admin/Owner: `/admin.html`
- Keduanya menggunakan akun Supabase Auth yang sama. Tidak perlu membuat akun kedua.
- Owner memberi hak Admin dari Dashboard Admin → Manajemen Member & Hak Admin dengan memilih peran Admin.
- Hak Admin dicabut melalui daftar staf. Pencabutan hak tidak menghapus akun autentikasi atau profil komunitas.
- Direktori chat (`chat_member_directory`) menampilkan semua profil yang ada di `staff_profiles`, termasuk profil dengan role `admin`, sehingga Admin tetap bisa berinteraksi dengan member.

## Penting
Peran Admin yang tersimpan di `staff_profiles.role` tetap dipakai sebagai otorisasi dashboard dan harus dijaga oleh kebijakan RLS Supabase. Jangan pernah menaruh `service_role` key di frontend. Perubahan role lewat UI tetap tunduk pada kebijakan RLS tabel `staff_profiles` yang sudah ada.
