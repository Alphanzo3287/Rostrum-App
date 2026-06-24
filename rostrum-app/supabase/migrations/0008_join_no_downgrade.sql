-- =====================================================================
-- The Rostrum · 0008_join_no_downgrade.sql
-- Re-joining as audience must never overwrite an existing on-stage seat.
-- The chamber auto-joins everyone as audience on mount; an invited debater
-- or judge has already taken their seat, so that call must be non-destructive.
-- =====================================================================
create or replace function join_debate(
  p_debate uuid, p_role debate_role default 'audience', p_side debate_side default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_host uuid; v_role debate_role; v_pub boolean;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select host_id into v_host from debates where id = p_debate;
  if v_host is null then raise exception 'debate not found'; end if;

  v_role := case
    when auth.uid() = v_host then 'host'
    when p_role in ('moderator','debater','judge') then p_role
    else 'audience' end;
  v_pub := v_role in ('host','moderator','debater','judge');

  insert into debate_participants (debate_id, user_id, role, side, can_publish)
  values (p_debate, auth.uid(), v_role, p_side, v_pub)
  on conflict (debate_id, user_id) do update set
    role        = case when excluded.role = 'audience' then debate_participants.role        else excluded.role end,
    side        = case when excluded.role = 'audience' then debate_participants.side        else excluded.side end,
    can_publish = case when excluded.role = 'audience' then debate_participants.can_publish else excluded.can_publish end;
end; $$;

grant execute on function join_debate(uuid, debate_role, debate_side) to authenticated;
revoke execute on function join_debate(uuid, debate_role, debate_side) from public, anon;
