-- =====================================================================
-- The Rostrum · 0002_functions.sql
-- Triggers, counters, and the server-side RPCs that enforce house rules.
-- =====================================================================

-- ---------- generic updated_at ----------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger trg_profiles_updated before update on profiles
  for each row execute function set_updated_at();
create trigger trg_debates_updated before update on debates
  for each row execute function set_updated_at();

-- ---------- create a profile when an auth user is created ----------
-- Reads metadata passed from supabase.auth.signUp({ options: { data: {...} } }).
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare base citext; v_handle citext; n int := 0;
begin
  base := lower(coalesce(nullif(new.raw_user_meta_data->>'handle',''),
                         split_part(new.email,'@',1)));
  base := regexp_replace(base, '[^a-z0-9_]', '', 'g');
  if base = '' then base := 'user'; end if;
  v_handle := base;
  while exists (select 1 from profiles where handle = v_handle) loop
    n := n + 1; v_handle := base || n::text;
  end loop;

  insert into profiles (id, handle, display_name, avatar_url, bio, socials, topics)
  values (
    new.id,
    v_handle,
    coalesce(nullif(new.raw_user_meta_data->>'display_name',''), base),
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'bio',
    coalesce(new.raw_user_meta_data->'socials', '{}'::jsonb),
    coalesce(
      (select array_agg(value) from jsonb_array_elements_text(new.raw_user_meta_data->'topics')),
      '{}')
  );
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- follow counters ----------
create or replace function on_follow_change() returns trigger
language plpgsql as $$
begin
  if (tg_op = 'INSERT') then
    update profiles set follower_count  = follower_count  + 1 where id = new.following_id;
    update profiles set following_count = following_count + 1 where id = new.follower_id;
  elsif (tg_op = 'DELETE') then
    update profiles set follower_count  = greatest(follower_count  - 1, 0) where id = old.following_id;
    update profiles set following_count = greatest(following_count - 1, 0) where id = old.follower_id;
  end if;
  return null;
end; $$;
create trigger trg_follow_count after insert or delete on follows
  for each row execute function on_follow_change();

-- ---------- team membership counters + auto-owner ----------
create or replace function on_team_member_change() returns trigger
language plpgsql as $$
begin
  if (tg_op = 'INSERT') then
    update teams set member_count = member_count + 1 where id = new.team_id;
  elsif (tg_op = 'DELETE') then
    update teams set member_count = greatest(member_count - 1, 0) where id = old.team_id;
  end if;
  return null;
end; $$;
create trigger trg_team_member_count after insert or delete on team_members
  for each row execute function on_team_member_change();

