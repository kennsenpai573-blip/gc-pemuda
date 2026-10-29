-- Status bot WhatsApp: bot menulis melalui SUPABASE_SERVICE_ROLE_KEY di server Pterodactyl.
-- Dashboard hanya dapat membaca status setelah login sebagai Owner.
create table if not exists public.bot_presence (
  id text primary key check (id = 'main'),
  status text not null default 'offline' check (status in ('online','offline','connecting')),
  last_seen timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.bot_presence enable row level security;
drop policy if exists "Owner can read bot presence" on public.bot_presence;
create policy "Owner can read bot presence"
  on public.bot_presence for select to authenticated
  using (public.is_owner());
revoke all on public.bot_presence from anon, authenticated;
grant select on public.bot_presence to authenticated;
