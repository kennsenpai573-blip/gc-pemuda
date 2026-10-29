/** Optional Supabase heartbeat for the Grup Pemuda website dashboard.
 * Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Pterodactyl's environment.
 * Never commit either secret to source control.
 */
const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let warnedMissingConfig = false;
let lastStatus = 'connecting';
let timer = null;

async function writePresence(status) {
  if (!supabaseUrl || !serviceKey) {
    if (!warnedMissingConfig) {
      console.warn('[web-integration] Disabled: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured. Bot continues normally.');
      warnedMissingConfig = true;
    }
    return;
  }
  const url = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/bot_presence?on_conflict=id`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify({ id: 'main', status, last_seen: new Date().toISOString(), updated_at: new Date().toISOString() })
  });
  if (!response.ok) throw new Error(`Supabase heartbeat failed: HTTP ${response.status}`);
}

export function startBotPresence() {
  const update = async (status) => {
    if (!['online', 'offline', 'connecting'].includes(status)) return;
    lastStatus = status;
    try { await writePresence(status); }
    catch (error) { console.error('[web-integration] Heartbeat update failed:', error.message); }
  };
  if (timer) clearInterval(timer);
  update('connecting');
  timer = setInterval(() => writePresence(lastStatus).catch(error => {
    console.error('[web-integration] Heartbeat failed:', error.message);
  }), 30000);
  timer.unref?.();
  process.once('SIGINT', () => { update('offline').finally(() => process.exit(0)); });
  process.once('SIGTERM', () => { update('offline').finally(() => process.exit(0)); });
  return { setStatus: update };
}
