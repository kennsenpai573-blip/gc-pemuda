import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const $ = s => document.querySelector(s);
$("#year").textContent = new Date().getFullYear();

const configured = SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("PROJECT_ID") &&
  !SUPABASE_ANON_KEY.includes("PASTE_");

const db = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

let currentUser = null;
let chatProfiles = [];
let selectedChatUser = null;
let chatPollTimer = null;
let loadingMessages = false;

function say(selector, text) {
  const element = $(selector);
  if (element) element.textContent = text || "";
}

function dateLabel(value) {
  if (!value) return "Belum tersedia";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "Belum tersedia"
    : d.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric"
      });
}

const tierSymbols = {"Warrior":"♜","Elite":"♞","Master":"♟","Grand Master":"⬟","Epic":"⬢","Legend":"♛","Mythic":"✦","Mythical Honor":"✧","Mythical Glory":"✹","Mythical Immortal":"✺"};

async function loadLeaderboard(myUserId) {
  const list = $("#leaderboard-list"); if (!list || !db) return;
  const { data, error } = await db.from("manual_leaderboard").select("rank,user_id,note,staff_profiles(display_name,role,avatar_url)").order("rank", { ascending: true });
  if (error) { list.innerHTML = '<p class="muted">Leaderboard belum tersedia. Owner perlu menyiapkan tabel manual leaderboard di Supabase.</p>'; say("#leaderboard-status", error.message); return; }
  const rows = (data || []).slice(0, 5);
  if (!rows.length) { list.innerHTML = '<p class="muted">Belum ada member yang dipilih Owner untuk leaderboard.</p>'; return; }
  const medals = {1:"🥇",2:"🥈",3:"🥉",4:"4",5:"5"};
  list.innerHTML = rows.map(row => { const p = row.staff_profiles || {}; return `<div class="leaderboard-row ${row.user_id === myUserId ? 'is-me' : ''}"><span class="leaderboard-rank">${medals[row.rank] || row.rank}</span><span class="leaderboard-row-shield">${row.rank <= 3 ? '✦' : '♜'}</span><div class="leaderboard-person"><strong>${safeText(p.display_name || 'Member')}</strong><small>${safeText(String(p.role || 'member').toUpperCase())}${row.note ? ' · ' + safeText(row.note) : ''}</small></div><strong class="leaderboard-score">TOP ${row.rank}</strong></div>`; }).join('');
}

function showLogin(message = "") {
  $("#login-panel")?.classList.remove("hidden");
  $("#dashboard")?.classList.add("hidden");
  say("#login-status", message);
}

function showDashboard() {
  $("#login-panel")?.classList.add("hidden");
  $("#dashboard")?.classList.remove("hidden");
}

async function loadDashboard(user) {
  if (!db || !user) {
    showLogin();
    return;
  }

  const { data: profile, error } = await db
    .from("staff_profiles")
    .select("user_id,display_name,email,role,approval_status,created_at,avatar_url")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    showLogin("Gagal memuat profil: " + error.message);
    return;
  }

  if (!profile) {
    showLogin(
      "Akun berhasil masuk, tetapi profil member belum ditemukan. Pastikan migrasi member-registration-migration.sql sudah dijalankan di Supabase."
    );
    return;
  }

  const approval = profile.approval_status || "approved"; // fallback for projects before migration
  if (profile.role === "member" && approval !== "approved") {
    await db.auth.signOut();
    showLogin(approval === "rejected"
      ? "Pendaftaran member ditolak oleh Owner. Hubungi Owner jika menurutmu ini keliru."
      : "Pendaftaran berhasil, tetapi masih menunggu persetujuan Owner. Kamu belum bisa masuk ke Dashboard Member.");
    return;
  }

  const name =
    profile.display_name ||
    user.user_metadata?.display_name ||
    "Member";

  $("#profile-name").textContent = name;
  const avatar = $("#member-avatar");
  if (avatar) { avatar.textContent = profile.avatar_url ? "" : "友"; avatar.style.backgroundImage = profile.avatar_url ? `url("${profile.avatar_url}")` : ""; avatar.classList.toggle("has-photo", !!profile.avatar_url); }
  $("#summary-name").textContent = name;
  $("#summary-email").textContent =
    profile.email || user.email || "Tidak tersedia";
  $("#summary-date").textContent = dateLabel(profile.created_at);
  $("#profile-role").textContent =
    String(profile.role || "member").toUpperCase();
  await loadLeaderboard(user.id);

  if (["owner", "admin"].includes(profile.role)) {
    say(
      "#dashboard-status",
      "Akunmu memiliki peran " +
        profile.role.toUpperCase() +
        ". Untuk pengelolaan website, buka ruang Owner/Admin."
    );

    if (!document.querySelector("#staff-link")) {
      const link = document.createElement("a");
      link.id = "staff-link";
      link.className = "btn primary";
      link.href = "/admin.html";
      link.textContent = "Buka Ruang Owner/Admin ↗";
      $(".member-actions")?.prepend(link);
    }
  } else {
    say("#dashboard-status", "Akun member aktif. Selamat bergabung!");
  }

  currentUser = user;
  showDashboard();
  await initializeChat(user);
}

