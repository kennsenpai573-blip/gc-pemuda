-- Level publik member berdasarkan total poin yang dibelanjakan di toko kosmetik profil.
-- Jalankan setelah saldo-migration.sql dan saldo-ecosystem-migration.sql.
-- Hadiah transfer, bonus harian, dan misi tidak dihitung sebagai pembelian.
create or replace function public.wallet_public_purchase_level(p_user_id uuid)
returns table(total_spent bigint, purchase_count bigint, level_no integer, level_name text, next_target bigint, progress_percent integer)
language sql stable security definer set search_path = public
as $$
  with stats as (
    select coalesce(sum((-t.amount)::bigint), 0)::bigint as spent,
           count(*)::bigint as purchases
    from public.wallet_transactions t
    where t.user_id = p_user_id
      and t.amount < 0
      and t.note like 'Belanja:%'
  ), tier as (
    select spent, purchases,
      case when spent >= 5000 then 5
           when spent >= 2500 then 4
           when spent >= 1000 then 3
           when spent >= 500 then 2
           else 1 end as lvl,
      case when spent >= 5000 then 'Legenda Toko'
           when spent >= 2500 then 'Kolektor Elite'
           when spent >= 1000 then 'Pemburu Bintang'
           when spent >= 500 then 'Kolektor'
           else 'Pemula' end as label,
      case when spent >= 5000 then null
           when spent >= 2500 then 5000::bigint
           when spent >= 1000 then 2500::bigint
           when spent >= 500 then 1000::bigint
           else 500::bigint end as target,
      case when spent >= 5000 then 100
           when spent >= 2500 then floor((spent - 2500)::numeric * 100 / 2500)::integer
           when spent >= 1000 then floor((spent - 1000)::numeric * 100 / 1500)::integer
           when spent >= 500 then floor((spent - 500)::numeric * 100 / 500)::integer
           else floor(spent::numeric * 100 / 500)::integer end as progress
    from stats
  )
  select spent, purchases, lvl, label, target, least(100, greatest(0, progress))
  from tier
  where auth.uid() is not null
    and exists (select 1 from public.staff_profiles p where p.user_id = p_user_id and p.role = 'member');
$$;
revoke all on function public.wallet_public_purchase_level(uuid) from public, anon;
grant execute on function public.wallet_public_purchase_level(uuid) to authenticated;
