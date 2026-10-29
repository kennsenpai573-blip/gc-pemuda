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
  ["approvals", "members", "groups", "intros", "site-intro", "stats", "background", "staff", "tiktok", "bot", "bot-messages", "channels", "up-sw", "reset-points"].forEach(k => {
    const el = $("#tab-" + k);
    if (el) el.classList.toggle("hidden", k !== n);
  });
  closeOwnerMenu();
  if (n === "reset-points") loadResetPointMembers();
}

function closeOwnerMenu() {
  const panel = $("#owner-menu-panel");
  const fab = $("#owner-menu-fab");
  if (panel) panel.classList.add("hidden");
  if (fab) { fab.classList.remove("is-open"); fab.setAttribute("aria-expanded", "false"); fab.setAttribute("aria-label", "Buka menu Owner"); }
}

$("#owner-menu-fab")?.addEventListener("click", () => {
  const panel = $("#owner-menu-panel");
  const fab = $("#owner-menu-fab");
  const opening = panel?.classList.contains("hidden");
  panel?.classList.toggle("hidden", !opening);
  fab?.classList.toggle("is-open", !!opening);
  fab?.setAttribute("aria-expanded", String(!!opening));
  fab?.setAttribute("aria-label", opening ? "Tutup menu Owner" : "Buka menu Owner");
});
$("#owner-menu-close")?.addEventListener("click", closeOwnerMenu);
all(".tab").forEach(b => b.addEventListener("click", () => tab(b.dataset.tab)));

const item = (title, sub, buttons = "") =>
  `<div class="admin-item"><div><strong>${esc(title)}</strong><small>${esc(sub)}</small></div><div class="item-actions">${buttons}</div></div>`;


async function loadTikTokVerifications() {
  if (role !== "owner" || !db) return;
  const box = $("#tiktok-verification-list");
  const { data, error } = await db.from("tiktok_verifications").select("user_id,username,profile_url,status,updated_at,staff_profiles(display_name)").order("updated_at", { ascending: false });
  if (error) { box.innerHTML = '<p class="muted">Jalankan tiktok-verification-migration.sql terlebih dahulu.</p>'; msg("#tiktok-admin-status", error.message); return; }
  box.innerHTML = (data || []).map(r => item(`${r.staff_profiles?.display_name || "Member"} · @${r.username.replace(/^@/, "")}`, `${r.status.toUpperCase()} · ${r.profile_url}`, `<a class="btn secondary" href="${esc(r.profile_url)}" target="_blank" rel="noopener noreferrer">Buka TikTok</a>${r.status !== "verified" ? `<button class="btn primary" data-tiktok-verify="${esc(r.user_id)}">Verifikasi</button>` : ""}<button class="btn danger" data-tiktok-reject="${esc(r.user_id)}">${r.status === "rejected" ? "Hapus" : "Tolak / cabut"}</button>`)).join("") || '<p class="muted">Belum ada pengajuan verifikasi TikTok.</p>';
  all("#tiktok-verification-list [data-tiktok-verify]").forEach(b => b.addEventListener("click", async () => { const { error } = await db.from("tiktok_verifications").update({ status: "verified", reviewed_at: new Date().toISOString(), reviewed_by: (await db.auth.getUser()).data.user.id, updated_at: new Date().toISOString() }).eq("user_id", b.dataset.tiktokVerify); msg("#tiktok-admin-status", error ? error.message : "Akun berhasil diverifikasi."); loadTikTokVerifications(); }));
  all("#tiktok-verification-list [data-tiktok-reject]").forEach(b => b.addEventListener("click", async () => { const { error } = await db.from("tiktok_verifications").update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: (await db.auth.getUser()).data.user.id, updated_at: new Date().toISOString() }).eq("user_id", b.dataset.tiktokReject); msg("#tiktok-admin-status", error ? error.message : "Status verifikasi ditolak/dicabut."); loadTikTokVerifications(); }));
}

async function loadBotPresence() {
  if (role !== "owner" || !db) return;
  const label = $("#bot-status-label"), detail = $("#bot-status-detail");
  if (!label || !detail) return;
  const { data, error } = await db.from("bot_presence").select("status,last_seen,updated_at").eq("id", "main").maybeSingle();
  if (error) {
    label.textContent = "Status belum tersedia";
    detail.textContent = "Pastikan bot-presence-migration.sql sudah dijalankan. " + error.message;
    return;
  }
  if (!data) {
    label.textContent = "⚪ Belum terhubung";
    detail.textContent = "Bot belum mengirim heartbeat ke Supabase.";
    return;
  }
  const lastSeen = data.last_seen ? new Date(data.last_seen) : null;
  const fresh = lastSeen && (Date.now() - lastSeen.getTime() < 90000);
  const online = data.status === "online" && fresh;
  label.textContent = online ? "🟢 Bot Online" : "🔴 Bot Offline";
  detail.textContent = lastSeen ? `Status laporan: ${data.status} · Heartbeat terakhir: ${lastSeen.toLocaleString("id-ID")}` : "Belum ada waktu heartbeat.";
}
$("#bot-status-refresh")?.addEventListener("click", loadBotPresence);