if (!db) {
  showLogin("Supabase belum dikonfigurasi. Periksa config.js.");
} else {
  db.auth.getSession().then(({ data }) => {
    loadDashboard(data.session?.user);
  });

  db.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      setTimeout(() => loadDashboard(session.user), 0);
    } else {
      showLogin();
    }
  });
}

$("#login-form")?.addEventListener("submit", async e => {
  e.preventDefault();

  if (!db) {
    say("#login-status", "Supabase belum dikonfigurasi.");
    return;
  }

  const f = new FormData(e.currentTarget);
  const email = String(f.get("email") || "").trim().toLowerCase();
  const password = String(f.get("password") || "");
  const button = e.currentTarget.querySelector("button[type=submit]");

  button.disabled = true;
  button.textContent = "Memeriksa akun…";
  say("#login-status", "");

  const { data, error } = await db.auth.signInWithPassword({
    email,
    password
  });

  button.disabled = false;
  button.textContent = "Masuk ke Dashboard ↗";

  if (error) {
    say("#login-status", error.message.includes("Email not confirmed")
      ? "Email belum dikonfirmasi. Periksa kotak masuk atau folder Spam Gmail."
      : "Login gagal: " + error.message);
    return;
  }

  e.currentTarget.reset();
  await loadDashboard(data.user);
});


$("#avatar-form")?.addEventListener("submit", async e => {
  e.preventDefault(); const status = $("#avatar-status"); const file = $("#avatar-file")?.files?.[0];
  if (!db || !currentUser || !file) { if(status) status.textContent = "Silakan masuk dan pilih foto terlebih dahulu."; return; }
  if (!file.type.startsWith("image/")) { status.textContent = "File harus berupa foto/gambar."; return; }
  if (file.size > 5 * 1024 * 1024) { status.textContent = "Ukuran foto maksimal 5 MB."; return; }
  status.textContent = "Mengunggah foto…";
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `avatars/${currentUser.id}/${Date.now()}.${ext}`;
  const { error: uploadError } = await db.storage.from("community-media").upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) { status.textContent = "Upload gagal: " + uploadError.message + ". Pastikan migration Storage sudah dijalankan."; return; }
  const { data: publicData } = db.storage.from("community-media").getPublicUrl(path);
  const { error } = await db.from("staff_profiles").update({ avatar_url: publicData.publicUrl }).eq("user_id", currentUser.id);
  if (error) { status.textContent = "Foto terunggah tetapi profil gagal diperbarui: " + error.message; return; }
  const avatar = $("#member-avatar"); if (avatar) { avatar.textContent = ""; avatar.style.backgroundImage = `url("${publicData.publicUrl}")`; avatar.classList.add("has-photo"); }
  status.textContent = "Foto profil berhasil diperbarui.";
});

function roleLabel(role) {
  const roles = {
    owner: "Owner",
    admin: "Admin",
    member: "Member"
  };

  return roles[String(role || "member").toLowerCase()] || "Member";
}

function initials(name) {
  return (
    String(name || "M")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(part => part[0] || "")
      .join("")
      .toUpperCase() || "M"
  );
}

function timeLabel(value) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit"
      });
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

  const { data, error } = await db
    .from("chat_member_directory")
    .select("user_id,display_name,role,avatar_url,created_at")
    .order("display_name", { ascending: true });

  if (error) {
    contacts.innerHTML =
      '<p class="chat-contact-empty">Chat belum aktif. Jalankan file <b>member-chat-migration.sql</b> di Supabase SQL Editor, lalu muat ulang halaman.</p>';
    return;
  }

  chatProfiles = data || [];
  renderChatContacts();

  $("#chat-search").oninput = renderChatContacts;

  if (chatProfiles.filter(profile => profile.user_id !== user.id).length === 0) {
    contacts.innerHTML =
      '<p class="chat-contact-empty">Belum ada akun member lain. Chat akan muncul setelah orang lain mendaftar.</p>';
  }
}