create or replace function on_team_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into team_members (team_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict do nothing;
  return null;
end; $$;
create trigger trg_team_created after insert on teams
  for each row execute function on_team_created();

-- ---------- team-admin check (security definer → no RLS recursion) ----------
create or replace function is_team_admin(p_team uuid, p_user uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from team_members
    where team_id = p_team and user_id = p_user and role in ('owner','admin'));
$$;

-- =====================================================================
-- RPCs the client calls (all SECURITY DEFINER, all check auth.uid())
-- =====================================================================

-- join a room; audience can never publish
create or replace function join_debate(
  p_debate uuid, p_role debate_role default 'audience', p_side debate_side default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_host uuid; v_role debate_role; v_pub boolean;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select host_id into v_host from debates where id = p_debate;
  if v_host is null then raise exception 'debate not found'; end if;

  -- host is always host; non-audience seats should be invite-gated in production.
  v_role := case
    when auth.uid() = v_host then 'host'
    when p_role in ('moderator','debater','judge') then p_role
    else 'audience' end;
  v_pub := v_role in ('host','moderator','debater','judge');

  insert into debate_participants (debate_id, user_id, role, side, can_publish)
  values (p_debate, auth.uid(), v_role, p_side, v_pub)
  on conflict (debate_id, user_id)
    do update set role = excluded.role, side = excluded.side, can_publish = excluded.can_publish;
end; $$;

-- cast a vote (idempotent) and return the live tally
create or replace function cast_vote(p_debate uuid, p_side debate_side)
returns table (prop int, opp int)
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not exists (select 1 from debates where id = p_debate and voters_enabled) then
    raise exception 'voting is closed for this debate';
  end if;

  insert into votes (debate_id, voter_id, side)
  values (p_debate, auth.uid(), p_side)
  on conflict (debate_id, voter_id) do nothing;   -- one vote per person

  return query
    select count(*) filter (where side = 'prop')::int,
           count(*) filter (where side = 'opp')::int
    from votes where debate_id = p_debate;
end; $$;

-- public live tally without exposing who voted what
create or replace function get_vote_tally(p_debate uuid)
returns table (prop int, opp int)
language sql security definer stable set search_path = public as $$
  select count(*) filter (where side = 'prop')::int,
         count(*) filter (where side = 'opp')::int
  from votes where debate_id = p_debate;
$$;

-- judges only: submit / update a ballot
create or replace function submit_ballot(p_debate uuid, p_scores jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare pt int; ot int;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not exists (
    select 1 from debate_participants
    where debate_id = p_debate and user_id = auth.uid() and role = 'judge'
  ) then raise exception 'only judges may submit a ballot'; end if;

  pt := coalesce((select sum(value::int) from jsonb_each_text(p_scores->'prop')), 0);
  ot := coalesce((select sum(value::int) from jsonb_each_text(p_scores->'opp')), 0);

  insert into ballots (debate_id, judge_id, scores, prop_total, opp_total)
  values (p_debate, auth.uid(), p_scores, pt, ot)
  on conflict (debate_id, judge_id) do update
    set scores = excluded.scores, prop_total = excluded.prop_total,
        opp_total = excluded.opp_total, submitted_at = now();
end; $$;

-- host only: tally judges + audience, decide winner, award W/L + points
create or replace function finalize_debate(p_debate uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_host uuid; pj int; oj int; pa int; oa int; v_winner debate_side;
begin
  select host_id into v_host from debates where id = p_debate;
  if v_host is null then raise exception 'debate not found'; end if;
  if auth.uid() <> v_host then raise exception 'only the host may finalize'; end if;

  select coalesce(sum(prop_total),0), coalesce(sum(opp_total),0) into pj, oj
    from ballots where debate_id = p_debate;
  select count(*) filter (where side='prop'), count(*) filter (where side='opp') into pa, oa
    from votes where debate_id = p_debate;

  v_winner := case
    when (pj + pa) > (oj + oa) then 'prop'
    when (oj + oa) > (pj + pa) then 'opp'
    else null end;

  insert into debate_results
    (debate_id, winner_side, prop_judge_total, opp_judge_total, prop_audience, opp_audience)
  values (p_debate, v_winner, pj, oj, pa, oa)
  on conflict (debate_id) do update set
    winner_side = excluded.winner_side,
    prop_judge_total = excluded.prop_judge_total, opp_judge_total = excluded.opp_judge_total,
    prop_audience = excluded.prop_audience, opp_audience = excluded.opp_audience,
    decided_at = now();

  update debates set status = 'ended', ended_at = now() where id = p_debate;

  if v_winner is not null then
    -- winners
    update profiles p set wins = wins + 1, points = points + 120, virtual_cash = virtual_cash + 50
      from debate_participants dp
      where dp.debate_id = p_debate and dp.user_id = p.id
        and dp.role = 'debater' and dp.side = v_winner;
    -- losers (still earn participation points)
    update profiles p set losses = losses + 1, points = points + 40
      from debate_participants dp
      where dp.debate_id = p_debate and dp.user_id = p.id
        and dp.role = 'debater' and dp.side is distinct from v_winner;
  end if;
end; $$;

-- spend virtual cash on a perk
create or replace function redeem_perk(p_perk text)
returns void language plpgsql security definer set search_path = public as $$
declare v_cost int; v_cash int;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select cost into v_cost from perks where id = p_perk;
  if v_cost is null then raise exception 'unknown perk'; end if;
  select virtual_cash into v_cash from profiles where id = auth.uid();
  if v_cash < v_cost then raise exception 'not enough virtual cash'; end if;

  update profiles set virtual_cash = virtual_cash - v_cost where id = auth.uid();
  insert into user_perks (user_id, perk_id) values (auth.uid(), p_perk)
    on conflict do nothing;
  insert into transactions (user_id, type, cash_delta) values (auth.uid(), 'perk', -v_cost);
end; $$;

-- ---------- execute grants ----------
grant execute on function join_debate(uuid, debate_role, debate_side) to authenticated;
grant execute on function cast_vote(uuid, debate_side)               to authenticated;
grant execute on function get_vote_tally(uuid)                       to anon, authenticated;
grant execute on function submit_ballot(uuid, jsonb)                 to authenticated;
grant execute on function finalize_debate(uuid)                      to authenticated;
grant execute on function redeem_perk(text)                          to authenticated;
grant execute on function is_team_admin(uuid, uuid)                  to authenticated;