async function loadBotMessageHistory() {
  if (!(["owner", "admin"].includes(role)) || !db) return;
  const box = $("#bot-message-history"); if (!box) return;
  const { data, error } = await db.from("whatsapp_message_queue").select("id,recipient,recipient_type,message,status,created_at,processed_at,error").order("created_at", { ascending: false }).limit(25);
  if (error) { box.innerHTML = '<p class="muted">Jalankan whatsapp-queue-migration.sql terlebih dahulu.</p>'; return; }
  box.innerHTML = (data || []).map(r => item(`${r.status.toUpperCase()} · ${(r.recipient_type || "private").toUpperCase()} · ${r.recipient}`, `${new Date(r.created_at).toLocaleString("id-ID")} · ${r.message}${r.error ? ` · Error: ${r.error}` : ""}`, r.status === "queued" || r.status === "failed" ? `<button class="btn danger" data-delete-message="${r.id}">Hapus</button>` : "")).join("") || '<p class="muted">Belum ada pesan.</p>';
  all("[data-delete-message]").forEach(b => b.addEventListener("click", async () => { const { error } = await db.from("whatsapp_message_queue").delete().eq("id", Number(b.dataset.deleteMessage)); msg("#bot-message-status", error ? error.message : "Pesan dihapus dari antrean/riwayat."); loadBotMessageHistory(); }));
}

const recipientTypeSelect = $("#bot-recipient-type");
const recipientInput = $("#bot-recipient");
const recipientLabel = $("#bot-recipient-label");
function updateRecipientHint() {
  if (!recipientTypeSelect || !recipientInput || !recipientLabel) return;
  const type = recipientTypeSelect.value;
  if (type === "group") {
    recipientLabel.firstChild.textContent = "JID Grup WhatsApp";
    recipientInput.placeholder = "120363012345678901-1234567890@g.us";
    recipientInput.removeAttribute("inputmode"); recipientInput.removeAttribute("pattern"); recipientInput.removeAttribute("maxlength");
  } else if (type === "channel") {
    recipientLabel.firstChild.textContent = "JID WhatsApp Channel";
    recipientInput.placeholder = "123456789012345@newsletter";
    recipientInput.removeAttribute("inputmode"); recipientInput.removeAttribute("pattern"); recipientInput.removeAttribute("maxlength");
  } else {
    recipientLabel.firstChild.textContent = "Nomor WhatsApp";
    recipientInput.placeholder = "62812xxxxxxx";
    recipientInput.setAttribute("inputmode", "numeric"); recipientInput.setAttribute("pattern", "[1-9][0-9]{7,14}"); recipientInput.setAttribute("maxlength", "15");
  }
}
recipientTypeSelect?.addEventListener("change", updateRecipientHint);
updateRecipientHint();

$("#bot-message-form")?.addEventListener("submit", async e => {
  e.preventDefault();
  if (!["owner", "admin"].includes(role)) { msg("#bot-message-status", "Login sebagai Owner atau Admin untuk menggunakan bot."); return; }
  const f = new FormData(e.currentTarget);
  const recipientType = String(f.get("recipient_type") || "private");
  const rawRecipient = String(f.get("recipient") || "").trim();
  const recipient = recipientType === "private" ? rawRecipient.replace(/\D/g, "") : rawRecipient;
  const message = String(f.get("message") || "").trim();
  if (recipientType === "private" && !/^[1-9][0-9]{7,14}$/.test(recipient)) { msg("#bot-message-status", "Nomor harus format internasional, contoh 62812xxxxxxx."); return; }
  if (recipientType === "group" && !/^(?:\d{5,30}|\d{5,30}-\d{5,30})@g\.us$/.test(recipient)) { msg("#bot-message-status", "JID grup tidak valid. Gunakan format angka@g.us atau angka-angka@g.us."); return; }
  if (recipientType === "channel" && !/^[A-Za-z0-9._-]{5,100}@newsletter$/.test(recipient)) { msg("#bot-message-status", "JID channel tidak valid dan harus berakhiran @newsletter."); return; }
  if (!message || message.length > 4000) { msg("#bot-message-status", "Pesan wajib diisi (maksimal 4000 karakter)."); return; }
  const { error } = await db.from("whatsapp_message_queue").insert({ recipient, recipient_type: recipientType, message });
  msg("#bot-message-status", error ? `Gagal: ${error.message}` : `Pesan ${recipientType === "private" ? "pribadi" : recipientType === "group" ? "grup" : "channel"} masuk antrean.`);
  if (!error) { e.currentTarget.reset(); updateRecipientHint(); loadBotMessageHistory(); }
});
$("#bot-message-refresh")?.addEventListener("click", loadBotMessageHistory);


