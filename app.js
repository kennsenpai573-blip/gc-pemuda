import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
const $ = (s) => document.querySelector(s);
$("#year").textContent = new Date().getFullYear();
let groups = [];
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

async function loadHomeMembers(){
 const box=$("#home-members"); if(!box)return;
 if(!client){box.innerHTML='<div class="empty">Hubungkan Supabase untuk menampilkan member.</div>';return;}
 const {data,error}=await client.from("public_member_directory").select("display_name,created_at,avatar_url").order("created_at",{ascending:false}).limit(6);
 if(error){box.innerHTML='<div class="empty">Daftar member belum bisa dimuat. Pastikan member-visibility-migration.sql sudah dijalankan di Supabase.</div>';return;}
 const list=data||[];
 box.innerHTML=list.length?list.map(m=>`<article class="group-card home-member-card"><div class="public-member-avatar">${m.avatar_url?`<img src="${escapeHtml(m.avatar_url)}" alt="Foto profil ${escapeHtml(m.display_name||"Member")}" loading="lazy" referrerpolicy="no-referrer">`:"友"}</div><h3>${escapeHtml(m.display_name||"Member")}</h3><p class="muted">Member komunitas</p><p class="muted">Bergabung ${m.created_at?new Date(m.created_at).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"}):"—"}</p></article>`).join(""):'<div class="empty">Belum ada member yang disetujui. Jadilah member pertama!</div>';
}

async function loadHomeBackground(){
 if(!client)return;
 const {data,error}=await client.from("site_settings").select("value").eq("key","home_background").maybeSingle();
 if(error||!data?.value?.url)return;
 const hero=document.querySelector("#home-hero"); if(!hero)return;
 const value=data.value; hero.classList.add("hero-custom-background");
 if(value.type==="video") { const video=document.createElement("video"); video.className="hero-background-media"; video.src=value.url; video.autoplay=true; video.muted=true; video.loop=true; video.playsInline=true; video.setAttribute("aria-hidden","true"); hero.prepend(video); }
 else { hero.style.setProperty("--hero-background-image", `url("${String(value.url).replace(/["\\]/g, "")}")`); }
}
loadHomeBackground();
loadGroups();
loadHomeMembers();
// Statistik sederhana: hanya mencatat kunjungan, bukan identitas pengunjung.
if(client && !sessionStorage.getItem("gp_visit_recorded")){
 client.from("site_visits").insert({path:location.pathname}).then(()=>sessionStorage.setItem("gp_visit_recorded","1"));
}