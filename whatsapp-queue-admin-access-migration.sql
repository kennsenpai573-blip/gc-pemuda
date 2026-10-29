-- Jalankan sekali di Supabase SQL Editor untuk memberi Owner dan Admin akses antrean WhatsApp.
-- Aman untuk tabel yang sudah ada; tidak menghapus pesan atau mengubah data antrean.
alter table public.whatsapp_message_queue enable row level security;
drop policy if exists "Owner manage WhatsApp queue" on public.whatsapp_message_queue;
drop policy if exists "Staff manage WhatsApp queue" on public.whatsapp_message_queue;
create policy "Staff manage WhatsApp queue" on public.whatsapp_message_queue
  for all to authenticated
  using (exists (
    select 1 from public.staff_profiles sp
    where sp.user_id = auth.uid() and sp.role in ('owner', 'admin')
  ))
  with check (exists (
    select 1 from public.staff_profiles sp
    where sp.user_id = auth.uid() and sp.role in ('owner', 'admin')
  ));
revoke all on public.whatsapp_message_queue from anon;
grant select, insert, update, delete on public.whatsapp_message_queue to authenticated;
grant all on public.whatsapp_message_queue to service_role;