const upSwType = $("#up-sw-media-type");
const upSwFileLabel = $("#up-sw-file-label");
const upSwFile = $("#up-sw-file");
const upSwPreview = $("#up-sw-preview");
function updateUpSwInput() {
  if (!upSwType || !upSwFileLabel || !upSwFile) return;
  const type = upSwType.value;
  upSwFileLabel.classList.toggle("hidden", type === "text");
  upSwFile.accept = type === "image" ? "image/*" : type === "video" ? "video/*" : "";
  upSwFile.required = type !== "text";
  upSwFile.value = "";
  upSwPreview.classList.add("hidden");
  upSwPreview.replaceChildren();
}
upSwType?.addEventListener("change", updateUpSwInput);
upSwFile?.addEventListener("change", () => {
  const file = upSwFile.files?.[0];
  if (!file || !upSwPreview) return;
  const url = URL.createObjectURL(file);
  upSwPreview.replaceChildren();
  const el = document.createElement(file.type.startsWith("video/") ? "video" : "img");
  el.src = url; el.controls = el.tagName === "VIDEO"; el.style.maxWidth = "100%"; el.style.maxHeight = "280px";
  upSwPreview.append(el); upSwPreview.classList.remove("hidden");
});
async function loadUpSwHistory() {
  if (role !== "owner" || !db) return;
  const box = $("#up-sw-history"); if (!box) return;
  const { data, error } = await db.from("whatsapp_status_queue").select("id,media_type,caption,status,created_at,processed_at,error").order("created_at", { ascending: false }).limit(20);
  if (error) { box.innerHTML = '<p class="muted">Jalankan whatsapp-status-queue-migration.sql terlebih dahulu.</p>'; return; }
  box.innerHTML = (data || []).map(r => item(`${String(r.status).toUpperCase()} · ${String(r.media_type).toUpperCase()}`, `${new Date(r.created_at).toLocaleString("id-ID")} · ${r.caption || "(tanpa teks)"}${r.error ? ` · Error: ${r.error}` : ""}`, r.status === "queued" || r.status === "failed" ? `<button class="btn danger" data-delete-upsw="${r.id}">Hapus</button>` : "")).join("") || '<p class="muted">Belum ada unggahan status.';
  all("[data-delete-upsw]").forEach(b => b.addEventListener("click", async () => {
    if (role !== "owner") return;
    const { error } = await db.from("whatsapp_status_queue").delete().eq("id", Number(b.dataset.deleteUpsw));
    msg("#up-sw-status", error ? `Gagal menghapus: ${error.message}` : "Item antrean dihapus.");
    loadUpSwHistory();
  }));
}
$("#up-sw-refresh")?.addEventListener("click", loadUpSwHistory);
$("#up-sw-form")?.addEventListener("submit", async e => {
  e.preventDefault();
  const form = e.currentTarget;
  if (role !== "owner" || !db) { msg("#up-sw-status", "Fitur ini hanya untuk Owner."); return; }
  const caption = String($("#up-sw-caption")?.value || "").trim();
  const mediaType = String(upSwType?.value || "text");
  const file = upSwFile?.files?.[0] || null;
  if (mediaType === "text" && !caption) { msg("#up-sw-status", "Tulis teks status terlebih dahulu."); return; }
  if (mediaType !== "text" && !file) { msg("#up-sw-status", "Pilih file media terlebih dahulu."); return; }
  if (mediaType === "image" && !file.type.startsWith("image/")) { msg("#up-sw-status", "File harus berupa foto."); return; }
  if (mediaType === "video" && !file.type.startsWith("video/")) { msg("#up-sw-status", "File harus berupa video."); return; }
  const maxBytes = mediaType === "video" ? 64 * 1024 * 1024 : 12 * 1024 * 1024;
  if (file && file.size > maxBytes) { msg("#up-sw-status", `Ukuran file melebihi batas ${mediaType === "video" ? "64 MB" : "12 MB"}.`); return; }
  const submit = e.currentTarget.querySelector('button[type="submit"]');
  submit.disabled = true; msg("#up-sw-status", "Menyiapkan unggahan…");
  try {
    let mediaPath = null;
    if (file) {
      const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
      mediaPath = `${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await db.storage.from("whatsapp-status").upload(mediaPath, file, { upsert: false, contentType: file.type });
      if (uploadError) throw uploadError;
    }
    const { error } = await db.from("whatsapp_status_queue").insert({ media_type: mediaType, caption: caption || null, media_path: mediaPath });
    if (error) {
      if (mediaPath) await db.storage.from("whatsapp-status").remove([mediaPath]);
      throw error;
    }
    msg("#up-sw-status", "Berhasil masuk antrean. Bot akan mengunggah saat WhatsApp terhubung.");
    form.reset(); updateUpSwInput(); loadUpSwHistory();
  } catch (err) {
    msg("#up-sw-status", `Gagal: ${err.message || err}`);
  } finally { submit.disabled = false; }
});

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
  all(".staff-bot-access").forEach(e => e.classList.toggle("hidden", !["owner", "admin"].includes(role)));
  loadChannels();
  if (role === "owner") { loadBackgroundSettings(); loadTikTokVerifications(); loadBotPresence(); loadUpSwHistory(); loadBorderMaker(); }
  if (["owner", "admin"].includes(role)) loadBotMessageHistory();

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
      `${m.email || "Tanpa email"} · ${m.role === "admin" ? "Admin (tetap member komunitas)" : m.role} · ${m.approval_status || "approved"} · ${m.user_id}`,
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
      `${m.email || "Tanpa email"} · Hak akses: ${m.role} · Tetap akun member komunitas`,
      role === "owner" && m.role === "admin"
        ? `<button class="btn danger" data-demote="${esc(m.user_id)}">Jadikan Member</button>`
        : ""
    )).join("") || '<p class="muted">Belum ada Admin tambahan.</p>';

  all("#staff-list [data-demote]").forEach(b => b.addEventListener("click", async () => {
    if (!confirm("Cabut hak Admin? Akun dan profil komunitasnya tetap ada sebagai Member.")) return;
    const { error } = await db.from("staff_profiles")
      .update({ role: "member" }).eq("user_id", b.dataset.demote);
    msg("#member-status", error ? "Gagal mengubah peran: " + error.message : "Hak Admin dicabut. Akun tetap menjadi Member komunitas.");
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

async function loadChannels() {
  const box = $("#channels-admin-list");
  if (!box || !db || !["owner", "admin"].includes(role)) return;
  const { data, error } = await db.from("community_channels").select("id,name,platform,description,is_published,link_url").order("created_at", { ascending: false });
  if (error) { box.innerHTML = '<p class="muted">Jalankan channel-migration.sql di Supabase terlebih dahulu.</p>'; msg("#channel-status", error.message); return; }
  box.innerHTML = (data || []).map(c => item(c.name, `${c.platform === "whatsapp" ? "WhatsApp Channel" : "Channel Website"} · ${c.is_published ? "Publik" : "Draft"}`, `<button class="btn danger" data-channel-delete="${c.id}">Hapus</button>`)).join("") || '<p class="muted">Belum ada channel.</p>';
  all("#channels-admin-list [data-channel-delete]").forEach(b => b.addEventListener("click", async () => {
    if (!confirm("Hapus channel ini?")) return;
    const { error } = await db.from("community_channels").delete().eq("id", Number(b.dataset.channelDelete));
    msg("#channel-status", error ? "Gagal menghapus: " + error.message : "Channel dihapus.");
    loadChannels();
  }));
}

$("#channel-form")?.addEventListener("submit", async e => {
  e.preventDefault();
  if (!db || !["owner", "admin"].includes(role)) { msg("#channel-status", "Login sebagai Owner/Admin terlebih dahulu."); return; }
  const f = new FormData(e.currentTarget);
  const platform = String(f.get("platform"));
  const link = String(f.get("link_url") || "").trim();
  if (platform === "whatsapp" && !/^https:\/\/(www\.)?whatsapp\.com\/channel\/[A-Za-z0-9]+\/?$/.test(link)) {
    msg("#channel-status", "Masukkan link WhatsApp Channel yang valid (whatsapp.com/channel/...)."); return;
  }
  const image = String(f.get("image_url") || "").trim();
  if (image && !/^https:\/\//i.test(image)) { msg("#channel-status", "URL foto harus menggunakan HTTPS."); return; }
  const { data: userData } = await db.auth.getUser();
  const { error } = await db.from("community_channels").insert({ name: String(f.get("name")).trim(), platform, link_url: platform === "whatsapp" ? link : null, image_url: image || null, description: String(f.get("description") || "").trim(), announcement: String(f.get("announcement") || "").trim(), is_published: f.has("is_published"), created_by: userData?.user?.id || null });
  msg("#channel-status", error ? "Gagal menyimpan channel: " + error.message : "Channel berhasil disimpan.");
  if (!error) { e.currentTarget.reset(); loadChannels(); }
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


const backgroundForms = all(".background-form");
function mediaType(file, selected) { return selected === "auto" ? (file.type.startsWith("video/") ? "video" : "image") : selected; }
function renderBackgroundPreview(preview, url, type) {
  if (!preview) return;
  preview.innerHTML = type === "video" ? `<video controls playsinline src="${url}"></video>` : `<img alt="Pratinjau background saat ini" src="${url}">`;
}
async function loadBackgroundSettings() {
  if (!db) return;
  for (const form of backgroundForms) {
    const key = form.dataset.backgroundKey;
    const preview = form.querySelector(".background-preview");
    const status = form.querySelector(".background-status");
    const { data, error } = await db.from("site_settings").select("value").eq("key", key).maybeSingle();
    if (error) { if (status) status.textContent = "Gagal memuat pengaturan: " + error.message; continue; }
    if (data?.value?.url) renderBackgroundPreview(preview, data.value.url, data.value.type);
    else if (preview) preview.textContent = "Belum ada background khusus.";
  }
}
backgroundForms.forEach(form => {
  const fileInput = form.querySelector(".background-file");
  const preview = form.querySelector(".background-preview");
  const status = form.querySelector(".background-status");
  fileInput?.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) { preview.textContent = "Belum ada pratinjau."; return; }
    if (file.size > 50 * 1024 * 1024) { preview.textContent = "File terlalu besar. Maksimal 50 MB."; return; }
    const url = URL.createObjectURL(file);
    renderBackgroundPreview(preview, url, mediaType(file, form.querySelector(".background-type").value));
  });
  form.addEventListener("submit", async e => {
    e.preventDefault();
    if (role !== "owner") { status.textContent = "Hanya Owner yang dapat mengganti background."; return; }
    const file = fileInput?.files?.[0]; if (!file) { status.textContent = "Pilih foto atau video terlebih dahulu."; return; }
    if (file.size > 50 * 1024 * 1024) { status.textContent = "Ukuran file maksimal 50 MB."; return; }
    if (!(file.type.startsWith("image/") || ["video/mp4", "video/webm", "video/ogg"].includes(file.type))) { status.textContent = "Format didukung: foto umum atau video MP4, WebM, OGG."; return; }
    status.textContent = "Mengunggah media…";
    const { data: { user } } = await db.auth.getUser();
    const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `background/${user.id}/${form.dataset.backgroundKey}/${Date.now()}.${ext}`;
    const { error: uploadError } = await db.storage.from("community-media").upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) { status.textContent = "Upload gagal: " + uploadError.message + ". Pastikan bucket dan policy Storage sudah dibuat."; return; }
    const { data: publicData } = db.storage.from("community-media").getPublicUrl(path);
    const type = mediaType(file, form.querySelector(".background-type").value);
    const { error } = await db.from("site_settings").upsert({ key: form.dataset.backgroundKey, value: { url: publicData.publicUrl, type } }, { onConflict: "key" });
    if (error) { status.textContent = "Media terunggah, tetapi pengaturan gagal disimpan: " + error.message; return; }
    renderBackgroundPreview(preview, publicData.publicUrl, type);
    status.textContent = `${form.dataset.backgroundLabel} berhasil diterapkan. Muat ulang website untuk melihat hasilnya.`;
    fileInput.value = "";
  });
  form.querySelector(".background-reset")?.addEventListener("click", async () => {
    if (role !== "owner") { status.textContent = "Hanya Owner yang dapat menghapus background."; return; }
    const { error } = await db.from("site_settings").delete().eq("key", form.dataset.backgroundKey);
    status.textContent = error ? "Gagal menghapus: " + error.message : `${form.dataset.backgroundLabel} khusus dihapus. Website kembali ke background bawaan.`;
    if (!error) preview.textContent = "Belum ada background khusus.";
  });
});

// Intro website: Owner memilih video langsung dari perangkat, lalu mengunggahnya ke Supabase Storage.
async function loadSiteIntroSettings() {
  if (!db) return;
  const status = $("#site-intro-status");
  const { data, error } = await db.from("site_settings").select("value").eq("key", "site_intro").maybeSingle();
  if (error) { if (status) status.textContent = "Belum bisa membaca pengaturan. Pastikan site_settings dan migrasi intro sudah dibuat."; return; }
  const v = data?.value || {};
  if ($("#site-intro-enabled")) $("#site-intro-enabled").checked = v.enabled !== false;
  if ($("#site-intro-once")) $("#site-intro-once").checked = v.oncePerSession !== false;
  const current = $("#site-intro-current");
  if (current) current.textContent = v.url ? "Video intro tersimpan. Pilih file baru hanya jika ingin menggantinya." : "Belum ada video intro tersimpan.";
}
$("#site-intro-form")?.addEventListener("submit", async (e) => {
  e.preventDefault(); const status = $("#site-intro-status");
  if (role !== "owner") { status.textContent = "Hanya Owner yang dapat mengubah intro website."; return; }
  const file = $("#site-intro-file")?.files?.[0];
  if (!file) { status.textContent = "Pilih file video dari perangkat terlebih dahulu."; return; }
  if (file.size > 100 * 1024 * 1024) { status.textContent = "Video terlalu besar. Batas fitur ini 100 MB."; return; }
  if (!["video/mp4", "video/webm", "video/ogg"].includes(file.type) && !/\.(mp4|webm|ogg)$/i.test(file.name)) { status.textContent = "Format video harus MP4, WebM, atau OGG."; return; }
  status.textContent = "Mengunggah video ke penyimpanan…";
  const { data: { user } } = await db.auth.getUser();
  if (!user) { status.textContent = "Sesi Owner tidak ditemukan. Login kembali lalu coba lagi."; return; }
  const ext = (file.name.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `site-intro/${user.id}/${Date.now()}.${ext}`;
  const { error: uploadError } = await db.storage.from("community-media").upload(path, file, { upsert: true, contentType: file.type || "video/mp4", cacheControl: "3600" });
  if (uploadError) { status.textContent = "Upload gagal: " + uploadError.message + ". Periksa bucket community-media, policy Storage, batas ukuran file, dan kuota Supabase."; return; }
  const { data: publicData } = db.storage.from("community-media").getPublicUrl(path);
  const value = { url: publicData.publicUrl, enabled: $("#site-intro-enabled").checked, oncePerSession: $("#site-intro-once").checked, type: "video", fileName: file.name, size: file.size };
  status.textContent = "Video berhasil diunggah. Menyimpan pengaturan…";
  const { error } = await db.from("site_settings").upsert({ key: "site_intro", value }, { onConflict: "key" });
  if (error) { status.textContent = "Video terunggah, tetapi pengaturan gagal disimpan: " + error.message; return; }
  const current = $("#site-intro-current"); if (current) current.textContent = `Video tersimpan: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB).`;
  status.textContent = "Intro berhasil diunggah dan disimpan. Website akan memakai video ini setelah dimuat ulang.";
  $("#site-intro-file").value = "";
});
loadSiteIntroSettings();

if (!configured) {
  msg("#login-status", "Konfigurasi Supabase belum diisi. Buka config.js.");
}

refresh();



// Ready-made effect presets for the Owner border maker. These are combinations of existing animation, color and glow controls.
const BORDER_EFFECT_PRESETS = [
  {id:'galaxy-purple',name:'🌌 Galaksi Ungu',animation:'galaxy-swirl',color:'#b65cff',width:9,brightness:115,speed:68,desc:'Pusaran kosmik ungu dengan cincin cahaya tebal.'},
  {id:'rainbow-prism',name:'🌈 Prisma Pelangi',animation:'rainbow-orbit',color:'#ff4fd8',width:8,brightness:120,speed:80,desc:'Orbit pelangi terang dengan spektrum warna.'},
  {id:'star-queen',name:'👑 Ratu Bintang',animation:'starfall',color:'#fff0a8',width:7,brightness:125,speed:55,desc:'Bintang jatuh dan cahaya keemasan.'},
  {id:'diamond-luxe',name:'💎 Berlian Mewah',animation:'diamond-glint',color:'#c9f6ff',width:6,brightness:145,speed:45,desc:'Kilau berlian putih kebiruan.'},
  {id:'neon-cyber',name:'🧬 Cyber Neon',animation:'liquid-neon',color:'#00f5ff',width:10,brightness:135,speed:75,desc:'Neon cair cyan untuk tampilan futuristik.'},
  {id:'pink-glitter',name:'💗 Glitter Sakura',animation:'pink-glitter',color:'#ff72c6',width:7,brightness:125,speed:60,desc:'Glitter merah muda yang berkilau.'},
  {id:'gold-royal',name:'✨ Emas Kerajaan',animation:'golden-glitter',color:'#ffd36b',width:8,brightness:130,speed:48,desc:'Cahaya emas elegan dan berkilau.'},
  {id:'silver-moon',name:'🌙 Perak Bulan',animation:'moonlight',color:'#dceaff',width:6,brightness:110,speed:35,desc:'Cahaya bulan lembut berwarna perak.'},
  {id:'blue-flame',name:'🔥 Api Biru',animation:'blue-flame',color:'#00cfff',width:9,brightness:140,speed:88,desc:'Cahaya api biru dengan denyut cepat.'},
  {id:'purple-flame',name:'🔥 Api Ungu',animation:'purple-flame',color:'#d04dff',width:9,brightness:140,speed:82,desc:'Api ungu terang dengan aura magis.'},
  {id:'electric-storm',name:'⚡ Badai Listrik',animation:'electric-arcs',color:'#83f7ff',width:7,brightness:145,speed:95,desc:'Busur listrik cepat dan tajam.'},
  {id:'frost-crystal',name:'❄️ Kristal Frost',animation:'crystal-shine',color:'#a8f2ff',width:6,brightness:125,speed:42,desc:'Kristal es dengan kilau dingin.'},
  {id:'aurora-dream',name:'🌌 Aurora Dream',animation:'aurora',color:'#5effcf',width:10,brightness:115,speed:38,desc:'Aura hijau toska dengan gerak lembut.'},
  {id:'meteor-rush',name:'☄️ Hujan Meteor',animation:'meteor-shower',color:'#ffad66',width:7,brightness:130,speed:90,desc:'Meteor dan percikan hangat.'},
  {id:'magic-witch',name:'🪄 Sihir Penyihir',animation:'magic-runes',color:'#bd75ff',width:7,brightness:120,speed:50,desc:'Rune sihir berputar dengan aura violet.'},
  {id:'cosmic-blue',name:'🪐 Kosmik Biru',animation:'cosmic',color:'#619bff',width:8,brightness:125,speed:62,desc:'Orbit kosmik biru dengan cahaya bintang.'},
  {id:'red-dragon',name:'🐉 Naga Crimson',animation:'electric',color:'#ff3158',width:9,brightness:135,speed:85,desc:'Aura merah crimson dengan kilatan.'},
  {id:'emerald',name:'💚 Zamrud',animation:'spectrum',color:'#42ff9b',width:7,brightness:120,speed:55,desc:'Cahaya zamrud dengan spektrum bergerak.'},
  {id:'sunrise',name:'🌅 Fajar Emas',animation:'sunrise-glow',color:'#ff9b43',width:8,brightness:125,speed:40,desc:'Cahaya matahari hangat dan berdenyut.'},
  {id:'ocean',name:'🌊 Samudra Neon',animation:'underwater',color:'#25d9ff',width:9,brightness:120,speed:58,desc:'Gelombang biru seperti cahaya bawah laut.'},
  {id:'laser-scan',name:'🔴 Laser Scanner',animation:'laser-sweep',color:'#ff355e',width:6,brightness:140,speed:92,desc:'Sinar laser menyapu tepi border.'},
  {id:'holo',name:'👾 Hologram',animation:'hologram',color:'#6dfcff',width:6,brightness:125,speed:65,desc:'Kilau hologram futuristik.'},
  {id:'stardust',name:'✨ Debu Bintang',animation:'stardust',color:'#e5caff',width:6,brightness:115,speed:50,desc:'Partikel bintang halus.'},
  {id:'fireflies',name:'🌟 Kunang-kunang',animation:'fireflies',color:'#eaff8a',width:5,brightness:115,speed:36,desc:'Titik cahaya kecil berkelap-kelip.'},
  {id:'vortex',name:'🌀 Vortex Energi',animation:'vortex',color:'#fa58ff',width:10,brightness:135,speed:90,desc:'Pusaran energi berputar cepat.'},
  {id:'double-orbit',name:'🪐 Orbit Ganda',animation:'double-rotate',color:'#a58bff',width:8,brightness:120,speed:65,desc:'Dua cincin bergerak berlawanan.'},
  {id:'pink-candy',name:'🍬 Candy Pop',animation:'candy-cycle',color:'#ff78cf',width:8,brightness:130,speed:72,desc:'Warna permen yang berganti.'},
  {id:'plasma',name:'🔮 Plasma',animation:'plasma',color:'#ff54db',width:10,brightness:135,speed:75,desc:'Plasma neon dengan gelombang kuat.'},
  {id:'soft-pulse',name:'💜 Aura Lembut',animation:'breathing',color:'#b78cff',width:5,brightness:85,speed:30,desc:'Cahaya lembut yang bernapas.'},
  {id:'rainbow-pulse',name:'🌈 Denyut Pelangi',animation:'rainbow-pulse',color:'#ff55dc',width:8,brightness:130,speed:70,desc:'Cincin pelangi berdenyut.'},
  {id:'constellation',name:'🌠 Konstelasi',animation:'constellation',color:'#b5d5ff',width:6,brightness:115,speed:40,desc:'Pola bintang seperti rasi konstelasi.'},
  {id:'no-motion',name:'🕊️ Elegan Tanpa Gerak',animation:'none',color:'#c6a2ff',width:5,brightness:75,speed:0,desc:'Border statis dengan cahaya tipis.'}
];
const presetSelect = document.querySelector('#border-effect-preset');
if (presetSelect) presetSelect.innerHTML = '<option value="">— Pilih preset efek —</option>' + BORDER_EFFECT_PRESETS.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
function applyBorderPreset() {
  const preset = BORDER_EFFECT_PRESETS.find(p => p.id === presetSelect?.value);
  if (!preset || !borderForm) { msg('#border-maker-status', 'Pilih preset efek terlebih dahulu.'); return; }
  borderForm.elements.animation.value = preset.animation;
  borderForm.elements.glow_color.value = preset.color;
  borderForm.elements.glow_width.value = preset.width;
  borderForm.elements.glow_brightness.value = preset.brightness;
  borderForm.elements.glow_speed.value = preset.speed;
  document.querySelector('#border-thickness-value').textContent = preset.width;
  document.querySelector('#border-brightness-value').textContent = preset.brightness + '%';
  document.querySelector('#border-speed-value').textContent = preset.speed + '%';
  document.querySelector('#border-preset-description').textContent = preset.desc;
  borderPreviewUpdate(borderDraftUrl);
  msg('#border-maker-status', `Preset “${preset.name}” diterapkan. Unggah/pilih gambar border, lalu simpan.`);
}
document.querySelector('#border-preset-apply')?.addEventListener('click', applyBorderPreset);
presetSelect?.addEventListener('change', () => { const p = BORDER_EFFECT_PRESETS.find(x => x.id === presetSelect.value); document.querySelector('#border-preset-description').textContent = p ? p.desc : 'Pilih preset untuk melihat efek dan pengaturan yang akan diterapkan.'; });

// Owner-only custom avatar border manager
let borderDraftUrl = "", borderDraftPath = "", borderRows = [];
const borderForm = $("#border-maker-form");
const borderPreview = $("#border-art-preview");
function borderPreviewUpdate(url) {
  if (!borderPreview) return;
  const f = new FormData(borderForm);
  borderPreview.style.setProperty("--border-glow", String(f.get("glow_color") || "#b65cff"));
  borderPreview.dataset.animation = String(f.get("animation") || "pulse");
  borderPreview.innerHTML = url ? `<img src="${esc(url)}" alt="Pratinjau border">` : "<span>Pratinjau border</span>";
  const width = Number(f.get("glow_width") || 0), bright = Number(f.get("glow_brightness") || 0);
  const img = borderPreview.querySelector("img");
  if (img) img.style.filter = `brightness(${0.5 + bright / 100}) drop-shadow(0 0 ${width}px ${String(f.get("glow_color") || "#b65cff")})`;
}
["#border-thickness", "#border-brightness", "#border-speed"].forEach(sel => $(sel)?.addEventListener("input", () => {
  const v = $(sel).value;
  const out = sel === "#border-thickness" ? "#border-thickness-value" : sel === "#border-brightness" ? "#border-brightness-value" : "#border-speed-value";
  $(out).textContent = sel === "#border-thickness" ? v : `${v}%`;
  borderPreviewUpdate(borderDraftUrl);
}));
["animation", "glow_color"].forEach(n => borderForm?.elements[n]?.addEventListener("input", () => borderPreviewUpdate(borderDraftUrl)));
$("#border-art-file")?.addEventListener("change", e => {
  const file = e.target.files?.[0]; if (!file) return;
  if (!file.type.startsWith("image/")) { msg("#border-maker-status", "Pilih file gambar PNG/WebP."); return; }
  if (borderDraftUrl.startsWith("blob:")) URL.revokeObjectURL(borderDraftUrl);
  borderDraftUrl = URL.createObjectURL(file); borderDraftPath = ""; borderPreviewUpdate(borderDraftUrl);
});
async function loadBorderMaker() {
  if (role !== "owner" || !db) return;
  const box = $("#border-maker-list"); if (!box) return;
  const { data, error } = await db.from("custom_avatar_borders").select("*").order("created_at", { ascending: false });
  if (error) { box.innerHTML = `<p class="muted">Belum bisa membaca daftar border: ${esc(error.message)}. Jalankan border-maker-migration.sql.</p>`; return; }
  borderRows = data || [];
  box.innerHTML = borderRows.map(r => item(r.name, `${Number(r.price).toLocaleString("id-ID")} saldo · ${r.is_active ? "Aktif di toko" : "Disembunyikan"} · Efek ${r.animation}`, `<button class="btn secondary" data-border-edit="${esc(r.id)}">Edit</button><button class="btn danger" data-border-delete="${esc(r.id)}">Hapus</button>`)).join("") || '<p class="muted">Belum ada border buatan Owner.</p>';
  all("[data-border-edit]").forEach(b => b.addEventListener("click", () => {
    const r = borderRows.find(x => x.id === b.dataset.borderEdit); if (!r) return;
    borderForm.elements.id.value = r.id; borderForm.elements.name.value = r.name; borderForm.elements.price.value = r.price;
    borderForm.elements.animation.value = r.animation || "pulse"; borderForm.elements.glow_color.value = r.glow_color || "#b65cff";
    borderForm.elements.glow_width.value = r.glow_width ?? 6; borderForm.elements.glow_brightness.value = r.glow_brightness ?? 70; borderForm.elements.glow_speed.value = r.glow_speed ?? 50; borderForm.elements.is_active.checked = !!r.is_active;
    borderDraftUrl = r.image_url; borderDraftPath = r.storage_path || ""; $("#border-thickness-value").textContent = borderForm.elements.glow_width.value; $("#border-brightness-value").textContent = borderForm.elements.glow_brightness.value + "%"; $("#border-speed-value").textContent = borderForm.elements.glow_speed.value + "%"; borderPreviewUpdate(borderDraftUrl); msg("#border-maker-status", "Mode edit: ubah yang diperlukan lalu tekan Simpan border.");
  }));
  all("[data-border-delete]").forEach(b => b.addEventListener("click", async () => {
    if (!confirm("Hapus border ini? Item yang sudah dimiliki member tidak akan otomatis terhapus dari koleksi.")) return;
    const r = borderRows.find(x => x.id === b.dataset.borderDelete); if (!r) return;
    const { error } = await db.from("custom_avatar_borders").delete().eq("id", r.id);
    if (!error && r.shop_item_id) await db.from("wallet_shop_items").update({ is_active: false }).eq("id", r.shop_item_id);
    if (error) { msg("#border-maker-status", "Gagal menghapus: " + error.message); return; }
    if (r.storage_path) await db.storage.from("community-media").remove([r.storage_path]);
    msg("#border-maker-status", "Border dihapus dari katalog Owner."); await loadBorderMaker();
  }));
}
$("#border-maker-reset")?.addEventListener("click", () => { borderForm.reset(); borderForm.elements.id.value = ""; borderDraftUrl = ""; borderDraftPath = ""; $("#border-thickness-value").textContent = "6"; $("#border-brightness-value").textContent = "70%"; $("#border-speed-value").textContent = "50%"; borderPreviewUpdate(""); msg("#border-maker-status", "Form siap untuk border baru."); });
borderForm?.addEventListener("submit", async e => {
  e.preventDefault(); if (role !== "owner" || !db) return;
  const f = new FormData(borderForm), name = String(f.get("name") || "").trim(), price = Number(f.get("price")), file = $("#border-art-file").files?.[0];
  if (!name || !Number.isSafeInteger(price) || price < 0) { msg("#border-maker-status", "Periksa nama dan harga border."); return; }
  if (!file && !borderDraftUrl) { msg("#border-maker-status", "Upload gambar border terlebih dahulu."); return; }
  msg("#border-maker-status", "Menyimpan border…");
  let imageUrl = borderDraftUrl, storagePath = borderDraftPath;
  if (file) {
    const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    storagePath = `custom-borders/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await db.storage.from("community-media").upload(storagePath, file, { upsert: false, contentType: file.type });
    if (uploadError) { msg("#border-maker-status", "Upload gagal: " + uploadError.message + ". Pastikan bucket community-media menerima upload Owner."); return; }
    imageUrl = db.storage.from("community-media").getPublicUrl(storagePath).data.publicUrl;
  }
  const row = { name, price, image_url: imageUrl, storage_path: storagePath || null, animation: String(f.get("animation")), glow_color: String(f.get("glow_color")), glow_width: Number(f.get("glow_width")), glow_brightness: Number(f.get("glow_brightness")), glow_speed: Number(f.get("glow_speed")), is_active: f.get("is_active") === "on", updated_at: new Date().toISOString() };
  const id = String(f.get("id") || "");
  const existing = borderRows.find(x => x.id === id);
  const shopRow = { name, description: `Border buatan Owner · efek ${row.animation}`, category: "frame", icon: imageUrl, price, is_active: row.is_active };
  let shopItemId = existing?.shop_item_id || null;
  if (shopItemId) {
    const { error: shopError } = await db.from("wallet_shop_items").update(shopRow).eq("id", shopItemId);
    if (shopError) { msg("#border-maker-status", "Gagal memperbarui item toko: " + shopError.message); return; }
  } else {
    const { data: shopItem, error: shopError } = await db.from("wallet_shop_items").insert(shopRow).select("id").single();
    if (shopError) { msg("#border-maker-status", "Gambar sudah diunggah, tetapi item toko gagal dibuat: " + shopError.message); return; }
    shopItemId = shopItem.id;
  }
  row.shop_item_id = shopItemId;
  const result = id ? await db.from("custom_avatar_borders").update(row).eq("id", id) : await db.from("custom_avatar_borders").insert(row);
  if (result.error) { msg("#border-maker-status", "Item toko tersimpan, tetapi data efek gagal: " + result.error.message); return; }
  msg("#border-maker-status", "Border tersimpan dan itemnya disinkronkan ke toko. Efek lanjutan pada profil/leaderboard memerlukan renderer border dinamis."); borderForm.reset(); borderForm.elements.id.value = ""; borderDraftUrl = ""; borderDraftPath = ""; borderPreviewUpdate(""); await loadBorderMaker();
});

