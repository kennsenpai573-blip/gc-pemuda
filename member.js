import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
const $ = s => document.querySelector(s);
$("#year").textContent = new Date().getFullYear();
const configured = SUPABASE_URL.startsWith("https://") && !SUPABASE_URL.includes("PROJECT_ID") && !SUPABASE_ANON_KEY.includes("PASTE_");
const db = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
let currentUser = null;
let chatProfiles = [];
let selectedChatUser = null;
let chatPollTimer = null;
let loadingMessages = false;
function say(selector, text) { $(selector).textContent = text || ""; }
function dateLabel(value) { if (!value) return "Belum tersedia"; const d = new Date(value); return Number.isNaN(d.getTime()) ? "Belum tersedia" : d.toLocaleDateString("id-ID", {day:"numeric", month:"long", year:"numeric"}); }
function showLogin(message="") { $("#login-panel").classList.remove("hidden"); $("#dashboard").classList.add("hidden"); say("#login-status", message); }
function showDashboard() { $("#login-panel").classList.add("hidden"); $("#dashboard").classList.remove("hidden"); }
async function loadDashboard(user) {
  if (!db || !user) { showLogin(); return; }
  const { data: profile, error } = await db.from("staff_profiles").select("user_id,display_name,email,role,created_at").eq("user_id", user.id).maybeSingle();
  if (error) { showLogin("Gagal memuat profil: " + error.message); return; }
  if (!profile) { showLogin("Akun berhasil masuk, tetapi profil member belum ditemukan. Pastikan migrasi member-registration-migration.sql sudah dijalankan di Supabase."); return; }
  const name = profile.display_name || user.user_metadata?.display_name || "Member";
  $("#profile-name").textContent = name;
  $("#summary-name").textContent = name;
  $("#summary-email").textContent = profile.email || user.email || "Tidak tersedia";
  $("#summary-date").textContent = dateLabel(profile.created_at);
  $("#profile-role").textContent = String(profile.role || "member").toUpperCase();
  // Staff should use the dedicated staff dashboard, but may still view their account here.
  if (["owner", "admin"].includes(profile.role)) {
    say("#dashboard-status", "Akunmu memiliki peran " + profile.role.toUpperCase() + ". Untuk pengelolaan website, buka ruang Owner/Admin.");
    if (!document.querySelector("#staff-link")) {
      const link = document.createElement("a"); link.id = "staff-link"; link.className = "btn primary"; link.href = "/admin.html"; link.textContent = "Buka Ruang Owner/Admin ↗"; $(".member-actions").prepend(link);
    }
  } else { say("#dashboard-status", "Akun member aktif. Selamat bergabung!"); }
  currentUser = user;
  showDashboard();
  await initializeChat(user);
}
if (!db) showLogin("Supabase belum dikonfigurasi. Periksa config.js.");
else {
  db.auth.getSession().then(({data}) => loadDashboard(data.session?.user));
  db.auth.onAuthStateChange((_event, session) => { if (session?.user) setTimeout(() => loadDashboard(session.user), 0); else showLogin(); });
}
$("#login-form").addEventListener("submit", async e => {
  e.preventDefault(); if (!db) { say("#login-status", "Supabase belum dikonfigurasi."); return; }
  const f = new FormData(e.currentTarget); const email = String(f.get("email") || "").trim().toLowerCase(); const password = String(f.get("password") || "");
  const button = e.currentTarget.querySelector("button[type=submit]"); button.disabled = true; button.textContent = "Memeriksa akun…"; say("#login-status", "");
  const {data, error} = await db.auth.signInWithPassword({email, password});
  button.disabled = false; button.textContent = "Masuk ke Dashboard ↗";
  if (error) { say("#login-status", "Login gagal: periksa email, password, atau konfirmasi email akunmu."); return; }
  e.currentTarget.reset(); await loadDashboard(data.user);
});
function roleLabel(role) {
  const roles = { owner: "Owner", admin: "Admin", member: "Member" };
  return roles[String(role || "member").toLowerCase()] || "Member";
}
function initials(name) {
  return String(name || "M").trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase() || "M";
}
function timeLabel(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString("id-ID", {hour:"2-digit", minute:"2-digit"});
}
function clearChatPolling() {
  if (chatPollTimer) clearInterval(chatPollTimer);
  chatPollTimer = null;
}
async function initializeChat(user) {
  clearChatPolling();
  selectedChatUser = null;
  chatProfiles = [];
  if (!db || !user) return;
  const contacts = $("#chat-contacts");
  if (!contacts) return;
  contacts.innerHTML = '<p class="muted">Memuat daftar member…</p>';
  const { data, error } = await db.from("chat_member_directory").select("user_id,display_name,role").order("display_name", {ascending:true});
  if (error) {
    contacts.innerHTML = '<p class="chat-contact-empty">Chat belum aktif. Jalankan file <b>member-chat-migration.sql</b> di Supabase SQL Editor, lalu muat ulang halaman.</p>';
    return;
  }
  chatProfiles = data || [];
  renderChatContacts();
  $("#chat-search").oninput = renderChatContacts;
  if (chatProfiles.filter(profile => profile.user_id !== user.id).length === 0) {
    contacts.innerHTML = '<p class="chat-contact-empty">Belum ada akun member lain. Chat akan muncul setelah orang lain mendaftar.</p>';
  }
}
function renderChatContacts() {
  const contacts = $("#chat-contacts");
  if (!contacts || !currentUser) return;
  const query = String($("#chat-search")?.value || "").trim().toLocaleLowerCase("id-ID");
  const list = chatProfiles.filter(profile => profile.user_id !== currentUser.id && String(profile.display_name || "Member").toLocaleLowerCase("id-ID").includes(query));
  contacts.replaceChildren();
  if (!list.length) {
    const empty = document.createElement("p"); empty.className = "chat-contact-empty"; empty.textContent = query ? "Nama member tidak ditemukan." : "Belum ada member lain untuk diajak chat."; contacts.append(empty); return;
  }
  list.forEach(profile => {
    const button = document.createElement("button"); button.type = "button"; button.className = "chat-contact" + (selectedChatUser?.user_id === profile.user_id ? " active" : "");
    const avatar = document.createElement("span"); avatar.className = "chat-contact-avatar"; avatar.textContent = initials(profile.display_name);
    const copy = document.createElement("span"); copy.className = "chat-contact-copy";
    const name = document.createElement("strong"); name.textContent = profile.display_name || "Member";
    const role = document.createElement("small"); role.textContent = roleLabel(profile.role);
    copy.append(name, role); button.append(avatar, copy); button.addEventListener("click", () => openChat(profile)); contacts.append(button);
  });
}
async function openChat(profile) {
  selectedChatUser = profile;
  $("#chat-empty").classList.add("hidden");
  $("#chat-active").classList.remove("hidden");
  $("#chat-person-name").textContent = profile.display_name || "Member";
  $("#chat-person-role").textContent = roleLabel(profile.role).toUpperCase();
  $("#chat-person-avatar").textContent = initials(profile.display_name);
  say("#chat-status", "");
  renderChatContacts();
  await loadChatMessages();
  clearChatPolling();
  chatPollTimer = setInterval(() => { if (selectedChatUser && document.visibilityState !== "hidden") loadChatMessages(true); }, 5000);
  $("#chat-message-input").focus();
}
async function loadChatMessages(quiet=false) {
  if (!db || !currentUser || !selectedChatUser || loadingMessages) return;
  loadingMessages = true;
  const box = $("#chat-messages");
  const wasNearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  const {data, error} = await db.from("member_messages")
    .select("id,sender_id,recipient_id,body,created_at")
    .or(`and(sender_id.eq.${currentUser.id},recipient_id.eq.${selectedChatUser.user_id}),and(sender_id.eq.${selectedChatUser.user_id},recipient_id.eq.${currentUser.id})`)
    .order("created_at", {ascending:true}).limit(200);
  loadingMessages = false;
  if (error) { if (!quiet) say("#chat-status", "Gagal memuat chat. Pastikan member-chat-migration.sql sudah dijalankan."); return; }
  const oldLastId = box.lastElementChild?.dataset?.messageId || "";
  const newLastId = data?.[data.length - 1]?.id || "";
  if (oldLastId === newLastId && box.children.length === (data || []).length) return;
  box.replaceChildren();
  if (!data?.length) {
    const empty = document.createElement("p"); empty.className = "muted"; empty.textContent = "Belum ada pesan. Sapa dulu member ini!"; box.append(empty); return;
  }
  const profileById = new Map(chatProfiles.map(profile => [profile.user_id, profile]));
  data.forEach(message => {
    const mine = message.sender_id === currentUser.id;
    const sender = profileById.get(message.sender_id) || (mine ? {display_name: $("#profile-name").textContent, role: $("#profile-role").textContent.toLowerCase()} : selectedChatUser);
    const bubble = document.createElement("article"); bubble.className = "chat-message" + (mine ? " mine" : ""); bubble.dataset.messageId = message.id;
    const name = document.createElement("span"); name.className = "chat-message-name"; name.textContent = sender?.display_name || "Member";
    const role = document.createElement("span"); role.className = "chat-message-role"; role.textContent = roleLabel(sender?.role);
    const body = document.createElement("div"); body.className = "chat-message-body"; body.textContent = message.body;
    const time = document.createElement("time"); time.className = "chat-message-time"; time.textContent = timeLabel(message.created_at); time.dateTime = message.created_at;
    bubble.append(name, role, body, time); box.append(bubble);
  });
  if (wasNearBottom || !quiet) box.scrollTop = box.scrollHeight;
}
$("#chat-form")?.addEventListener("submit", async event => {
  event.preventDefault();
  if (!db || !currentUser || !selectedChatUser) { say("#chat-status", "Pilih member terlebih dahulu."); return; }
  const input = $("#chat-message-input"); const body = input.value.trim();
  if (!body) return;
  const button = event.currentTarget.querySelector("button[type=submit]"); button.disabled = true; say("#chat-status", "Mengirim pesan…");
  const {error} = await db.from("member_messages").insert({sender_id:currentUser.id, recipient_id:selectedChatUser.user_id, body});
  button.disabled = false;
  if (error) { say("#chat-status", "Pesan gagal dikirim. Periksa migrasi dan kebijakan Supabase."); return; }
  input.value = ""; say("#chat-status", ""); await loadChatMessages();
});
$("#logout").addEventListener("click", async () => { if (!db) return; const {error} = await db.auth.signOut(); if (error) say("#dashboard-status", "Gagal keluar: " + error.message); else { clearChatPolling(); currentUser = null; selectedChatUser = null; showLogin("Kamu sudah keluar dari akun."); } });
