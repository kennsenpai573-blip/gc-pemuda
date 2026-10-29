-- Border Anime untuk profil member: semua harga 1.000 saldo.
-- Jalankan di Supabase SQL Editor setelah saldo-ecosystem-migration.sql.
ALTER TABLE public.staff_profiles ADD COLUMN IF NOT EXISTS avatar_frame text;

UPDATE public.wallet_shop_items SET price=1000 WHERE category='frame' OR name ILIKE '%border%' OR name ILIKE '%bingkai%';

INSERT INTO public.wallet_shop_items (name, description, category, icon, price, is_active)
SELECT v.name, v.description, 'frame', v.icon, 1000, true
FROM (VALUES
 ('Border Alya', 'Border anime Alya dengan ornamen pita dan sakura merah muda.', 'frame-border-alya.png'),
 ('Border Mahiru', 'Border anime Mahiru bernuansa emas dan bunga sakura.', 'frame-border-mahiru.png'),
 ('Border Tohka', 'Border anime Tohka dengan kristal dan cahaya ungu.', 'frame-border-tohka.png'),
 ('Border Mai', 'Border anime Mai dengan sakura dan cahaya biru-ungu.', 'frame-border-mai.png'),
 ('Border Kurumi', 'Border anime Kurumi dengan jam dan ornamen merah gelap.', 'frame-border-kurumi.png'),
 ('Border Elaina', 'Border anime Elaina dengan sihir, kupu-kupu, dan kristal ungu.', 'frame-border-elaina.png'),
 ('Border Mai Blue', 'Varian border Mai dengan sakura dan cahaya biru.', 'frame-border-mai-blue.png')
) AS v(name, description, icon)
WHERE NOT EXISTS (SELECT 1 FROM public.wallet_shop_items i WHERE i.name=v.name AND i.category='frame');

UPDATE public.wallet_shop_items SET price=1000 WHERE name IN ('Border Alya','Border Mahiru','Border Tohka','Border Mai','Border Kurumi','Border Elaina','Border Mai Blue');
