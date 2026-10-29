import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
const $=s=>document.querySelector(s), root=$("#global-member-profile");
if(root && SUPABASE_URL.startsWith("https://") && !SUPABASE_ANON_KEY.includes("PASTE_")){
 const db=createClient(SUPABASE_URL,SUPABASE_ANON_KEY);let activeUser=null;
 db.auth.getUser().then(({data})=>activeUser=data?.user||null);
 const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const show=(id,v)=>{const el=$(id);if(el)el.textContent=v||""};
 const date=v=>v?new Date(v).toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"}):"—";
 async function openProfile(uid){if(!uid)return;root.classList.remove("hidden");show("#global-profile-name","Memuat profil…");show("#global-profile-role","");show("#global-profile-status","");show("#global-profile-joined","");show("#global-profile-rank","");show("#global-profile-tiktok","");
  let data=null;const a=await db.rpc("list_public_members");if(!a.error&&Array.isArray(a.data))data=a.data.find(x=>String(x.user_id)===String(uid))||null;
  if(!data){const b=await db.from("public_member_status").select("user_id,display_name,avatar_url,created_at,last_seen_at,is_online,public_user_id").eq("user_id",uid).maybeSingle();data=b.data;}
  if(!data){const c=await db.from("chat_member_directory").select("user_id,display_name,role,avatar_url,created_at").eq("user_id",uid).maybeSingle();data=c.data;}
  if(!data){show("#global-profile-name","Profil tidak dapat dimuat");return;}
  const cover=$("#global-profile-cover");
  if(cover){
   const banner=data.profile_banner_url||data.banner_url||data.cover_url||data.banner_image_url||"";
   cover.style.backgroundImage=banner?`linear-gradient(115deg,#07051555,#a855f733 45%,#22d3ee22),url("${String(banner).replace(/["\\]/g,"")}")`:"";
   cover.classList.toggle("has-profile-banner",!!banner);
  }
  const frames=await db.rpc("public_member_avatar_frames");const frame=Array.isArray(frames.data)?frames.data.find(x=>x.user_id===uid)?.avatar_frame||"":"";
  const avatar=$("#global-profile-avatar");avatar.style.backgroundImage=data.avatar_url?`url("${String(data.avatar_url).replace(/["\\]/g,"")}")`:"";avatar.textContent=data.avatar_url?"":"友";avatar.classList.toggle("has-avatar-frame",!!frame);if(frame)avatar.dataset.avatarFrame=frame;else delete avatar.dataset.avatarFrame;
  show("#global-profile-name",data.display_name||"Member");show("#global-profile-role",String(data.role||"MEMBER").toUpperCase());show("#global-profile-joined","Bergabung sejak "+date(data.created_at));
  const seen=data.last_seen_at;const online=typeof data.is_online==="boolean"?data.is_online:(seen&&Date.now()-new Date(seen).getTime()<120000);const status=$("#global-profile-status");status.textContent=online?"● Online sekarang":`● Offline${seen?" · Terakhir dilihat "+new Date(seen).toLocaleString("id-ID",{dateStyle:"medium",timeStyle:"short"}):""}`;status.className="presence-label "+(online?"online":"offline");
  const points=Number(data.points)||0;show("#global-profile-rank",`🏆 Level ${1+Math.floor(points/100)} · ${points} poin`);
  const tik=await db.from("tiktok_verifications").select("username,profile_url").eq("user_id",uid).eq("status","verified").maybeSingle();const t=$("#global-profile-tiktok");t.replaceChildren();if(tik.data){const link=document.createElement("a");link.href=tik.data.profile_url;link.target="_blank";link.rel="noopener noreferrer";link.className="tiktok-profile-link";link.textContent=`TikTok @${String(tik.data.username||"").replace(/^@/,"")} ✓ Terverifikasi`;t.append(link);}
  const chat=$("#global-profile-chat");chat.classList.toggle("hidden",!activeUser||activeUser.id===uid);chat.onclick=()=>{location.href=`/member.html?chat=${encodeURIComponent(uid)}#chat-section`;};
  const friend=$("#global-profile-friend"), note=$("#global-profile-friend-note");
  if(friend){friend.classList.toggle("hidden",!activeUser||activeUser.id===uid);note.textContent="";friend.disabled=false;friend.onclick=null;
   if(activeUser&&activeUser.id!==uid){
    friend.textContent="Memeriksa status teman…";friend.disabled=true;
    const state=await db.rpc("member_friend_status",{p_other:uid});
    const status=state.error?"error":state.data;
    const labels={none:"＋ Tambah Teman",sent:"✓ Permintaan Terkirim",received:"Terima Permintaan Teman",friends:"✓ Sudah Berteman · Hapus",login_required:"Login untuk berteman",self:"Ini profil kamu"};
    friend.textContent=labels[status]||"＋ Tambah Teman";friend.disabled=false;
    if(status==="error"){note.textContent="Fitur teman belum aktif. Owner perlu menjalankan friend-feature-migration.sql di Supabase.";friend.textContent="Fitur teman belum aktif";friend.disabled=true;}
    friend.onclick=async()=>{
     friend.disabled=true;note.textContent="Memproses…";
     let result;
     if(status==="none") result=await db.rpc("member_send_friend_request",{p_other:uid});
     else if(status==="received") result=await db.rpc("member_respond_friend_request",{p_other:uid,p_accept:true});
     else if(status==="friends") result=await db.rpc("member_remove_friend",{p_other:uid});
     else if(status==="sent"){note.textContent="Permintaan teman sudah terkirim. Tunggu konfirmasi.";friend.disabled=false;return;}
     else {note.textContent="Status tidak dapat diubah.";friend.disabled=false;return;}
     if(result?.error){note.textContent=result.error.message||"Gagal memproses permintaan.";friend.disabled=false;return;}
     note.textContent=result?.data==="friends"?"Kalian sekarang berteman!":result?.data==="sent"?"Permintaan teman terkirim.":"Status pertemanan diperbarui.";
     await openProfile(uid);
    };
   } else if(!activeUser){friend.textContent="Login untuk berteman";note.textContent="Kamu harus login sebagai member terdaftar untuk menggunakan fitur ini.";friend.disabled=true;}
  }
 }
 document.addEventListener("click",e=>{if(e.target.closest("[data-global-profile-close]")){root.classList.add("hidden");return;}if(e.target===root){root.classList.add("hidden");return;}const trigger=e.target.closest("[data-profile-id]");if(!trigger)return;const uid=trigger.dataset.profileId;if(uid){e.preventDefault();openProfile(uid);}});
 document.addEventListener("keydown",e=>{if(e.key==="Escape")root.classList.add("hidden");});
}
