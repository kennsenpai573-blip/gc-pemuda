-- Saldo virtual internal komunitas (bukan uang sungguhan)
create table if not exists public.member_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance bigint not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_transactions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount bigint not null check (amount <> 0),
  balance_after bigint not null check (balance_after >= 0),
  note text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists wallet_transactions_user_created_idx on public.wallet_transactions(user_id, created_at desc);

alter table public.member_wallets enable row level security;
alter table public.wallet_transactions enable row level security;
revoke all on public.member_wallets from anon, authenticated;
revoke all on public.wallet_transactions from anon, authenticated;
grant select on public.member_wallets, public.wallet_transactions to authenticated;

drop policy if exists wallet_select_own_or_owner on public.member_wallets;
create policy wallet_select_own_or_owner on public.member_wallets for select to authenticated
using (user_id = auth.uid() or exists (select 1 from public.staff_profiles p where p.user_id = auth.uid() and lower(p.role) = 'owner'));
drop policy if exists wallet_tx_select_own_or_owner on public.wallet_transactions;
create policy wallet_tx_select_own_or_owner on public.wallet_transactions for select to authenticated
using (user_id = auth.uid() or exists (select 1 from public.staff_profiles p where p.user_id = auth.uid() and lower(p.role) = 'owner'));

create or replace function public.owner_adjust_member_balance(p_user_id uuid, p_amount bigint, p_note text default '')
returns table(new_balance bigint, transaction_id bigint)
language plpgsql security definer set search_path = public
as $$
declare v_balance bigint; v_tx bigint;
begin
  if auth.uid() is null then raise exception 'Login diperlukan'; end if;
  if not exists (select 1 from public.staff_profiles p where p.user_id = auth.uid() and lower(p.role) = 'owner') then
    raise exception 'Hanya Owner yang boleh mengubah saldo';
  end if;
  if p_user_id is null or p_amount is null or p_amount = 0 then raise exception 'Member dan nominal wajib diisi'; end if;
  if abs(p_amount) > 1000000000 then raise exception 'Nominal terlalu besar'; end if;
  insert into public.member_wallets(user_id, balance) values (p_user_id, 0) on conflict (user_id) do nothing;
  select balance into v_balance from public.member_wallets where user_id = p_user_id for update;
  if v_balance + p_amount < 0 then raise exception 'Saldo tidak cukup untuk pengurangan ini'; end if;
  update public.member_wallets set balance = v_balance + p_amount, updated_at = now() where user_id = p_user_id returning balance into v_balance;
  insert into public.wallet_transactions(user_id, amount, balance_after, note, created_by)
  values (p_user_id, p_amount, v_balance, left(coalesce(p_note, ''), 200), auth.uid()) returning id into v_tx;
  return query select v_balance, v_tx;
end; $$;
revoke all on function public.owner_adjust_member_balance(uuid,bigint,text) from public, anon;
grant execute on function public.owner_adjust_member_balance(uuid,bigint,text) to authenticated;

-- Wallet dibuat otomatis saat profil dibuat, bila trigger profil sudah tersedia tidak diperlukan.
insert into public.member_wallets(user_id)
select user_id from public.staff_profiles on conflict (user_id) do nothing;
