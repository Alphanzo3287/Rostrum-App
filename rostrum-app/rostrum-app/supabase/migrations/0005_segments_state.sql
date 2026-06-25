-- =====================================================================
-- The Rostrum · 0005_segments_state.sql
-- An authoritative segment clock on the debate, so every client agrees on
-- which segment is live and how much time is left. Synced via realtime
-- (debates is already in the publication). The clock is absolute-time based:
--   running  -> segment_ends_at is set; remaining = ends_at - now()
--   paused   -> segment_paused_secs holds the frozen remaining
-- =====================================================================

alter table debates
  add column if not exists current_segment    int,
  add column if not exists segment_ends_at     timestamptz,
  add column if not exists segment_paused_secs int;

-- host: make a segment live and start its clock
create or replace function set_segment(p_debate uuid, p_idx int)
returns void language plpgsql security definer set search_path = public as $$
declare v_host uuid; v_dur int;
begin
  select host_id into v_host from debates where id = p_debate;
  if v_host is null then raise exception 'debate not found'; end if;
  if auth.uid() <> v_host then raise exception 'host only'; end if;

  select duration_secs into v_dur from debate_segments where debate_id = p_debate and idx = p_idx;
  update debates
     set current_segment     = p_idx,
         segment_ends_at      = now() + make_interval(secs => coalesce(v_dur, 0)),
         segment_paused_secs  = null
   where id = p_debate;
end; $$;

-- host: freeze the clock
create or replace function pause_timer(p_debate uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_host uuid; v_rem int;
begin
  select host_id into v_host from debates where id = p_debate;
  if auth.uid() <> v_host then raise exception 'host only'; end if;
  select greatest(0, floor(extract(epoch from (segment_ends_at - now()))))::int
    into v_rem from debates where id = p_debate;
  update debates set segment_paused_secs = coalesce(v_rem, 0), segment_ends_at = null
   where id = p_debate;
end; $$;

-- host: resume from the frozen remaining
create or replace function resume_timer(p_debate uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_host uuid; v_rem int;
begin
  select host_id into v_host from debates where id = p_debate;
  if auth.uid() <> v_host then raise exception 'host only'; end if;
  select coalesce(segment_paused_secs, 0) into v_rem from debates where id = p_debate;
  update debates set segment_ends_at = now() + make_interval(secs => v_rem), segment_paused_secs = null
   where id = p_debate;
end; $$;

grant execute on function set_segment(uuid, int) to authenticated;
grant execute on function pause_timer(uuid)      to authenticated;
grant execute on function resume_timer(uuid)     to authenticated;
