-- Bingkai avatar virtual untuk member
-- Jalankan sekali di Supabase SQL Editor setelah saldo-ecosystem-migration.sql.
alter table public.staff_profiles add column if not exists avatar_frame text;

-- Tambahkan bingkai contoh tanpa menggandakan item jika query dijalankan ulang.
insert into public.wallet_shop_items (name, description, category, icon, price, is_active)
select v.name, v.description, 'frame', v.icon, v.price, true
from (values
  ('Bingkai Dasar', 'Bingkai sederhana gratis untuk member baru.', '▫️', 0),
  ('Bingkai Ungu', 'Bingkai ungu elegan untuk avatar.', '💜', 100),
  ('Bingkai Emas', 'Bingkai emas untuk tampilan premium.', '👑', 250),
  ('Bingkai Es', 'Bingkai biru es yang bersih.', '🧊', 175),
  ('Bingkai Mawar', 'Bingkai merah muda untuk avatar.', '🌹', 150),
  ('Bingkai Neon', 'Bingkai neon ungu lembut.', '✨', 300)
) as v(name, description, icon, price)
where not exists (select 1 from public.wallet_shop_items i where i.name = v.name and i.category = 'frame');
