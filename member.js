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
let publicChatTimer = null;
let publicChatLoading = false;
let publicChatMessages = [];
let publicChatProfiles = [];
let publicChatReplyTo = null;
let publicChatActionMessage = null;

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
    .select("user_id,display_name,email,role,created_at")
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

  const name =
    profile.display_name ||
    user.user_metadata?.display_name ||
    "Member";

  $("#profile-name").textContent = name;
  $("#summary-name").textContent = name;
  $("#summary-email").textContent =
    profile.email || user.email || "Tidak tersedia";
  $("#summary-date").textContent = dateLabel(profile.created_at);
  $("#profile-role").textContent =
    String(profile.role || "member").toUpperCase();

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
  await initializePublicChat(user);
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
    say(
      "#login-status",
      "Login gagal: periksa email, password, atau konfirmasi email akunmu."
    );
    return;
  }

  e.currentTarget.reset();
  await loadDashboard(data.user);
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
    .select("user_id,display_name,role")
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
    avatar.textContent = initials(profile.display_name);

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

// Chat publik: satu ruang bersama untuk semua akun yang sudah login.
function clearPublicChatTimer() {
  if (publicChatTimer) clearInterval(publicChatTimer);
  publicChatTimer = null;
}

function hidePublicMessageMenu() {
  $("#public-message-menu")?.classList.add("hidden");
  publicChatActionMessage = null;
}

function setPublicReply(message) {
  publicChatReplyTo = message || null;
  const preview = $("#public-reply-preview");
  if (!preview) return;

  if (!message) {
    preview.classList.add("hidden");
    return;
  }

  const profile = publicChatProfiles.find(
    p => p.user_id === message.sender_id
  );

  $("#public-reply-name").textContent =
    (profile?.display_name || "Member") +
    " · " +
    roleLabel(profile?.role);

  $("#public-reply-text").textContent = message.body;
  preview.classList.remove("hidden");
  $("#public-chat-input").focus();
}

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

async function initializePublicChat(user) {
  clearPublicChatTimer();

  const box = $("#public-chat-messages");
  if (!box || !db || !user) return;

  box.innerHTML = '<p class="muted">Memuat ruang publik…</p>';

  const { data: profiles, error: profileError } = await db
    .from("chat_member_directory")
    .select("user_id,display_name,role")
    .order("display_name", { ascending: true });

  if (profileError) {
    box.innerHTML =
      '<p class="muted">Direktori member belum tersedia. Jalankan migrasi chat member terlebih dahulu.</p>';
    return;
  }

  publicChatProfiles = profiles || [];
  await loadPublicChat();

  publicChatTimer = setInterval(() => {
    if (document.visibilityState !== "hidden") {
      loadPublicChat(true);
    }
  }, 4000);
}

