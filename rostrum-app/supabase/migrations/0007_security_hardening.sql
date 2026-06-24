-- =====================================================================
-- The Rostrum · 0007_security_hardening.sql
-- Applied after the security advisor flagged two real issues on first import:
--   1. three trigger functions had a mutable search_path
--   2. Postgres' default grants left every RPC callable by the anon role
-- This pins the search_path and strips the implicit PUBLIC/anon EXECUTE so
-- only signed-in users can call the RPCs. The explicit grants to
-- `authenticated` from 0002 remain in force. `get_vote_tally` stays callable
-- by anon on purpose (it returns only public vote counts).
-- =====================================================================

alter function public.set_updated_at()       set search_path = public;
alter function public.on_follow_change()      set search_path = public;
alter function public.on_team_member_change() set search_path = public;

-- trigger-only functions: not part of the REST API
revoke execute on function public.set_updated_at()        from public, anon, authenticated;
revoke execute on function public.on_follow_change()       from public, anon, authenticated;
revoke execute on function public.on_team_member_change()  from public, anon, authenticated;
revoke execute on function public.handle_new_user()        from public, anon, authenticated;
revoke execute on function public.on_team_created()        from public, anon, authenticated;

-- RPCs: signed-in users only
revoke execute on function public.join_debate(uuid, debate_role, debate_side) from public, anon;
revoke execute on function public.cast_vote(uuid, debate_side)               from public, anon;
revoke execute on function public.submit_ballot(uuid, jsonb)                 from public, anon;
revoke execute on function public.finalize_debate(uuid)                      from public, anon;
revoke execute on function public.redeem_perk(text)                          from public, anon;
revoke execute on function public.is_team_admin(uuid, uuid)                  from public, anon;
revoke execute on function public.set_slide(uuid, int)                       from public, anon;
revoke execute on function public.set_segment(uuid, int)                     from public, anon;
revoke execute on function public.pause_timer(uuid)                          from public, anon;
revoke execute on function public.resume_timer(uuid)                         from public, anon;
revoke execute on function public.set_broadcast_key(uuid, text)              from public, anon;
