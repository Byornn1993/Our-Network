-- Standaardinhoud: de twee centrale profielen, de vijf netwerkcategorieën en de gebeurtenistypes.
-- Vaste UUID's, zodat elke installatie dezelfde sleutels heeft. Alles is daarna in de app aanpasbaar.

insert into public.profiles (id, slot, name) values
  ('00000000-0000-4000-8000-000000000001', 1, 'Bjorn'),
  ('00000000-0000-4000-8000-000000000002', 2, 'Stephanie')
on conflict (id) do nothing;

insert into public.categories (id, name, description, color, icon, ring, avatar_size, group_key, display_order) values
  ('00000000-0000-4000-8000-000000000101', 'Familie', 'Ouders, broers, zussen en de rest van de familie.', '#E9B949', 'home', 1, 52, 'family', 1),
  ('00000000-0000-4000-8000-000000000102', 'Beste vrienden', 'De mensen bij wie we altijd terechtkunnen.', '#F26B1D', 'heart', 2, 48, 'friends', 2),
  ('00000000-0000-4000-8000-000000000103', 'Goede vrienden', 'Vrienden die we graag en geregeld zien.', '#F5A266', 'smile', 3, 44, 'friends', 3),
  ('00000000-0000-4000-8000-000000000104', 'Collega''s', 'Mensen van het werk.', '#6BB8E8', 'briefcase', 3, 42, 'colleagues', 4),
  ('00000000-0000-4000-8000-000000000105', 'Kennissen', 'Mensen die we kennen, maar minder vaak zien.', '#8A9590', 'user', 4, 38, 'acquaintances', 5)
on conflict (id) do nothing;

insert into public.event_categories (id, system_key, name, color, icon, display_order) values
  ('00000000-0000-4000-8000-000000000201', 'first_meeting', 'Eerste ontmoeting', '#62E3B0', 'handshake', 1),
  ('00000000-0000-4000-8000-000000000202', 'new_relationship', 'Nieuwe relatie', '#F26B1D', 'heart', 2),
  ('00000000-0000-4000-8000-000000000203', 'family', 'Familiegebeurtenis', '#E9B949', 'home', 3),
  ('00000000-0000-4000-8000-000000000204', 'friendship', 'Vriendschapsmoment', '#F5A266', 'party', 4),
  ('00000000-0000-4000-8000-000000000205', 'social_change', 'Sociale verandering', '#6BB8E8', 'shuffle', 5),
  ('00000000-0000-4000-8000-000000000206', 'memory', 'Belangrijke herinnering', '#C9A7F5', 'star', 6),
  ('00000000-0000-4000-8000-000000000207', 'birthday', 'Verjaardag', '#F28CB1', 'cake', 7)
on conflict (id) do nothing;