function renderChatContacts() {
  const contacts = $("#chat-contacts");
  if (!contacts || !currentUser) return;

  const query = String($("#chat-search")?.value || "")
    .trim()
    .toLocaleLowerCase("id-ID");

  const list = chatProfiles.filter(
    profile =>
      profile.user_id !== currentUser.id &&
      String(profile.display_name || "Member")
        .toLocaleLowerCase("id-ID")
        .includes(query)
  );

  contacts.replaceChildren();

  if (!list.length) {
    const empty = document.createElement("p");
    empty.className = "chat-contact-empty";
    empty.textContent = query
      ? "Nama member tidak ditemukan."
      : "Belum ada member lain untuk diajak chat.";
    contacts.append(empty);
    return;
  }

  list.forEach(profile => {
    const button = document.createElement("button");
    button.type = "button";
    button.className =
      "chat-contact" +
      (selectedChatUser?.user_id === profile.user_id ? " active" : "");

    const avatar = document.createElement("span");
    avatar.className = "chat-contact-avatar";
    if (profile.avatar_url) {
      const img = document.createElement("img");
      img.src = profile.avatar_url;
      img.alt = "";
      img.loading = "lazy";
      avatar.append(img);
    } else { avatar.textContent = initials(profile.display_name); }

    const copy = document.createElement("span");
    copy.className = "chat-contact-copy";

    const name = document.createElement("strong");
    name.textContent = profile.display_name || "Member";

    const role = document.createElement("small");
    role.textContent = roleLabel(profile.role);

    copy.append(name, role);
    button.append(avatar, copy);
    button.addEventListener("click", () => openChat(profile));
    contacts.append(button);
  });
}

async function openChat(profile) {
  selectedChatUser = profile;

  $("#chat-empty")?.classList.add("hidden");
  $("#chat-active")?.classList.remove("hidden");
  say("#chat-person-name", profile.display_name || "Member");
  say("#chat-person-role", roleLabel(profile.role).toUpperCase());
  say("#chat-person-avatar", initials(profile.display_name));
  say("#chat-status", "");

  renderChatContacts();
  await loadChatMessages();

  clearChatPolling();

  chatPollTimer = setInterval(() => {
    if (selectedChatUser && document.visibilityState !== "hidden") {
      loadChatMessages(true);
    }
  }, 5000);

  $("#chat-message-input")?.focus();
}

async function loadChatMessages(quiet = false) {
  if (!db || !currentUser || !selectedChatUser || loadingMessages) return;

  loadingMessages = true;
  const box = $("#chat-messages");

  const wasNearBottom =
    box.scrollHeight - box.scrollTop - box.clientHeight < 80;

  const { data, error } = await db
    .from("member_messages")
    .select("id,sender_id,recipient_id,body,created_at")
    .or(
      `and(sender_id.eq.${currentUser.id},recipient_id.eq.${selectedChatUser.user_id}),and(sender_id.eq.${selectedChatUser.user_id},recipient_id.eq.${currentUser.id})`
    )
    .order("created_at", { ascending: true })
    .limit(200);

  loadingMessages = false;

  if (error) {
    if (!quiet) {
      say("#chat-status", "Gagal memuat chat: " + error.message);
    }
    return;
  }

  const oldLastId = box.lastElementChild?.dataset?.messageId || "";
  const newLastId = data?.[data.length - 1]?.id || "";

  if (
    oldLastId === newLastId &&
    box.children.length === (data || []).length
  ) {
    return;
  }

  box.replaceChildren();

  if (!data?.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Belum ada pesan. Sapa dulu member ini!";
    box.append(empty);
    return;
  }

  const profileById = new Map(
    chatProfiles.map(profile => [profile.user_id, profile])
  );

  data.forEach(message => {
    const mine = message.sender_id === currentUser.id;

    const sender =
      profileById.get(message.sender_id) ||
      (mine
        ? {
            display_name: $("#profile-name").textContent,
            role: $("#profile-role").textContent.toLowerCase()
          }
        : selectedChatUser);

    const bubble = document.createElement("article");
    bubble.className = "chat-message" + (mine ? " mine" : "");
    bubble.dataset.messageId = message.id;

    const name = document.createElement("span");
    name.className = "chat-message-name";
    name.textContent = sender?.display_name || "Member";

    const role = document.createElement("span");
    role.className = "chat-message-role";
    role.textContent = roleLabel(sender?.role);

    const body = document.createElement("div");
    body.className = "chat-message-body";
    body.textContent = message.body;

    const time = document.createElement("time");
    time.className = "chat-message-time";
    time.textContent = timeLabel(message.created_at);
    time.dateTime = message.created_at;

    bubble.append(name, role, body, time);
    box.append(bubble);
  });

  if (wasNearBottom || !quiet) {
    box.scrollTop = box.scrollHeight;
  }
}

