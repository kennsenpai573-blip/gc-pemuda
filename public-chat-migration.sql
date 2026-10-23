-- Grup Pemuda: public community chat with replies and reactions.
-- Run once in Supabase SQL Editor. Existing private-chat data is untouched.

create table if not exists public.public_chat_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.staff_profiles(user_id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  reply_to_id uuid null references public.public_chat_messages(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists public_chat_messages_created_idx on public.public_chat_messages(created_at desc);
create index if not exists public_chat_messages_reply_idx on public.public_chat_messages(reply_to_id);

create table if not exists public.public_chat_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.public_chat_messages(id) on delete cascade,
  user_id uuid not null references public.staff_profiles(user_id) on delete cascade,
  reaction text not null check (reaction in ('❤️','😂','👍','🔥','😮','😢')),
  created_at timestamptz not null default now(),
  constraint public_chat_reactions_one_per_user unique (message_id, user_id)
);
create index if not exists public_chat_reactions_message_idx on public.public_chat_reactions(message_id);

alter table public.public_chat_messages enable row level security;
alter table public.public_chat_reactions enable row level security;
revoke all on public.public_chat_messages from anon, public;
revoke all on public.public_chat_reactions from anon, public;
grant select, insert, delete on public.public_chat_messages to authenticated;
grant select, insert, update, delete on public.public_chat_reactions to authenticated;

drop policy if exists "public chat members read messages" on public.public_chat_messages;
create policy "public chat members read messages" on public.public_chat_messages
for select to authenticated using (
  exists (select 1 from public.staff_profiles p where p.user_id = (select auth.uid()))
);
drop policy if exists "public chat members send as self" on public.public_chat_messages;
create policy "public chat members send as self" on public.public_chat_messages
for insert to authenticated with check (
  sender_id = (select auth.uid())
  and exists (select 1 from public.staff_profiles p where p.user_id = (select auth.uid()))
  and char_length(trim(body)) between 1 and 2000
  and (reply_to_id is null or exists (select 1 from public.public_chat_messages parent where parent.id = reply_to_id))
);
drop policy if exists "authors delete own public messages" on public.public_chat_messages;
create policy "authors delete own public messages" on public.public_chat_messages
for delete to authenticated using (sender_id = (select auth.uid()));

drop policy if exists "public chat members read reactions" on public.public_chat_reactions;
create policy "public chat members read reactions" on public.public_chat_reactions
for select to authenticated using (
  exists (select 1 from public.staff_profiles p where p.user_id = (select auth.uid()))
);
drop policy if exists "members add own reactions" on public.public_chat_reactions;
create policy "members add own reactions" on public.public_chat_reactions
for insert to authenticated with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.staff_profiles p where p.user_id = (select auth.uid()))
  and exists (select 1 from public.public_chat_messages m where m.id = message_id)
);
drop policy if exists "members change own reactions" on public.public_chat_reactions;
create policy "members change own reactions" on public.public_chat_reactions
for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "members remove own reactions" on public.public_chat_reactions;
create policy "members remove own reactions" on public.public_chat_reactions
for delete to authenticated using (user_id = (select auth.uid()));
