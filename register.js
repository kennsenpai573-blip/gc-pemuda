import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
const $ = s => document.querySelector(s);
$("#year").textContent = new Date().getFullYear();
const configured = SUPABASE_URL.startsWith("https://") && !SUPABASE_URL.includes("PROJECT_ID") && !SUPABASE_ANON_KEY.includes("PASTE_");
const client = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
$("#register-form").addEventListener("submit", async e => {
  e.preventDefault(); const status = $("#register-status"); status.textContent = "";
  if (!client) { status.textContent = "Supabase belum dikonfigurasi. Periksa config.js."; return; }
  const f = new FormData(e.currentTarget);
  const displayName = String(f.get("display_name") || "").trim();
  const email = String(f.get("email") || "").trim().toLowerCase();
  const password = String(f.get("password") || "");
  const confirm = String(f.get("confirm_password") || "");
  if (password.length < 8) { status.textContent = "Password minimal 8 karakter."; return; }
  if (password !== confirm) { status.textContent = "Password dan ulangi password tidak sama."; return; }
  const { data, error } = await client.auth.signUp({ email, password, options: { data: { display_name: displayName }, emailRedirectTo: `${location.origin}/members.html` } });
  if (error) { status.textContent = "Pendaftaran gagal: " + error.message; return; }
  e.currentTarget.reset();
  status.textContent = data.session ? "Akun berhasil dibuat! Profil member sedang disiapkan. Kamu bisa melihat daftar member." : "Pendaftaran diterima. Jika konfirmasi email aktif, buka email kamu lalu klik tautan konfirmasi. Profil member akan dibuat otomatis.";
});
