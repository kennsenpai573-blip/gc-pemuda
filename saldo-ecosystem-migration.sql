-- Fitur ekonomi komunitas virtual: toko kosmetik, hadiah, misi, daily reward, level.
-- Jalankan setelah saldo-migration.sql. Bukan uang sungguhan dan tidak bisa dicairkan.
create table if not exists public.wallet_shop_items (
 id uuid primary key default gen_random_uuid(), name text not null check(char_length(name) between 1 and 80),
 description text not null default '', category text not null default 'badge' check(category in ('badge','frame','theme','effect','title','gift')),
 icon text not null default '✨', price bigint not null check(price >= 0), is_active boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.wallet_inventory (
 id bigint generated always as identity primary key, user_id uuid not null references auth.users(id) on delete cascade,
 item_id uuid not null references public.wallet_shop_items(id) on delete restrict,
 item_name text not null, category text not null, icon text not null, purchased_at timestamptz not null default now(),
 unique(user_id,item_id)
);
create table if not exists public.wallet_missions (
 id uuid primary key default gen_random_uuid(), title text not null check(char_length(title) between 1 and 100),
 description text not null default '', reward bigint not null check(reward between 1 and 100000),
 cadence text not null default 'once' check(cadence in ('once','daily','weekly')), is_active boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.wallet_mission_claims (
 id bigint generated always as identity primary key, mission_id uuid not null references public.wallet_missions(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade, period_key text not null,
 reward bigint not null, created_at timestamptz not null default now(), unique(mission_id,user_id,period_key)
);
create table if not exists public.wallet_gifts (
 id bigint generated always as identity primary key, sender_id uuid not null references auth.users(id), receiver_id uuid not null references auth.users(id),
 amount bigint not null check(amount > 0), note text not null default '', created_at timestamptz not null default now(),
 check(sender_id <> receiver_id)
);

alter table public.wallet_shop_items enable row level security;
alter table public.wallet_inventory enable row level security;
alter table public.wallet_missions enable row level security;
alter table public.wallet_mission_claims enable row level security;
alter table public.wallet_gifts enable row level security;
revoke all on public.wallet_shop_items,public.wallet_inventory,public.wallet_missions,public.wallet_mission_claims,public.wallet_gifts from anon,authenticated;
grant select on public.wallet_shop_items,public.wallet_inventory,public.wallet_missions,public.wallet_mission_claims,public.wallet_gifts to authenticated;
grant insert,update,delete on public.wallet_shop_items,public.wallet_missions to authenticated;
grant select,insert on public.wallet_inventory,public.wallet_mission_claims,public.wallet_gifts to authenticated;
grant usage,select on sequence public.wallet_inventory_id_seq,public.wallet_mission_claims_id_seq,public.wallet_gifts_id_seq to authenticated;

drop policy if exists shop_read_active_or_owner on public.wallet_shop_items;
create policy shop_read_active_or_owner on public.wallet_shop_items for select to authenticated using(is_active or public.is_owner());
drop policy if exists shop_owner_manage on public.wallet_shop_items;
create policy shop_owner_manage on public.wallet_shop_items for all to authenticated using(public.is_owner()) with check(public.is_owner());
drop policy if exists inventory_read_self_owner on public.wallet_inventory;
create policy inventory_read_self_owner on public.wallet_inventory for select to authenticated using(user_id=auth.uid() or public.is_owner());
drop policy if exists missions_read_active_owner on public.wallet_missions;
create policy missions_read_active_owner on public.wallet_missions for select to authenticated using(is_active or public.is_owner());
drop policy if exists missions_owner_manage on public.wallet_missions;
create policy missions_owner_manage on public.wallet_missions for all to authenticated using(public.is_owner()) with check(public.is_owner());
drop policy if exists claims_read_self_owner on public.wallet_mission_claims;
create policy claims_read_self_owner on public.wallet_mission_claims for select to authenticated using(user_id=auth.uid() or public.is_owner());
drop policy if exists gifts_read_participants_owner on public.wallet_gifts;
create policy gifts_read_participants_owner on public.wallet_gifts for select to authenticated using(sender_id=auth.uid() or receiver_id=auth.uid() or public.is_owner());

create or replace function public.wallet_list_members() returns table(user_id uuid, display_name text) language sql stable security definer set search_path=public as $$ select p.user_id,p.display_name from public.staff_profiles p where p.role='member' and auth.uid() is not null order by p.display_name; $$;

create or replace function public.wallet_purchase_item(p_item_id uuid) returns bigint language plpgsql security definer set search_path=public as $$
declare v_item public.wallet_shop_items%rowtype; v_bal bigint;
begin
 if auth.uid() is null then raise exception 'Login diperlukan'; end if;
 select * into v_item from public.wallet_shop_items where id=p_item_id and is_active=true for update;
 if not found then raise exception 'Barang tidak tersedia'; end if;
 insert into public.member_wallets(user_id,balance) values(auth.uid(),0) on conflict(user_id) do nothing;
 if exists(select 1 from public.wallet_inventory where user_id=auth.uid() and item_id=p_item_id) then raise exception 'Barang sudah dimiliki'; end if;
 select balance into v_bal from public.member_wallets where user_id=auth.uid() for update;
 if v_bal < v_item.price then raise exception 'Saldo tidak cukup'; end if;
 if v_item.price > 0 then
   update public.member_wallets set balance=balance-v_item.price,updated_at=now() where user_id=auth.uid() returning balance into v_bal;
   insert into public.wallet_transactions(user_id,amount,balance_after,note,created_by)
   values(auth.uid(),-v_item.price,v_bal,'Belanja: '||v_item.name,auth.uid());
 else
   -- Item gratis tidak membuat transaksi amount=0 karena constraint database melarangnya.
   select balance into v_bal from public.member_wallets where user_id=auth.uid();
 end if;
 insert into public.wallet_inventory(user_id,item_id,item_name,category,icon) values(auth.uid(),v_item.id,v_item.name,v_item.category,v_item.icon);
 return v_bal;
end; $$;

create or replace function public.wallet_claim_daily() returns bigint language plpgsql security definer set search_path=public as $$
declare v_bal bigint; v_today text := to_char(now() at time zone 'UTC','YYYY-MM-DD');
begin
 if auth.uid() is null then raise exception 'Login diperlukan'; end if;
 if exists(select 1 from public.wallet_transactions where user_id=auth.uid() and note='Bonus login harian' and created_at >= date_trunc('day',now() at time zone 'UTC') at time zone 'UTC') then raise exception 'Bonus harian sudah diambil'; end if;
 insert into public.member_wallets(user_id,balance) values(auth.uid(),0) on conflict(user_id) do nothing;
 update public.member_wallets set balance=balance+20,updated_at=now() where user_id=auth.uid() returning balance into v_bal;
 insert into public.wallet_transactions(user_id,amount,balance_after,note,created_by) values(auth.uid(),20,v_bal,'Bonus login harian',auth.uid());
 return v_bal;
end; $$;

create or replace function public.wallet_claim_mission(p_mission_id uuid) returns bigint language plpgsql security definer set search_path=public as $$
declare m public.wallet_missions%rowtype; v_key text; v_bal bigint;
begin
 if auth.uid() is null then raise exception 'Login diperlukan'; end if;
 select * into m from public.wallet_missions where id=p_mission_id and is_active=true;
 if not found then raise exception 'Misi tidak tersedia'; end if;
 v_key := case m.cadence when 'daily' then to_char(now() at time zone 'UTC','YYYY-MM-DD') when 'weekly' then to_char(date_trunc('week',now() at time zone 'UTC'),'IYYY-IW') else 'once' end;
 insert into public.wallet_mission_claims(mission_id,user_id,period_key,reward) values(m.id,auth.uid(),v_key,m.reward);
 insert into public.member_wallets(user_id,balance) values(auth.uid(),0) on conflict(user_id) do nothing;
 update public.member_wallets set balance=balance+m.reward,updated_at=now() where user_id=auth.uid() returning balance into v_bal;
 insert into public.wallet_transactions(user_id,amount,balance_after,note,created_by) values(auth.uid(),m.reward,v_bal,'Hadiah misi: '||m.title,auth.uid());
 return v_bal;
end; $$;

create or replace function public.wallet_send_gift(p_receiver_id uuid,p_amount bigint,p_note text default '') returns bigint language plpgsql security definer set search_path=public as $$
declare v_sender bigint; v_receiver bigint; v_name text;
begin
 if auth.uid() is null then raise exception 'Login diperlukan'; end if;
 if p_receiver_id is null or p_receiver_id=auth.uid() then raise exception 'Pilih member lain'; end if;
 if p_amount is null or p_amount<1 or p_amount>10000 then raise exception 'Nominal harus 1 sampai 10000 poin'; end if;
 if not exists(select 1 from public.staff_profiles where user_id=p_receiver_id and role='member') then raise exception 'Penerima bukan member'; end if;
 insert into public.member_wallets(user_id,balance) values(auth.uid(),0) on conflict(user_id) do nothing;
 insert into public.member_wallets(user_id,balance) values(p_receiver_id,0) on conflict(user_id) do nothing;
 perform 1 from public.member_wallets where user_id in (auth.uid(),p_receiver_id) order by user_id for update;
 select balance into v_sender from public.member_wallets where user_id=auth.uid();
 if v_sender<p_amount then raise exception 'Saldo tidak cukup'; end if;
 update public.member_wallets set balance=balance-p_amount,updated_at=now() where user_id=auth.uid() returning balance into v_sender;
 update public.member_wallets set balance=balance+p_amount,updated_at=now() where user_id=p_receiver_id returning balance into v_receiver;
 select display_name into v_name from public.staff_profiles where user_id=auth.uid();
 insert into public.wallet_transactions(user_id,amount,balance_after,note,created_by) values(auth.uid(),-p_amount,v_sender,'Hadiah ke '||coalesce((select display_name from public.staff_profiles where user_id=p_receiver_id),'Member')||': '||left(coalesce(p_note,''),100),auth.uid());
 insert into public.wallet_transactions(user_id,amount,balance_after,note,created_by) values(p_receiver_id,p_amount,v_receiver,'Hadiah dari '||coalesce(v_name,'Member')||': '||left(coalesce(p_note,''),100),auth.uid());
 insert into public.wallet_gifts(sender_id,receiver_id,amount,note) values(auth.uid(),p_receiver_id,p_amount,left(coalesce(p_note,''),100));
 return v_sender;
end; $$;
revoke all on function public.wallet_list_members(),public.wallet_purchase_item(uuid),public.wallet_claim_daily(),public.wallet_claim_mission(uuid),public.wallet_send_gift(uuid,bigint,text) from public,anon;
grant execute on function public.wallet_list_members(),public.wallet_purchase_item(uuid),public.wallet_claim_daily(),public.wallet_claim_mission(uuid),public.wallet_send_gift(uuid,bigint,text) to authenticated;

insert into public.wallet_shop_items(name,description,category,icon,price) values
('Badge VIP','Badge ungu untuk profil member.','badge','👑',300),('Bingkai Avatar Ungu','Bingkai profil bernuansa violet.','frame','🟣',200),('Efek Neon','Efek visual neon untuk koleksi profil.','effect','✨',250),('Gelar Elite','Gelar eksklusif untuk koleksi member.','title','🏷️',150),('Tema Dark Luxury','Tema hitam-ungu untuk koleksi akun.','theme','🌌',400),('Hadiah Bintang','Item hadiah virtual untuk dikoleksi.','gift','⭐',100)
on conflict do nothing;
insert into public.wallet_missions(title,description,reward,cadence) values
('Sambutan Member','Klaim bonus misi sambutan komunitas.',50,'once'),('Misi Harian','Kembali ke komunitas dan klaim reward harian.',20,'daily'),('Aktif di Komunitas','Reward mingguan untuk partisipasi komunitas.',100,'weekly')
on conflict do nothing;