setInterval(() => { if (role === "owner") { loadBotPresence(); loadBorderMaker(); } loadUpSwHistory(); }, 15000);


async function loadResetPointMembers() {
  if (role !== "owner" || !db) return;
  const select = $("#reset-points-member");
  if (!select) return;
  select.innerHTML = '<option value="">Memuat member…</option>';
  const { data, error } = await db.from("staff_profiles")
    .select("user_id,display_name,role,approval_status")
    .order("display_name", { ascending: true });
  if (error) {
    select.innerHTML = '<option value="">Gagal memuat member</option>';
    msg("#reset-points-status", "Gagal memuat member: " + error.message);
    return;
  }
  const members = (data || []).filter(m => String(m.role || "").toLowerCase() !== "owner" && (m.approval_status || "approved") === "approved");
  select.innerHTML = '<option value="">Pilih member…</option>' + members.map(m =>
    `<option value="${esc(m.user_id)}">${esc(m.display_name || "Member")} · ${esc(m.user_id.slice(0, 8))}</option>`
  ).join("");
}
$("#reset-points-member")?.addEventListener("focus", loadResetPointMembers);
$("#reset-selected-points")?.addEventListener("click", async () => {
  if (role !== "owner" || !db) { msg("#reset-points-status", "Akses khusus Owner."); return; }
  const select = $("#reset-points-member");
  const uid = String(select?.value || "");
  if (!uid) { msg("#reset-points-status", "Pilih member terlebih dahulu."); return; }
  const label = select.selectedOptions[0]?.textContent || "member ini";
  if (!confirm(`Yakin reset poin leaderboard ${label} menjadi 0? Saldo dompet tidak berubah.`)) return;
  const button = $("#reset-selected-points");
  button.disabled = true;
  msg("#reset-points-status", "Mereset poin…");
  const { error } = await db.rpc("owner_reset_member_points", { p_user_id: uid });
  msg("#reset-points-status", error ? "Gagal reset: " + error.message : `Poin ${label} berhasil direset ke 0.`);
  if (!error) await loadResetPointMembers();
  button.disabled = false;
});
$("#reset-all-points")?.addEventListener("click", async () => {
  if (role !== "owner" || !db) { msg("#reset-points-status", "Akses khusus Owner."); return; }
  if (!confirm("PERINGATAN: Reset poin leaderboard SEMUA member menjadi 0 dan level kembali ke Level 1? Saldo dompet tidak berubah. Tindakan ini tidak bisa dibatalkan.")) return;
  if (!confirm("Konfirmasi terakhir: lanjutkan reset poin semua member?")) return;
  const button = $("#reset-all-points");
  button.disabled = true;
  msg("#reset-points-status", "Mereset poin semua member…");
  const { data, error } = await db.rpc("owner_reset_all_member_points");
  msg("#reset-points-status", error ? "Gagal reset: " + error.message : `Reset berhasil. ${Number(data) || 0} profil member direset.`);
  if (!error) await loadResetPointMembers();
  button.disabled = false;
});