async function loadPublicChat(quiet = false) {
  if (!db || !currentUser || publicChatLoading) return;

  publicChatLoading = true;
  const box = $("#public-chat-messages");

  const nearBottom =
    box.scrollHeight - box.scrollTop - box.clientHeight < 100;

  const { data, error } = await db
    .from("public_chat_messages")
    .select("id,sender_id,body,reply_to_id,created_at")
    .order("created_at", { ascending: true })
    .limit(250);

  if (error) {
    publicChatLoading = false;

    if (!quiet) {
      box.textContent =
        "Gagal memuat chat publik: " +
        error.message +
        (error.code ? " (kode " + error.code + ")" : "");
    }

    return;
  }

  const messages = data || [];
  let reactions = [];

  if (messages.length) {
    const ids = messages.map(m => m.id);

    const { data: rdata, error: rerror } = await db
      .from("public_chat_reactions")
      .select("id,message_id,user_id,reaction")
      .in("message_id", ids);

    if (!rerror) reactions = rdata || [];
  }

  publicChatMessages = messages;

  const nextId = messages[messages.length - 1]?.id || "";
  const oldSignature = box.dataset.signature || "";

  const signature =
    messages.length +
    ":" +
    nextId +
    ":" +
    reactions.length +
    ":" +
    reactions.map(r => r.id + "/" + r.reaction).join(",");

  publicChatLoading = false;

  if (oldSignature === signature) return;

  box.dataset.signature = signature;
  box.replaceChildren();

  const byId = new Map(messages.map(m => [m.id, m]));

  if (!messages.length) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent =
      "Belum ada pesan. Jadilah orang pertama yang menyapa komunitas!";
    box.append(p);
    return;
  }

  const profileById = new Map(
    publicChatProfiles.map(p => [p.user_id, p])
  );

  messages.forEach(message => {
    const mine = message.sender_id === currentUser.id;

    const profile =
      profileById.get(message.sender_id) ||
      (mine
        ? {
            display_name: $("#profile-name").textContent,
            role: $("#profile-role").textContent.toLowerCase()
          }
        : { display_name: "Member", role: "member" });

    const article = document.createElement("article");
    article.className = "public-message" + (mine ? " mine" : "");
    article.dataset.publicMessageId = message.id;
    article.tabIndex = 0;
    article.setAttribute("role", "button");
    article.setAttribute(
      "aria-label",
      "Aksi pesan dari " + profile.display_name
    );

    const name = document.createElement("span");
    name.className = "public-message-author";
    name.textContent = profile.display_name || "Member";

    const role = document.createElement("span");
    role.className = "public-message-role";
    role.textContent = roleLabel(profile.role);

    const parent = message.reply_to_id
      ? byId.get(message.reply_to_id)
      : null;

    if (parent) {
      const parentProfile = profileById.get(parent.sender_id) || {
        display_name: "Member"
      };

      const quote = document.createElement("div");
      quote.className = "public-reply-quote";

      const qname = document.createElement("strong");
      qname.textContent = "↩ " + (parentProfile.display_name || "Member");

      const qbody = document.createElement("span");
      qbody.textContent = parent.body;

      quote.append(qname, qbody);
      article.append(quote);
    }

    const body = document.createElement("div");
    body.className = "public-message-body";
    body.textContent = message.body;

    const time = document.createElement("time");
    time.className = "public-message-time";
    time.textContent = timeLabel(message.created_at);
    time.dateTime = message.created_at;

    article.append(name, role, body, time);

    const msgReactions = reactions.filter(
      r => r.message_id === message.id
    );

    if (msgReactions.length) {
      const groups = new Map();

      msgReactions.forEach(r => {
        const item = groups.get(r.reaction) || {
          count: 0,
          mine: false
        };

        item.count++;
        if (r.user_id === currentUser.id) item.mine = true;

        groups.set(r.reaction, item);
      });

      const row = document.createElement("div");
      row.className = "public-reactions";

      groups.forEach((v, emoji) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className =
          "public-reaction-chip" + (v.mine ? " mine" : "");
        chip.textContent = emoji + " " + v.count;
        chip.dataset.quickReaction = emoji;
        chip.dataset.messageId = message.id;
        chip.title = "Tekan untuk mengubah reaction";
        row.append(chip);
      });

      article.append(row);
    }

    box.append(article);
  });

  if (nearBottom || !quiet) {
    box.scrollTop = box.scrollHeight;
  }
}

function showPublicMessageMenu(message) {
  publicChatActionMessage = message;

  const menu = $("#public-message-menu");
  menu
    .querySelector('[data-action="delete"]')
    .classList.toggle(
      "hidden",
      message.sender_id !== currentUser?.id
    );

  menu.classList.remove("hidden");
}

$("#public-chat-messages")?.addEventListener("click", async event => {
  const reactionButton = event.target.closest("[data-quick-reaction]");

  if (reactionButton) {
    event.stopPropagation();
    await togglePublicReaction(
      reactionButton.dataset.messageId,
      reactionButton.dataset.quickReaction
    );
    return;
  }

  const bubble = event.target.closest("[data-public-message-id]");
  if (!bubble) return;

  const message = publicChatMessages.find(
    m => m.id === bubble.dataset.publicMessageId
  );

  if (message) showPublicMessageMenu(message);
});

$("#public-chat-messages")?.addEventListener("keydown", event => {
  if (
    (event.key === "Enter" || event.key === " ") &&
    event.target.matches("[data-public-message-id]")
  ) {
    event.preventDefault();

    const message = publicChatMessages.find(
      m => m.id === event.target.dataset.publicMessageId
    );

    if (message) showPublicMessageMenu(message);
  }
});

