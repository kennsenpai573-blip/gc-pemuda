import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
const $ = (s) => document.querySelector(s);
$("#year").textContent = new Date().getFullYear();
let groups = [];
let homeMembers = [];
const configured = SUPABASE_URL.startsWith("https://") && !SUPABASE_URL.includes("PROJECT_ID") && !SUPABASE_ANON_KEY.includes("PASTE_");
const client = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
function escapeHtml(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function renderGroups(){
 const term = ($("#group-search").value || "").toLowerCase();
 const list = groups.filter(g => `${g.name} ${g.description||""} ${g.category||""}`.toLowerCase().includes(term));
 $("#group-count").textContent = groups.length;
 $("#groups").innerHTML = list.length ? list.map(g=>`<article class="group-card"><div class="card-icon">友</div><h3>${escapeHtml(g.name)}</h3><p class="muted">${escapeHtml(g.description||"Komunitas — Grup Pemuda`友.")}</p><p class="muted">${escapeHtml(g.category||"Komunitas umum")}</p><a class="btn primary" href="${/^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+$/.test(g.invite_url||"")?g.invite_url:"#"}" target="_blank" rel="noopener noreferrer">Gabung WhatsApp ↗</a></article>`).join("") : `<div class="empty">${configured?"Belum ada grup yang cocok.":"Supabase belum diatur. Ikuti README untuk menghubungkan database."}</div>`;
}
$("#group-search").addEventListener("input",renderGroups);
async function loadGroups(){
 if(!client){groups=[];renderGroups();return;}
 const {data,error}=await client.from("community_groups").select("id,name,description,category,invite_url").eq("is_published",true).order("created_at",{ascending:false});
 if(error){$("#groups").innerHTML='<div class="empty">Gagal memuat grup. Periksa konfigurasi Supabase dan kebijakan RLS.</div>';return;}
 groups=data||[];renderGroups();
}
$("#intro-form").addEventListener("submit",async e=>{
 e.preventDefault();const status=$("#intro-status");status.textContent="";
 if(!client){status.textContent="Hubungkan Supabase terlebih dahulu (lihat README).";return;}
 const f=new FormData(e.currentTarget);
 const payload={nickname:String(f.get("nickname")).trim(),interest:String(f.get("interest")).trim(),bio:String(f.get("bio")).trim()};
 const {error}=await client.from("member_intros").insert(payload);
 status.textContent=error?"Intro belum terkirim. Coba lagi nanti.":"Intro terkirim untuk ditinjau Owner. Terima kasih!";
 if(!error)e.currentTarget.reset();
});

function renderHomeMembers(){
 const box=$("#home-members"); if(!box)return;
 const term=String($("#home-member-search")?.value||"").trim().toLowerCase();
 if(!term){box.hidden=true;box.innerHTML="";return;}
 box.hidden=false;
 const list=homeMembers.filter(m=>String(m.display_name||"").toLowerCase().includes(term)||String(m.public_user_id||"").includes(term));
 box.innerHTML=list.length?list.map(m=>`<a class="group-card home-member-card home-member-profile-link" href="/members.html?user=${encodeURIComponent(m.user_id)}" aria-label="Lihat profil ${escapeHtml(m.display_name||"Member")}"><div class="public-member-avatar ${m.avatar_frame?'has-avatar-frame':''}" ${m.avatar_frame?`data-avatar-frame="${escapeHtml(m.avatar_frame)}"`:""} style="--avatar-frame-color:${escapeHtml((m.avatar_frame||"").toLowerCase().includes("gold")||(m.avatar_frame||"").toLowerCase().includes("emas")?"#ffd166":(m.avatar_frame||"").toLowerCase().includes("ice")||(m.avatar_frame||"").toLowerCase().includes("es")?"#22d3ee":"#a78bfa")}">${m.avatar_url?`<img src="${escapeHtml(m.avatar_url)}" alt="Foto profil ${escapeHtml(m.display_name||"Member")}" loading="lazy" referrerpolicy="no-referrer">`:"友"}</div><h3>${escapeHtml(m.display_name||"Member")}</h3><p class="member-public-id">User ID: <strong>${escapeHtml(m.public_user_id||"Belum tersedia")}</strong></p><p class="muted">Member komunitas</p><p class="muted">Bergabung ${m.created_at?new Date(m.created_at).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"}):"—"}</p><span class="btn secondary">Lihat profil ↗</span></a>`).join(""):'<div class="empty">'+(homeMembers.length?'Tidak ada member dengan nama atau User ID tersebut.':'Belum ada member yang disetujui.')+'</div>';
}
$("#home-member-search")?.addEventListener("input",renderHomeMembers);
async function loadHomeMembers(){
 const box=$("#home-members"); if(!box)return;
 if(!client){box.innerHTML='<div class="empty">Hubungkan Supabase untuk menampilkan member.</div>';return;}
 const {data,error}=await client.from("public_member_directory").select("user_id,public_user_id,display_name,created_at,avatar_url").order("created_at",{ascending:false}).limit(500);
 if(error){box.innerHTML='<div class="empty">Daftar member belum bisa dimuat. Jalankan user-id-migration.sql di Supabase.</div>';return;}
 homeMembers=data||[];
 const {data:frames}=await client.rpc("public_member_avatar_frames");const frameMap=new Map((frames||[]).map(f=>[f.user_id,f.avatar_frame]));
 homeMembers=homeMembers.map(m=>({...m,avatar_frame:frameMap.get(m.user_id)||""}));renderHomeMembers();
}

async function loadSectionBackgrounds(){
 if(!client)return;
 const targets={
  home_background:"#home-hero",
  groups_background:"#grup",
  members_background:"#member-community",
  intro_background:"#intro",
  rules_background:"#aturan"
 };
 for(const [key,selector] of Object.entries(targets)){
  const target=document.querySelector(selector); if(!target)continue;
  const {data,error}=await client.from("site_settings").select("value").eq("key",key).maybeSingle();
  if(error||!data?.value?.url)continue;
  const value=data.value;
  target.classList.add("section-custom-background");
  if(value.type==="video"){
   const video=document.createElement("video"); video.className="section-background-media"; video.src=value.url; video.autoplay=true; video.muted=true; video.loop=true; video.playsInline=true; video.setAttribute("aria-hidden","true"); target.prepend(video);
  }else{
   target.style.setProperty("--section-background-image",`url("${String(value.url).replace(/["\\]/g,"")}")`);
  }
 }
}
loadSectionBackgrounds();
loadGroups();
loadHomeMembers();
// Catat setiap pemuatan halaman utama, untuk semua peran (publik, member, admin, Owner).
// Tidak mengambil nama, email, alamat IP, atau identitas pribadi.
async function recordHomeVisit(){
 if(!client) return false;
 try {
  const {error}=await client.from("site_visits").insert({path:(location.pathname||"/").slice(0,300)});
  if(error){ console.warn("Kunjungan belum tercatat. Periksa policy site_visits di Supabase:",error.message); return false; }
  return true;
 } catch(e){ console.warn("Pencatatan pengunjung gagal:",e); return false; }
}
const visitRecordedPromise=recordHomeVisit();
// Intro pembuka website: sumber URL dikendalikan Owner melalui site_settings.
function introEmbedUrl(raw) {
 try { const u = new URL(raw); if (u.protocol !== "https:") return "";
  if (u.hostname === "youtu.be") return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}?autoplay=1&mute=0&controls=0&playsinline=1`;
  if (u.hostname.endsWith("youtube.com") && u.pathname === "/watch") { const id=u.searchParams.get("v"); return id ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=0&controls=0&playsinline=1` : ""; }
  if (u.hostname.endsWith("youtube.com") && u.pathname.startsWith("/embed/")) return `${u.href}${u.search ? "&" : "?"}autoplay=1&mute=1&playsinline=1`;
  if (u.hostname.endsWith("vimeo.com")) { const id=u.pathname.split("/").filter(Boolean).pop(); return /^\d+$/.test(id||"") ? `https://player.vimeo.com/video/${id}?autoplay=1&muted=0&title=0&byline=0` : ""; }
  return /\.(mp4|webm|ogg)(\?.*)?$/i.test(u.href) ? u.href : "";
 } catch { return ""; }
}
function showSiteIntro(raw, title="", saveSeen=true) {
 const url=introEmbedUrl(raw); if(!url) return;
 const old=document.getElementById("site-intro-overlay"); if(old) old.remove();
 const overlay=document.createElement("div"); overlay.id="site-intro-overlay";
 overlay.innerHTML=`<div class="site-intro-card"><div class="site-intro-video"></div><button class="site-intro-skip" type="button" aria-label="Lewati intro">Lewati ×</button></div>`;
 const box=overlay.querySelector(".site-intro-video");
 let video=null, frame=null;
 if(/\.(mp4|webm|ogg)(\?.*)?$/i.test(url)){
   video=document.createElement("video"); video.src=url; video.autoplay=true; video.muted=false; video.defaultMuted=false; video.volume=1; video.playsInline=true; video.controls=false; video.loop=false; video.preload="auto"; video.setAttribute("autoplay", ""); video.removeAttribute("muted"); box.append(video);
   // Try autoplay with sound first. If the browser blocks audible autoplay, immediately
   // retry muted so the intro still starts automatically; a tap on the video enables sound.
   const enableAudio = () => {
     video.muted = false; video.defaultMuted = false; video.volume = 1;
     const p = video.play(); if (p?.catch) p.catch(() => {});
   };
   video.addEventListener("click", enableAudio);
   video.addEventListener("ended", close, {once:true});
   video.addEventListener("error", ()=>{ /* Leave Skip available if the host blocks playback. */ });
   const playPromise = video.play();
   if (playPromise?.catch) playPromise.catch(() => {
     video.muted = true; video.defaultMuted = true;
     const fallback = video.play();
     if (fallback?.catch) fallback.catch(() => {});
   });
 } else {
   frame=document.createElement("iframe"); frame.src=url; frame.title="Intro video"; frame.allow="autoplay; encrypted-media; picture-in-picture"; frame.allowFullscreen=true; box.append(frame);
   // Listen for end events from supported YouTube/Vimeo embeds so the website opens automatically.
   if(url.includes("youtube-nocookie.com/embed/") || url.includes("youtube.com/embed/")) {
     const u=new URL(frame.src); u.searchParams.set("enablejsapi","1"); u.searchParams.set("origin",location.origin); frame.src=u.toString();
     const onMessage=(event)=>{ if(event.source!==frame.contentWindow) return; try { const d=typeof event.data==="string"?JSON.parse(event.data):event.data; if(d?.event==="onStateChange" && d.info===0) close(); } catch{} };
     window.addEventListener("message",onMessage); overlay._introCleanup=()=>window.removeEventListener("message",onMessage);
     frame.addEventListener("load",()=>{ try { frame.contentWindow.postMessage(JSON.stringify({event:"listening","id":frame.id||"gp-intro"}),"*"); } catch{} });
   } else if(url.includes("player.vimeo.com/video/")) {
     frame.src += (frame.src.includes("?")?"&":"?")+"api=1";
     const onMessage=(event)=>{ if(event.source!==frame.contentWindow) return; try { const d=typeof event.data==="string"?JSON.parse(event.data):event.data; if(d?.event==="ended") close(); } catch{} };
     window.addEventListener("message",onMessage); overlay._introCleanup=()=>window.removeEventListener("message",onMessage);
     frame.addEventListener("load",()=>{try{frame.contentWindow.postMessage(JSON.stringify({method:"addEventListener",value:"ended"}),"*");}catch{}});
   }
 }
 function close(){ if(!overlay.isConnected) return; overlay._introCleanup?.(); overlay.remove(); if(saveSeen) sessionStorage.setItem("gp_intro_seen","1"); document.documentElement.classList.remove("gp-intro-pending"); const boot=document.getElementById("site-intro-boot"); if(boot) boot.remove(); }
 overlay.querySelector(".site-intro-skip").addEventListener("click",close);
 document.body.append(overlay);
 const boot=document.getElementById("site-intro-boot"); if(boot) boot.remove();
}

