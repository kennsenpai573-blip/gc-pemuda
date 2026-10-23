import {createClient} from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import {SUPABASE_URL,SUPABASE_ANON_KEY} from "./config.js";
const $=s=>document.querySelector(s);
const configured=SUPABASE_URL.startsWith("https://")&&!SUPABASE_URL.includes("PROJECT_ID")&&!SUPABASE_ANON_KEY.includes("PASTE_");
const db=configured?createClient(SUPABASE_URL,SUPABASE_ANON_KEY):null;
function esc(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function status(id,msg){$(id).textContent=msg;}
async function refresh(){
 if(!db)return;
 const {data:auth}=await db.auth.getUser();if(!auth.user){$("#login-panel").classList.remove("hidden");$("#dashboard").classList.add("hidden");return;}
 const {data:profile,error:pErr}=await db.from("owner_profiles").select("user_id").eq("user_id",auth.user.id).maybeSingle();
 if(pErr||!profile){status("#login-status","Akun ini belum terdaftar sebagai Owner.");await db.auth.signOut();return;}
 $("#login-panel").classList.add("hidden");$("#dashboard").classList.remove("hidden");
 const {data:groups}=await db.from("community_groups").select("*").order("created_at",{ascending:false});
 $("#admin-groups").innerHTML=(groups||[]).map(g=>`<div class="admin-item"><div><strong>${esc(g.name)}</strong><small>${g.is_published?"Dipublikasikan":"Draft"} · ${esc(g.category||"Umum")}</small></div><button class="btn danger" data-delete="${esc(g.id)}">Hapus</button></div>`).join("")||'<p class="muted">Belum ada grup.</p>';
 $("#admin-groups").querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",async()=>{if(!confirm("Hapus grup ini?"))return;const {error}=await db.from("community_groups").delete().eq("id",b.dataset.delete);status("#group-status",error?"Gagal menghapus grup.":"Grup dihapus.");refresh();}));
 const {count}=await db.from("site_visits").select("*",{count:"exact",head:true});$("#visit-count").textContent=`${count??0} kunjungan tercatat (perkiraan; tidak menghitung pengunjung unik).`;
 const {data:intros}=await db.from("member_intros").select("*").eq("status","pending").order("created_at",{ascending:false});
 $("#admin-intros").innerHTML=(intros||[]).map(i=>`<div class="admin-item"><div><strong>${esc(i.nickname)}</strong><small>${esc(i.interest)} · ${esc(i.bio)}</small></div><button class="btn secondary" data-approve="${esc(i.id)}">Setujui</button></div>`).join("")||'<p class="muted">Tidak ada intro menunggu.</p>';
 $("#admin-intros").querySelectorAll("[data-approve]").forEach(b=>b.addEventListener("click",async()=>{const {error}=await db.from("member_intros").update({status:"approved"}).eq("id",b.dataset.approve);status("#group-status",error?"Gagal menyetujui intro.":"Intro disetujui.");refresh();}));
}
$("#login-form").addEventListener("submit",async e=>{e.preventDefault();if(!db){status("#login-status","Isi URL dan publishable/anon key di config.js terlebih dahulu.");return;}const f=new FormData(e.currentTarget);const {error}=await db.auth.signInWithPassword({email:f.get("email"),password:f.get("password")});status("#login-status",error?"Login gagal. Periksa email/password.":"Login berhasil.");if(!error)refresh();});
$("#logout").addEventListener("click",async()=>{await db?.auth.signOut();refresh();});
$("#group-form").addEventListener("submit",async e=>{e.preventDefault();if(!db)return;const f=new FormData(e.currentTarget);const url=String(f.get("invite_url")).trim();if(!/^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+$/.test(url)){status("#group-status","Masukkan link undangan WhatsApp yang valid.");return;}const payload={name:String(f.get("name")).trim(),category:String(f.get("category")).trim(),description:String(f.get("description")).trim(),invite_url:url,is_published:f.has("is_published")};const {error}=await db.from("community_groups").insert(payload);status("#group-status",error?"Gagal menyimpan. Pastikan akun memiliki hak Owner.":"Grup berhasil disimpan.");if(!error){e.currentTarget.reset();refresh();}});
if(!configured)status("#login-status","Konfigurasi Supabase belum diisi. Buka config.js sesuai README.");
refresh();