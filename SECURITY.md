# Security and deployment notes

- `config.js` contains browser-visible Supabase project URL and publishable/anon key. This key is not a secret; database access must be restricted by RLS.
- Never put a Supabase `service_role` key, database password, or secret key in browser files, GitHub, or this ZIP.
- `/api/groups` uses Vercel Environment Variables `SUPABASE_URL` and `SUPABASE_ANON_KEY` and only reads published group fields. It must not use a service-role key.
- Keep RLS enabled on every table. Review policies before running SQL on an existing project.
- `schema.sql` is for a new project. The three feature migrations are additive but still must be reviewed and backed up before execution.
- Public forms can be abused. Configure Supabase Auth limits and add a CAPTCHA/rate limiter before promoting registration or public intro submission broadly.
- Dashboard pages are not secret just because their URLs are hard to guess. Authentication and database RLS are the actual access controls.
- Do not commit `.env` files. `.env.example` contains placeholders only.
