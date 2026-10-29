import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

(async function applyGlobalBackground() {
  // Apply the Owner-selected global background to every page that includes this module.
  if (SUPABASE_URL.startsWith("https://") && SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.includes("PASTE_")) {
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    try {
      const { data } = await client.from("site_settings").select("value").eq("key", "global_background").maybeSingle();
      const value = data?.value;
      if (value?.url) {
        if (value.type === "video") {
          const video = document.createElement("video");
          video.className = "global-background-video";
          video.src = value.url;
          video.autoplay = true; video.muted = true; video.loop = true; video.playsInline = true;
          video.setAttribute("aria-hidden", "true");
          document.body.prepend(video);
          document.documentElement.classList.add("has-global-background-video");
        } else {
          document.documentElement.style.setProperty("--global-background-image", `url("${String(value.url).replace(/["\\]/g, "")}")`);
          document.documentElement.classList.add("has-global-background-image");
        }
      }
    } catch (e) { console.warn("Background global belum dapat dimuat.", e); }
  }
})();
