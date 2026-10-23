import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const $ = s => document.querySelector(s);
const all = s => [...document.querySelectorAll(s)];

const configured =
  SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("PROJECT_ID") &&
  !SUPABASE_ANON_KEY.includes("PASTE_");

const db = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
let role = null;

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));

const msg = (id, s) => {
  const el = $(id);
  if (el) el.textContent = s;
};

function tab(n) {
  all(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === n));
  ["approvals", "members", "groups", "intros", "stats", "staff"].forEach(k => {
    const el = $("#tab-" + k);
    if (el) el.classList.toggle("hidden", k !== n);
  });
}

all(".tab").forEach(b => b.addEventListener("click", () => tab(b.dataset.tab)));

const item = (title, sub, buttons = "") =>
  `<div class="admin-item"><div><strong>${esc(title)}</strong><small>${esc(sub)}</small></div><div class="item-actions">${buttons}</div></div>`;

async function refresh() {
  if (!db) {
    msg("#login-status", "Isi config.js dengan URL dan publishable/anon key Supabase.");
    return;
  }

  const { data: { user }, error: userError } = await db.auth.getUser();

  if (userError) {
    msg("#login-status", "Gagal memeriksa sesi: " + userError.message);
    return;
  }

  if (!user) {
    role = null;
    $("#login-panel").classList.remove("hidden");
    $("#dashboard").classList.add("hidden");
    return;
  }

  const { data: p, error } = await db
    .from("staff_profiles")
    .select("user_id,display_name,email,role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Gagal membaca staff_profiles:", error);
    msg("#login-status", "Gagal membaca profil staf: " + error.message);
    return;
  }

  if (!p) {
    console.error("Profil tidak ditemukan:", user.id, user.email);
    msg("#login-status", "Profil Owner/Admin tidak ditemukan. User ID: " + user.id);
    return;
  }

  if (!["owner", "admin"].includes(p.role)) {
    msg("#login-status", "Profil ditemukan, tetapi role akun adalah: " + p.role);
    return;
  }

  role = p.role;
  $("#login-panel").classList.add("hidden");
  $("#dashboard").classList.remove("hidden");
  $("#role-badge").textContent = role.toUpperCase();
  all(".owner-only").forEach(e => e.classList.toggle("hidden", role !== "owner"));

  const { data: members, error: membersError } = await db
    .from("staff_profiles")
    .select("user_id,display_name,email,role,approval_status,created_at")
    .order("created_at", { ascending: false });

  if (membersError) {
    msg("#member-status", "Gagal memuat anggota: " + membersError.message);
    return;
  }

  const ms = members || [];
  const pending = ms.filter(m => m.role === "member" && (m.approval_status || "approved") === "pending");
  $("#pending-count").textContent = pending.length;
  $("#approvals-list").innerHTML = pending.map(m => item(
    m.display_name,
    `${m.email || "Tanpa email"} · Didaftarkan ${new Date(m.created_at).toLocaleString("id-ID")}`,
    role === "owner"
      ? `<button class="btn primary" data-member-approve="${esc(m.user_id)}">Setujui</button><button class="btn danger" data-member-reject="${esc(m.user_id)}">Tolak</button>`
      : "Menunggu keputusan Owner"
  )).join("") || '<p class="muted">Tidak ada pendaftaran yang menunggu persetujuan.</p>';
  all("#approvals-list [data-member-approve]").forEach(b => b.addEventListener("click", () => decideMember(b.dataset.memberApprove, "approved")));
  all("#approvals-list [data-member-reject]").forEach(b => b.addEventListener("click", () => decideMember(b.dataset.memberReject, "rejected")));
  $("#metric-members").textContent = ms.filter(m => m.role === "member" && (m.approval_status || "approved") === "approved").length;

  $("#members-list").innerHTML = ms.map(m => {
    const allowed = role === "owner" ? m.role !== "owner" : m.role === "member";
    return item(
      m.display_name,
      `${m.email || "Tanpa email"} · ${m.role} · ${m.approval_status || "approved"} · ${m.user_id}`,
      allowed ? `<button class="btn danger" data-remove="${esc(m.user_id)}">Hapus akses</button>` : ""
    );
  }).join("") || '<p class="muted">Belum ada profil.</p>';

  all("#members-list [data-remove]").forEach(b => b.addEventListener("click", async () => {
    if (!confirm("Hapus profil/peran ini? Akun Auth tidak ikut terhapus.")) return;
    const { error } = await db.from("staff_profiles").delete().eq("user_id", b.dataset.remove);
    msg("#member-status", error ? "Tidak berhasil: " + error.message : "Profil akses dihapus.");
    refresh();
  }));

  const { data: gs, error: groupsError } = await db
    .from("community_groups").select("*").order("created_at", { ascending: false });

  if (groupsError) {
    msg("#group-status", "Gagal memuat grup: " + groupsError.message);
  }

  $("#metric-groups").textContent = (gs || []).length;
  $("#groups-list").innerHTML = (gs || []).map(g => item(
    g.name,
    `${g.is_published ? "Publik" : "Draft"} · ${g.category}`,
    `<button class="btn danger" data-gdel="${esc(g.id)}">Hapus</button>`
  )).join("") || '<p class="muted">Belum ada grup.</p>';

  all("#groups-list [data-gdel]").forEach(b => b.addEventListener("click", async () => {
    if (!confirm("Hapus grup?")) return;
    const { error } = await db.from("community_groups").delete().eq("id", b.dataset.gdel);
    msg("#group-status", error ? "Gagal menghapus: " + error.message : "Grup dihapus.");
    refresh();
  }));

  const { data: ins, error: introError } = await db
    .from("member_intros").select("*").eq("status", "pending")
    .order("created_at", { ascending: false });

  if (introError) msg("#group-status", "Gagal memuat intro: " + introError.message);

  $("#intros-list").innerHTML = (ins || []).map(i => item(
    i.nickname,
    `${i.interest} · ${i.bio}`,
    `<button class="btn primary" data-approve="${esc(i.id)}">Setujui</button><button class="btn danger" data-reject="${esc(i.id)}">Tolak</button>`
  )).join("") || '<p class="muted">Tidak ada intro menunggu.</p>';

  all("#intros-list [data-approve]").forEach(b =>
    b.addEventListener("click", () => moderate(b.dataset.approve, "approved"))
  );
  all("#intros-list [data-reject]").forEach(b =>
    b.addEventListener("click", () => moderate(b.dataset.reject, "rejected"))
  );

  const { count, error: visitsError } = await db
    .from("site_visits").select("*", { count: "exact", head: true });

  $("#metric-visits").textContent = count ?? 0;
  $("#stats-text").textContent = visitsError
    ? "Gagal memuat statistik: " + visitsError.message
    : `${count ?? 0} event kunjungan tercatat (bukan pengunjung unik).`;

  $("#staff-list").innerHTML = ms.filter(m => ["owner", "admin"].includes(m.role))
    .map(m => item(
      m.display_name,
      `${m.email || "Tanpa email"} · ${m.role}`,
      role === "owner" && m.role === "admin"
        ? `<button class="btn danger" data-demote="${esc(m.user_id)}">Jadikan Member</button>`
        : ""
    )).join("") || '<p class="muted">Belum ada Admin tambahan.</p>';

  all("#staff-list [data-demote]").forEach(b => b.addEventListener("click", async () => {
    if (!confirm("Cabut peran Admin?")) return;
    const { error } = await db.from("staff_profiles")
      .update({ role: "member" }).eq("user_id", b.dataset.demote);
    msg("#member-status", error ? "Gagal mengubah peran: " + error.message : "Peran Admin dicabut.");
    refresh();
  }));
}

