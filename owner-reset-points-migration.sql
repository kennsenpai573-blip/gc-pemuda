-- Reset poin level oleh Owner saja. Tidak mengubah saldo dompet/riwayat transaksi.
-- Jalankan sekali di Supabase SQL Editor setelah leaderboard-migration.sql.

create or replace function public.owner_reset_member_points(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if not exists (
    select 1 from public.staff_profiles sp
    where sp.user_id = auth.uid() and lower(coalesce(sp.role, '')) = 'owner'
  ) then
    raise exception 'Akses ditolak: fitur reset poin hanya untuk Owner.';
  end if;

  if not exists (
    select 1 from public.staff_profiles sp
    where sp.user_id = p_user_id and lower(coalesce(sp.role, '')) <> 'owner'
  ) then
    raise exception 'Target tidak ditemukan atau akun Owner tidak dapat direset lewat fitur member.';
  end if;

  update public.staff_profiles
     set points = 0, tier = 'Warrior'
   where user_id = p_user_id;
end;
$$;

create or replace function public.owner_reset_all_member_points()
returns integer
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare affected integer;
begin
  if not exists (
    select 1 from public.staff_profiles sp
    where sp.user_id = auth.uid() and lower(coalesce(sp.role, '')) = 'owner'
  ) then
    raise exception 'Akses ditolak: fitur reset poin hanya untuk Owner.';
  end if;

  update public.staff_profiles
     set points = 0, tier = 'Warrior'
   where lower(coalesce(role, '')) <> 'owner';
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.owner_reset_member_points(uuid) from public, anon;
revoke all on function public.owner_reset_all_member_points() from public, anon;
grant execute on function public.owner_reset_member_points(uuid) to authenticated;
grant execute on function public.owner_reset_all_member_points() to authenticated;
