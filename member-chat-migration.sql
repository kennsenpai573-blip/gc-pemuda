-- Grup Pemuda: private one-to-one member chat
-- Run once in Supabase SQL Editor. Does not drop existing tables/data.

create table if not exists public.member_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.staff_profiles(user_id) on delete cascade,
  recipient_id uuid not null references public.staff_profiles(user_id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  constraint member_messages_no_self_chat check (sender_id <> recipient_id)
);

create index if not exists member_messages_sender_recipient_created_idx
  on public.member_messages (sender_id, recipient_id, created_at);
create index if not exists member_messages_recipient_sender_created_idx
  on public.member_messages (recipient_id, sender_id, created_at);

alter table public.member_messages enable row level security;

revoke all on table public.member_messages from anon, public;
grant select, insert on table public.member_messages to authenticated;

drop policy if exists "chat participants read messages" on public.member_messages;
create policy "chat participants read messages"
  on public.member_messages for select to authenticated
  using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()));

drop policy if exists "authenticated sends as self" on public.member_messages;
create policy "authenticated sends as self"
  on public.member_messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and recipient_id <> (select auth.uid())
    and char_length(trim(body)) between 1 and 2000
  );

-- Limited directory for authenticated chat users. Email is intentionally excluded.
-- Default view security runs with the view owner's permissions, allowing the view
-- to expose only these three fields despite the base table's self/staff RLS policy.
create or replace view public.chat_member_directory as
select user_id, display_name, role
from public.staff_profiles;

revoke all on public.chat_member_directory from anon, public;
grant select on public.chat_member_directory to authenticated;