$("#chat-form")?.addEventListener("submit", async event => {
  event.preventDefault();

  if (!db || !currentUser || !selectedChatUser) {
    say("#chat-status", "Pilih member terlebih dahulu.");
    return;
  }

  const input = $("#chat-message-input");
  const body = input.value.trim();
  if (!body) return;

  const button = event.currentTarget.querySelector("button[type=submit]");
  button.disabled = true;
  say("#chat-status", "Mengirim pesan…");

  const { error } = await db.from("member_messages").insert({
    sender_id: currentUser.id,
    recipient_id: selectedChatUser.user_id,
    body
  });

  button.disabled = false;

  if (error) {
    say("#chat-status", "Pesan gagal dikirim: " + error.message);
    return;
  }

  input.value = "";
  say("#chat-status", "");
  await loadChatMessages();
});

function safeText(text) {
  return String(text ?? "").replace(
    /[&<>"']/g,
    c =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[c]
  );
}

// Profil publik: dapat dibuka dengan mengetuk baris leaderboard.
document.addEventListener("click", async event => {
  const trigger = event.target.closest("[data-profile-id]");
  if (!trigger || !db || !currentUser) return;
  const modal = $("#public-profile-modal");
  const uid = trigger.dataset.profileId;
  if (!modal) return;
  modal.classList.remove("hidden");
  say("#public-profile-name", "Memuat profil…");
  say("#public-profile-role", ""); say("#public-profile-tier", ""); say("#public-profile-points", "");
  const photo = $("#public-profile-avatar"); if (photo) { photo.style.backgroundImage = ""; photo.textContent = "友"; }
  const {data, error} = await db.from("leaderboard_public").select("user_id,display_name,role,points,tier,avatar_url").eq("user_id", uid).maybeSingle();
  if (error || !data) { say("#public-profile-name", "Profil tidak dapat dimuat"); return; }
  say("#public-profile-name", data.display_name || "Member");
  say("#public-profile-role", String(data.role || "member").toUpperCase());
  say("#public-profile-tier", `${data.tier || "Warrior"} ${tierSymbols[data.tier] || "♜"}`);
  say("#public-profile-points", `${Number(data.points)||0} poin total`);
  if (photo) { photo.textContent = data.avatar_url ? "" : "友"; photo.style.backgroundImage = data.avatar_url ? `url("${data.avatar_url}")` : ""; }
  const chatButton = $("#public-profile-chat");
  if (chatButton) { chatButton.classList.toggle("hidden", uid === currentUser.id); chatButton.onclick = () => { modal.classList.add("hidden"); const target = chatProfiles.find(p => p.user_id === uid); if (target) { selectedChatUser = target; document.querySelector("#chat-section")?.scrollIntoView({behavior:"smooth"}); initializeChat(currentUser); } else { location.href = `/member.html?chat=${encodeURIComponent(uid)}#chat-section`; } }; }
});
$("#public-profile-close")?.addEventListener("click", () => $("#public-profile-modal")?.classList.add("hidden"));
$("#public-profile-modal")?.addEventListener("click", e => { if (e.target.id === "public-profile-modal") e.currentTarget.classList.add("hidden"); });

$("#logout")?.addEventListener("click", async () => {
  if (!db) return;

  const { error } = await db.auth.signOut();

  if (error) {
    say("#dashboard-status", "Gagal keluar: " + error.message);
  } else {
    clearChatPolling();
    currentUser = null;
    selectedChatUser = null;
    showLogin("Kamu sudah keluar dari akun.");
  }
});
