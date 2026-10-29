-- Perbaikan akses daftar member untuk Owner dan akun Member.
-- Tidak mengubah/menghapus view lama, sehingga aman dari error 42P16.
-- Fungsi hanya mengembalikan kolom profil publik yang diperlukan halaman members.

create or replace function public.list_public_members()
returns table (
  user_id uuid,
  public_user_id text,
  display_name text,
  created_at timestamptz,
  avatar_url text,
  is_online boolean,
  last_seen_at timestamptz
)
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select
    p.user_id,
    p.public_user_id::text,
    p.display_name,
    p.created_at,
    p.avatar_url,
    coalesce(mp.last_seen_at > now() - interval '2 minutes', false) as is_online,
    mp.last_seen_at
  from public.staff_profiles p
  left join public.member_presence mp on mp.user_id = p.user_id
  where p.role = 'member'
    and coalesce(p.approval_status, 'approved') = 'approved'
  order by p.created_at desc;
$$;

revoke all on function public.list_public_members() from public;
grant execute on function public.list_public_members() to anon, authenticated;
notify pgrst, 'reload schema';
