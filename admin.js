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
  if (role === "owner") { loadBackgroundSettings(); loadTikTokVerifications(); loadBotPresence(); loadUpSwHistory(); }
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

setInterval(() => { if (role === "owner") loadBotPresence(); loadUpSwHistory(); }, 15000);


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