async function togglePublicReaction(messageId, emoji) {
  if (!db || !currentUser) return;

  const { data: existing } = await db
    .from("public_chat_reactions")
    .select("id,reaction")
    .eq("message_id", messageId)
    .eq("user_id", currentUser.id)
    .maybeSingle();

  let error = null;

  if (existing?.reaction === emoji) {
    ({ error } = await db
      .from("public_chat_reactions")
      .delete()
      .eq("id", existing.id));
  } else if (existing) {
    ({ error } = await db
      .from("public_chat_reactions")
      .update({ reaction: emoji })
      .eq("id", existing.id));
  } else {
    ({ error } = await db
      .from("public_chat_reactions")
      .insert({
        message_id: messageId,
        user_id: currentUser.id,
        reaction: emoji
      }));
  }

  if (error) {
    say(
      "#public-chat-status",
      "Reaction gagal disimpan: " + error.message
    );
  } else {
    say("#public-chat-status", "");
  }

  hidePublicMessageMenu();
  await loadPublicChat(true);
}

$("#public-message-menu")?.addEventListener("click", async event => {
  const reaction = event.target.closest("[data-reaction]");

  if (reaction && publicChatActionMessage) {
    await togglePublicReaction(
      publicChatActionMessage.id,
      reaction.dataset.reaction
    );
    return;
  }

  const action = event.target.closest("[data-action]")?.dataset.action;
  const message = publicChatActionMessage;

  if (!action || !message) return;

  if (action === "reply") {
    setPublicReply(message);
    hidePublicMessageMenu();
    return;
  }

  if (action === "copy") {
    try {
      await navigator.clipboard.writeText(message.body);
      say("#public-chat-status", "Teks pesan disalin.");
    } catch {
      const area = document.createElement("textarea");
      area.value = message.body;
      document.body.append(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();

      say(
        "#public-chat-status",
        ok
          ? "Teks pesan disalin."
          : "Gagal menyalin. Tekan lama teks untuk menyalin."
      );
    }

    hidePublicMessageMenu();
    return;
  }

  if (
    action === "delete" &&
    message.sender_id === currentUser?.id &&
    confirm("Hapus pesan ini dari chat publik?")
  ) {
    const { error } = await db
      .from("public_chat_messages")
      .delete()
      .eq("id", message.id);

    say(
      "#public-chat-status",
      error ? "Gagal menghapus pesan: " + error.message : "Pesan dihapus."
    );

    hidePublicMessageMenu();
    await loadPublicChat(true);
    return;
  }

  hidePublicMessageMenu();
});

document.addEventListener("click", event => {
  const menu = $("#public-message-menu");

  if (
    menu &&
    !menu.classList.contains("hidden") &&
    !event.target.closest("#public-message-menu") &&
    !event.target.closest("[data-public-message-id]")
  ) {
    hidePublicMessageMenu();
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    hidePublicMessageMenu();
    setPublicReply(null);
  }
});

$("#public-reply-cancel")?.addEventListener("click", () => {
  setPublicReply(null);
});

$("#public-chat-form")?.addEventListener("submit", async event => {
  event.preventDefault();

  if (!db || !currentUser) return;

  const input = $("#public-chat-input");
  const body = input.value.trim();
  if (!body) return;

  const button = event.currentTarget.querySelector("button[type=submit]");
  button.disabled = true;
  say("#public-chat-status", "Mengirim pesan…");

  const payload = {
    sender_id: currentUser.id,
    body,
    reply_to_id: publicChatReplyTo?.id || null
  };

  const { error } = await db
    .from("public_chat_messages")
    .insert(payload);

  button.disabled = false;

  if (error) {
    const detail = [
      error.message,
      error.code ? "Kode: " + error.code : "",
      error.details || "",
      error.hint ? "Petunjuk: " + error.hint : ""
    ]
      .filter(Boolean)
      .join(" | ");

    say("#public-chat-status", "Pesan gagal dikirim: " + detail);
    return;
  }

  input.value = "";
  setPublicReply(null);
  say("#public-chat-status", "");
  await loadPublicChat();
});

$("#logout")?.addEventListener("click", async () => {
  if (!db) return;

  const { error } = await db.auth.signOut();

  if (error) {
    say("#dashboard-status", "Gagal keluar: " + error.message);
  } else {
    clearChatPolling();
    clearPublicChatTimer();
    currentUser = null;
    selectedChatUser = null;
    showLogin("Kamu sudah keluar dari akun.");
  }
});
