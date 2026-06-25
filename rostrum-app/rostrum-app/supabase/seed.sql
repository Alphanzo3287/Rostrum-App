-- =====================================================================
-- The Rostrum · seed.sql  (catalogs the app reads from)
-- =====================================================================

insert into achievements (id, name, description, icon) values
  ('first_win',  'First Blood',   'Win your first debate',                 'Swords'),
  ('orator',     'Orator',        'Reach level 10',                        'Mic'),
  ('crowd',      'Crowd Favorite','Win an audience vote by 30+ points',    'Heart'),
  ('clean',      'Clean Sweep',   'Win unanimously on the judges'' cards', 'Scale'),
  ('streak5',    'On a Roll',     'Win five debates in a row',             'Flame'),
  ('hostess',    'Master of Ceremonies','Host 10 debates',                 'Crown'),
  ('founder',    'House Founder', 'Create a team',                         'Users'),
  ('benefactor', 'Benefactor',    'Send your first gift',                  'Gift')
on conflict (id) do nothing;

insert into perks (id, name, description, cost, icon) values
  ('gold_third', 'Gold Lower-Third', 'A brass nameplate on the dais',          120, 'Sparkles'),
  ('spotlight',  'Spotlight Frame',  'A glowing ring while you hold the floor', 200, 'Star'),
  ('entrance',   'Custom Entrance',  'A short sting when you take your seat',   350, 'Flame'),
  ('hall_pass',  'Premium Hall Pass','Skip the gate on premium debates',       500, 'Crown'),
  ('emote_pack', 'Reaction Pack',    'Animated reactions for the gallery',      150, 'Heart')
on conflict (id) do nothing;
