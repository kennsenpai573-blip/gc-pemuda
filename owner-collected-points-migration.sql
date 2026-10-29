-- Owner-only RPC: menampilkan poin dan level member. Level tidak memiliki batas maksimum.
create or replace function public.owner_list_member_points()
returns table(user_id uuid, display_name text, points integer, tier text)
language plpgsql stable security definer set search_path=public set row_security=off as $$
begin
 if not exists (select 1 from public.staff_profiles sp where sp.user_id=auth.uid() and lower(coalesce(sp.role,''))='owner') then raise exception 'Akses ditolak: khusus Owner.'; end if;
 return query select sp.user_id, sp.display_name, greatest(0,coalesce(sp.points,0))::integer, ('Level ' || (1 + greatest(0,coalesce(sp.points,0)) / 100))::text
 from public.staff_profiles sp order by coalesce(sp.points,0) desc, sp.display_name asc;
end; $$;
revoke all on function public.owner_list_member_points() from public, anon;
grant execute on function public.owner_list_member_points() to authenticated;
