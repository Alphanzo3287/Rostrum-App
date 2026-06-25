-- =====================================================================
-- The Rostrum · 0003_rls.sql
-- Row-level security, storage buckets, and realtime. Run after functions.
-- Permissive policies are OR'd together by Postgres.
-- =====================================================================

alter table profiles            enable row level security;
alter table debates             enable row level security;
alter table debate_segments     enable row level security;
alter table debate_participants enable row level security;
alter table votes               enable row level security;
alter table ballots             enable row level security;
alter table debate_results      enable row level security;
alter table questions           enable row level security;
alter table gifts               enable row level security;
alter table teams               enable row level security;
alter table team_members        enable row level security;
alter table follows             enable row level security;
alter table transactions        enable row level security;
alter table achievements        enable row level security;
alter table user_achievements   enable row level security;
alter table perks               enable row level security;
alter table user_perks          enable row level security;

-- ---------- profiles ----------
create policy profiles_read   on profiles for select using (true);
create policy profiles_update on profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- ---------- debates ----------  (public + unlisted readable; drafts only to host)
create policy debates_read   on debates for select using (host_id = auth.uid() or status <> 'draft');
create policy debates_insert on debates for insert with check (host_id = auth.uid());
create policy debates_update on debates for update using (host_id = auth.uid()) with check (host_id = auth.uid());
create policy debates_delete on debates for delete using (host_id = auth.uid());

-- ---------- segments ----------
create policy segments_read on debate_segments for select using (
  exists (select 1 from debates d where d.id = debate_id and (d.host_id = auth.uid() or d.status <> 'draft')));
create policy segments_write on debate_segments for all
  using   (exists (select 1 from debates d where d.id = debate_id and d.host_id = auth.uid()))
  with check (exists (select 1 from debates d where d.id = debate_id and d.host_id = auth.uid()));

-- ---------- participants ----------
create policy participants_read   on debate_participants for select using (true);
create policy participants_self    on debate_participants for insert with check (user_id = auth.uid());
create policy participants_update  on debate_participants for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy participants_host    on debate_participants for all
  using (exists (select 1 from debates d where d.id = debate_id and d.host_id = auth.uid()));

-- ---------- votes ---------- (write own; read own — public counts come from get_vote_tally)
create policy votes_self_read on votes for select using (voter_id = auth.uid());
create policy votes_insert    on votes for insert with check (voter_id = auth.uid());

-- ---------- ballots ----------
create policy ballots_read on ballots for select using (
  judge_id = auth.uid() or exists (select 1 from debates d where d.id = debate_id and d.host_id = auth.uid()));
create policy ballots_insert on ballots for insert with check (judge_id = auth.uid());
create policy ballots_update on ballots for update using (judge_id = auth.uid()) with check (judge_id = auth.uid());

-- ---------- results ---------- (public; written only by finalize_debate)
create policy results_read on debate_results for select using (true);

-- ---------- questions ----------
create policy questions_read   on questions for select using (true);
create policy questions_ask    on questions for insert with check (asker_id = auth.uid());
create policy questions_host   on questions for update using (
  exists (select 1 from debates d where d.id = debate_id and d.host_id = auth.uid()));

-- ---------- gifts ----------
create policy gifts_read on gifts for select using (true);
create policy gifts_send on gifts for insert with check (from_id = auth.uid());

-- ---------- teams ----------
create policy teams_read   on teams for select using (true);
create policy teams_create on teams for insert with check (owner_id = auth.uid());
create policy teams_update on teams for update using (is_team_admin(id, auth.uid())) with check (is_team_admin(id, auth.uid()));
create policy teams_delete on teams for delete using (owner_id = auth.uid());

-- ---------- team_members ---------- (is_team_admin avoids RLS recursion)
create policy members_read   on team_members for select using (true);
create policy members_manage  on team_members for all
  using (is_team_admin(team_id, auth.uid()))
  with check (is_team_admin(team_id, auth.uid()));
create policy members_leave  on team_members for delete using (user_id = auth.uid());

-- ---------- follows ----------
create policy follows_read   on follows for select using (true);
create policy follows_follow on follows for insert with check (follower_id = auth.uid());
create policy follows_unfollow on follows for delete using (follower_id = auth.uid());

-- ---------- transactions ----------
create policy tx_read on transactions for select using (user_id = auth.uid());

-- ---------- catalogs + earned ----------
create policy achievements_read on achievements      for select using (true);
create policy perks_read        on perks             for select using (true);
create policy ua_read           on user_achievements for select using (true);  -- shown on public profiles
create policy up_read           on user_perks        for select using (user_id = auth.uid());

-- =====================================================================
-- Storage buckets (public read; users write only under their own uid/ folder)
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('avatars','avatars',true), ('thumbnails','thumbnails',true)
on conflict (id) do nothing;

create policy storage_public_read on storage.objects for select
  using (bucket_id in ('avatars','thumbnails'));

create policy storage_own_write on storage.objects for insert to authenticated
  with check (bucket_id in ('avatars','thumbnails')
              and (storage.foldername(name))[1] = auth.uid()::text);

create policy storage_own_update on storage.objects for update to authenticated
  using (bucket_id in ('avatars','thumbnails')
         and (storage.foldername(name))[1] = auth.uid()::text);

-- =====================================================================
-- Realtime — broadcast live changes to subscribed clients
-- =====================================================================
alter publication supabase_realtime add table
  votes, debate_participants, questions, debate_results, gifts, debates;