async function loadSiteIntro(){
 const revealSite=()=>{ document.documentElement.classList.remove("gp-intro-pending"); const boot=document.getElementById("site-intro-boot"); if(boot) boot.remove(); };
 if(!client){ revealSite(); return; }
 // Tahan tampilan halaman utama sampai pengaturan intro diperiksa agar tidak sempat terlihat sekilas.
 let safetyTimer=setTimeout(revealSite,10000);
 try {
  const {data,error}=await client.from("site_settings").select("value").eq("key","site_intro").maybeSingle();
  clearTimeout(safetyTimer);
  if(error||!data?.value){ revealSite(); return; }
  const v=data.value;
  if(v.enabled===false||!v.url){ revealSite(); return; }
  // Intro tampil setiap kali link dibuka, bukan dilewati karena pernah ditonton di sesi sebelumnya.
  showSiteIntro(v.url,v.title||undefined,false);
 } catch(e){ clearTimeout(safetyTimer); console.warn("Intro website tidak tersedia:",e.message); revealSite(); }
}
loadSiteIntro();

// Menu mobile: drawer muncul dari kanan, menu lain tetap tersedia di dalamnya.
const navToggle = document.querySelector('#nav-toggle');
const mainNav = document.querySelector('#main-nav');
const navBackdrop = document.querySelector('#nav-backdrop');
function setNavOpen(open){
 if(!navToggle||!mainNav)return;
 mainNav.classList.toggle('is-open',open);
 if(navBackdrop)navBackdrop.classList.toggle('is-open',open);
 navToggle.setAttribute('aria-expanded',String(open));
 navToggle.setAttribute('aria-label',open?'Tutup menu':'Buka menu');
 navToggle.textContent=open?'×':'☰';
 document.body.classList.toggle('nav-drawer-open',open);
}
if(navToggle&&mainNav){
 navToggle.addEventListener('click',()=>setNavOpen(!mainNav.classList.contains('is-open')));
 if(navBackdrop)navBackdrop.addEventListener('click',()=>setNavOpen(false));
 mainNav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>setNavOpen(false)));
 document.addEventListener('keydown',e=>{if(e.key==='Escape')setNavOpen(false)});
 let touchStartX=null;
 mainNav.addEventListener('touchstart',e=>{touchStartX=e.changedTouches[0].clientX},{passive:true});
 mainNav.addEventListener('touchend',e=>{if(touchStartX!==null&&e.changedTouches[0].clientX-touchStartX>70)setNavOpen(false);touchStartX=null},{passive:true});
}
// Jam realtime untuk WIB, WITA, dan WIT.
const clockFmt = zone => new Intl.DateTimeFormat('id-ID',{timeZone:zone,hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date());
function updateWorldClocks(){
 for (const [id,zone] of [['clock-wib','Asia/Jakarta'],['clock-wita','Asia/Makassar'],['clock-wit','Asia/Jayapura']]) {
  const el=document.getElementById(id); if(el) el.textContent=clockFmt(zone);
 }
}
updateWorldClocks(); setInterval(updateWorldClocks,1000);
// Statistik agregat aman: database hanya mengembalikan angka, bukan daftar jalur kunjungan.
async function loadPublicStats(){
 if(!client)return;
 try { await visitRecordedPromise; const {data,error}=await client.rpc('get_public_site_stats'); if(error||!data)return;
  const stats=Array.isArray(data)?data[0]:data;
  const visitors=document.getElementById('visitor-count'); if(visitors)visitors.textContent=Number(stats.visitors||0).toLocaleString('id-ID');
  const members=document.getElementById('member-count'); if(members)members.textContent=Number(stats.members||0).toLocaleString('id-ID');
  const groupsCount=document.getElementById('group-count'); if(groupsCount)groupsCount.textContent=Number(stats.groups??groups.length??0).toLocaleString('id-ID');
 } catch(e){console.warn('Statistik publik belum tersedia:',e);}
}
loadPublicStats();
