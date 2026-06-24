-- =====================================================================
-- The Rostrum · 0004_slides.sql
-- Presenter-driven slide deck + a synced position everyone follows.
-- `debates` is already in the realtime publication, so updating
-- current_slide broadcasts the change to all viewers.
-- =====================================================================

alter table debates
  add column if not exists deck_urls     text[] not null default '{}',
  add column if not exists current_slide int    not null default 0;

-- Only an on-mic participant (host / moderator / debater = can_publish) may
-- advance the deck. Audience cannot. Index is clamped to the deck length.
create or replace function set_slide(p_debate uuid, p_idx int)
returns void language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not exists (
    select 1 from debate_participants
    where debate_id = p_debate and user_id = auth.uid() and can_publish
  ) then raise exception 'only presenters can drive the deck'; end if;

  select coalesce(array_length(deck_urls, 1), 0) into n from debates where id = p_debate;
  update debates
     set current_slide = greatest(0, least(p_idx, greatest(n - 1, 0)))
   where id = p_debate;
end; $$;

grant execute on function set_slide(uuid, int) to authenticated;