async function decideMember(userId, status) {
  if (role !== "owner") { msg("#approval-status", "Hanya Owner yang dapat memutuskan pendaftaran."); return; }
  const label = status === "approved" ? "menyetujui" : "menolak";
  if (!confirm(`Yakin ${label} pendaftaran member ini?`)) return;
  const { error } = await db.from("staff_profiles").update({ approval_status: status }).eq("user_id", userId).eq("role", "member");
  msg("#approval-status", error ? "Keputusan gagal: " + error.message : (status === "approved" ? "Member disetujui. Member sekarang dapat login." : "Pendaftaran ditolak. Member tidak dapat login ke dashboard."));
  await refresh();
}

async function moderate(id, status) {
  const { error } = await db.from("member_intros").update({ status }).eq("id", id);
  msg("#group-status", error ? "Moderasi gagal: " + error.message : "Intro diperbarui.");
  refresh();
}

$("#login-form").addEventListener("submit", async e => {
  e.preventDefault();

  if (!db) {
    msg("#login-status", "Isi config.js dengan URL dan publishable/anon key Supabase.");
    return;
  }

  const f = new FormData(e.currentTarget);
  const { error } = await db.auth.signInWithPassword({
    email: f.get("email"),
    password: f.get("password")
  });

  if (error) {
    msg("#login-status", "Login gagal: " + error.message);
    return;
  }

  msg("#login-status", "Login berhasil. Memeriksa role...");
  await refresh();
});

$("#logout").addEventListener("click", async () => {
  await db?.auth.signOut();
  refresh();
});

$("#member-form").addEventListener("submit", async e => {
  e.preventDefault();
  if (!db) return;

  const f = new FormData(e.currentTarget);
  const newRole = String(f.get("role"));

  if (newRole === "admin" && role !== "owner") {
    msg("#member-status", "Hanya Owner yang dapat menetapkan Admin.");
    return;
  }

  const { error } = await db.from("staff_profiles").upsert({
    user_id: String(f.get("user_id")).trim(),
    display_name: String(f.get("display_name")).trim(),
    email: String(f.get("email")).trim() || null,
    role: newRole
  }, { onConflict: "user_id" });

  msg("#member-status", error
    ? "Gagal menyimpan profil: " + error.message
    : "Profil/peran disimpan."
  );

  if (!error) {
    e.currentTarget.reset();
    refresh();
  }
});

$("#group-form").addEventListener("submit", async e => {
  e.preventDefault();
  if (!db) return;

  const f = new FormData(e.currentTarget);
  const url = String(f.get("invite_url")).trim();

  if (!/^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+$/.test(url)) {
    msg("#group-status", "Link undangan WhatsApp tidak valid.");
    return;
  }

  const { error } = await db.from("community_groups").insert({
    name: String(f.get("name")).trim(),
    category: String(f.get("category")).trim() || "Komunitas umum",
    description: String(f.get("description")).trim(),
    invite_url: url,
    is_published: f.has("is_published")
  });

  msg("#group-status", error ? "Gagal menyimpan grup: " + error.message : "Grup disimpan.");

  if (!error) {
    e.currentTarget.reset();
    refresh();
  }
});

if (!configured) {
  msg("#login-status", "Konfigurasi Supabase belum diisi. Buka config.js.");
}

refresh();
