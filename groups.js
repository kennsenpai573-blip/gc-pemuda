import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Allow', 'GET');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    return res.status(500).json({ error: 'API belum dikonfigurasi' });
  }

  try {
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await supabase
      .from('community_groups')
      .select('id,name,description,category,invite_url,created_at')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      // Keep internal database details out of public API responses.
      return res.status(500).json({ error: 'Gagal mengambil data grup' });
    }
    return res.status(200).json({ data: data ?? [] });
  } catch {
    return res.status(500).json({ error: 'Terjadi kesalahan internal' });
  }
}
