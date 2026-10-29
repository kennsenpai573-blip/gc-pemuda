-- Bonus poin saat membeli border anime dengan saldo.
-- Jalankan sekali di Supabase SQL Editor setelah backup database.
-- Poin diberikan hanya untuk item yang termasuk border/bingkai; 50% harga, dibulatkan ke bawah.

create or replace function public.wallet_purchase_item(p_item_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.wallet_shop_items%rowtype;
  v_bal bigint;
  v_bonus integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Login diperlukan';
  end if;

  select * into v_item
  from public.wallet_shop_items
  where id = p_item_id and is_active = true
  for update;

  if not found then
    raise exception 'Barang tidak tersedia';
  end if;

  insert into public.member_wallets(user_id, balance)
  values(auth.uid(), 0)
  on conflict(user_id) do nothing;

  if exists (
    select 1 from public.wallet_inventory
    where user_id = auth.uid() and item_id = p_item_id
  ) then
    raise exception 'Barang sudah dimiliki';
  end if;

  select balance into v_bal
  from public.member_wallets
  where user_id = auth.uid()
  for update;

  if v_bal < v_item.price then
    raise exception 'Saldo tidak cukup';
  end if;

  if v_item.price > 0 then
    update public.member_wallets
    set balance = balance - v_item.price, updated_at = now()
    where user_id = auth.uid()
    returning balance into v_bal;

    insert into public.wallet_transactions(user_id, amount, balance_after, note, created_by)
    values(auth.uid(), -v_item.price, v_bal, 'Belanja: ' || v_item.name, auth.uid());
  end if;

  insert into public.wallet_inventory(user_id, item_id, item_name, category, icon)
  values(auth.uid(), v_item.id, v_item.name, v_item.category, v_item.icon);

  -- Border/bingkai mendapat poin sebesar setengah harga. Semua dilakukan
  -- dalam transaksi yang sama dengan pemotongan saldo agar tidak bisa diklaim berulang.
  if v_item.price > 0 and (
    coalesce(v_item.category, '') ilike '%border%'
    or coalesce(v_item.category, '') ilike '%bingkai%'
    or coalesce(v_item.name, '') ilike '%border%'
    or coalesce(v_item.name, '') ilike '%bingkai%'
  ) then
    v_bonus := floor(v_item.price::numeric / 2)::integer;
    if v_bonus > 0 then
      update public.staff_profiles
      set points = coalesce(points, 0) + v_bonus
      where user_id = auth.uid();
      if not found then
        raise exception 'Profil member tidak ditemukan; pembelian dibatalkan';
      end if;
    end if;
  end if;

  return v_bal;
end;
$$;

revoke all on function public.wallet_purchase_item(uuid) from public;
grant execute on function public.wallet_purchase_item(uuid) to authenticated;
