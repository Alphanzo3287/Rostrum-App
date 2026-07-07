// =====================================================================
// The Rostrum · api.ts
// The data layer the prototype screens call. Every function maps to a
// screen action from the frontend. Reads go straight to tables (RLS keeps
// them honest); house-rule writes go through SECURITY DEFINER RPCs.
// =====================================================================
import { supabase } from './supabaseClient';
import type {
  Debate, Segment, Participant, Tally, DebateResult, Question,
  Profile, Team, TeamMember, Perk, Achievement, DebateFormat, Visibility, Side, DebateRole, TeamRole,
} from './types';

// Every realtime subscription gets a UNIQUE channel name. Supabase reuses a
// channel by name and throws "cannot add postgres_changes callbacks after
// subscribe()" if a second component attaches a listener to an
// already-subscribed channel. A unique suffix guarantees each caller owns its
// own channel, so multiple components can subscribe to the same data safely.
let _chSeq = 0;
const uniq = () => `${Date.now().toString(36)}-${(_chSeq++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// Wrap a realtime subscription so a setup/channel error can never throw into a
// React effect (which would trip an error boundary and blank a panel).
function safeSub(setup: () => any): () => void {
  try {
    const ch = setup();
    return () => { try { supabase.removeChannel(ch); } catch { /* noop */ } };
  } catch (e) {
    console.error('realtime subscribe failed (non-fatal):', e);
    return () => {};
  }
}

/* --------------------- EMERGENCY ROOM CONTROL -------------------- */
export interface OpenRoom { id: string; motion: string; status: string; created_at: string; }
// The host's rooms that are still open (any non-ended status).
export async function myOpenRooms(): Promise<OpenRoom[]> {
  const { data, error } = await supabase.rpc('my_open_rooms');
  if (error) throw error;
  return (data ?? []) as OpenRoom[];
}
// Force a room to end regardless of its state (recovers a crashed live room).
export async function forceCloseRoom(debateId: string): Promise<void> {
  const { error } = await supabase.rpc('force_close_room', { p_debate: debateId });
  if (error) throw error;
}

/* ----------------------------- LOBBY ----------------------------- */

export async function listLiveDebates(): Promise<Debate[]> {
  const { data, error } = await supabase
    .from('debates')
    .select('*, host:profiles!debates_host_id_fkey(display_name,handle,avatar_url)')
    .in('status', ['assembly', 'live'])
    .eq('visibility', 'public')
    .order('viewer_count', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Debate[];
}

export async function listUpcomingDebates(): Promise<Debate[]> {
  const { data, error } = await supabase
    .from('debates')
    .select('*, host:profiles!debates_host_id_fkey(display_name,handle,avatar_url)')
    .eq('status', 'scheduled')
    .eq('visibility', 'public')
    .order('scheduled_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Debate[];
}

export async function getDebate(id: string): Promise<{ debate: Debate; segments: Segment[] }> {
  const [{ data: debate, error: e1 }, { data: segments, error: e2 }] = await Promise.all([
    supabase.from('debates')
      .select('*, host:profiles!debates_host_id_fkey(display_name,handle,avatar_url)')
      .eq('id', id).single(),
    supabase.from('debate_segments').select('*').eq('debate_id', id).order('idx'),
  ]);
  if (e1) throw e1; if (e2) throw e2;
  return { debate: debate as Debate, segments: (segments ?? []) as Segment[] };
}

/* --------------------------- HOST A DEBATE ----------------------- */

export interface CreateDebateInput {
  motion: string;
  format: DebateFormat;
  visibility: Visibility;
  tag?: string;
  isPaid: boolean;
  priceCents: number;
  giftsEnabled: boolean;
  recordingEnabled: boolean;
  votersEnabled: boolean;
  winMode: WinMode;
  scheduledAt?: string | null;
  segments: { label: string; side: Side | null; durationSecs: number }[];
  thumbnailFile?: File | null;
  maxStageSeats?: number | null;
  maxModerators?: number | null;
  communityId?: string | null;
}

export async function createDebate(input: CreateDebateInput): Promise<Debate> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('not authenticated');

  // 1) insert the debate (assembly = doors open)
  const { data: debate, error } = await supabase.from('debates').insert({
    host_id: user.id,
    motion: input.motion,
    format: input.format,
    visibility: input.visibility,
    tag: input.tag ?? null,
    is_paid: input.isPaid,
    price_cents: input.priceCents,
    gifts_enabled: input.giftsEnabled,
    recording_enabled: input.recordingEnabled,
    voters_enabled: input.votersEnabled,
    win_mode: input.winMode ?? 'public',
    scheduled_at: input.scheduledAt ?? null,
    status: input.scheduledAt ? 'scheduled' : 'assembly',
    max_stage_seats: input.maxStageSeats ?? null,
    max_moderators: input.maxModerators ?? null,
    community_id: input.communityId ?? null,
  }).select().single();
  if (error) throw error;
  const d = debate as Debate;

  // 2) upload the cover thumbnail (foldered by uid for the storage policy)
  if (input.thumbnailFile) {
    const ext = input.thumbnailFile.name.split('.').pop() ?? 'png';
    const path = `${user.id}/${d.id}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('thumbnails').upload(path, input.thumbnailFile, { upsert: true });
    if (upErr) throw upErr;
    const url = supabase.storage.from('thumbnails').getPublicUrl(path).data.publicUrl;
    await supabase.from('debates').update({ thumbnail_url: url, livekit_room: `debate_${d.id}` }).eq('id', d.id);
    d.thumbnail_url = url;
  } else {
    await supabase.from('debates').update({ livekit_room: `debate_${d.id}` }).eq('id', d.id);
  }

  // 3) run of show
  if (input.segments.length) {
    const rows = input.segments.map((s, i) => ({
      debate_id: d.id, idx: i, label: s.label, side: s.side, duration_secs: s.durationSecs,
    }));
    const { error: segErr } = await supabase.from('debate_segments').insert(rows);
    if (segErr) throw segErr;
  }

  // 4) seat the host (host can always publish)
  await supabase.rpc('join_debate', { p_debate: d.id, p_role: 'host', p_side: null });
  return d;
}

export async function setDebateStatus(id: string, status: 'assembly' | 'live' | 'ended') {
  const patch: Record<string, unknown> = { status };
  if (status === 'live') patch.started_at = new Date().toISOString();
  const { error } = await supabase.from('debates').update(patch).eq('id', id);
  if (error) throw error;
}

// Host opens the doors on a scheduled debate (scheduled → assembly).
export async function startDebate(id: string) {
  const { error } = await supabase.rpc('start_debate', { p_debate: id });
  if (error) throw error;
}
export async function cancelDebate(id: string) {
  const { error } = await supabase.rpc('cancel_debate', { p_debate: id });
  if (error) throw error;
}

/* ------------------------------- RSVP ---------------------------- */
export interface RsvpInfo { going: number; interested: number; mine: 'going' | 'interested' | null; }
export async function getRsvp(debateId: string): Promise<RsvpInfo> {
  const { data } = await supabase.rpc('get_rsvp', { p_debate: debateId });
  const row = (Array.isArray(data) ? data[0] : data) as any;
  return { going: row?.going ?? 0, interested: row?.interested ?? 0, mine: row?.mine ?? null };
}
export async function setRsvp(debateId: string, status: 'going' | 'interested') {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('not authenticated');
  const { error } = await supabase.from('debate_rsvps')
    .upsert({ debate_id: debateId, user_id: user.id, status }, { onConflict: 'debate_id,user_id' });
  if (error) throw error;
}
export async function clearRsvp(debateId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('debate_rsvps').delete().eq('debate_id', debateId).eq('user_id', user.id);
}

// Host stores the YouTube stream key (host-only table; read server-side at go-live).
export async function setBroadcastKey(debateId: string, youtubeStreamKey: string) {
  const { error } = await supabase.rpc('set_broadcast_key', { p_debate: debateId, p_key: youtubeStreamKey });
  if (error) throw error;
}

/* ----------------------- ROOM PARTICIPATION ---------------------- */

export async function joinDebate(debateId: string, role: DebateRole = 'audience', side: Side | null = null) {
  const { error } = await supabase.rpc('join_debate', { p_debate: debateId, p_role: role, p_side: side });
  if (error) throw error;
}

export async function listParticipants(debateId: string): Promise<(Participant & { profile: Profile })[]> {
  const { data, error } = await supabase
    .from('debate_participants')
    .select('*, profile:profiles(*)')
    .eq('debate_id', debateId);
  if (error) throw error;
  return (data ?? []) as (Participant & { profile: Profile })[];
}

/* ----------------------------- VOTING ---------------------------- */

// Audience "Vote Proposition / Opposition" buttons → one vote per person.
export async function castVote(debateId: string, side: Side): Promise<Tally> {
  const { data, error } = await supabase.rpc('cast_vote', { p_debate: debateId, p_side: side });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { prop: row?.prop ?? 0, opp: row?.opp ?? 0 };
}

export async function getTally(debateId: string): Promise<Tally> {
  const { data, error } = await supabase.rpc('get_vote_tally', { p_debate: debateId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { prop: row?.prop ?? 0, opp: row?.opp ?? 0 };
}

/* ----------------------- JUDGING + RESULTS ----------------------- */

export async function submitBallot(debateId: string, scores: { prop: Record<string, number>; opp: Record<string, number> }) {
  const { error } = await supabase.rpc('submit_ballot', { p_debate: debateId, p_scores: scores });
  if (error) throw error;
}

export async function finalizeDebate(debateId: string) {
  const { error } = await supabase.rpc('finalize_debate', { p_debate: debateId });
  if (error) throw error;
}

export async function getResults(debateId: string): Promise<DebateResult | null> {
  const { data } = await supabase.from('debate_results').select('*').eq('debate_id', debateId).maybeSingle();
  return (data as DebateResult) ?? null;
}

/* ----------------------- WINNER SYSTEM ----------------------- */
export type WinMode = 'academic' | 'public' | 'hybrid';

export async function openPoll(debateId: string) {
  const { error } = await supabase.rpc('open_poll', { p_debate: debateId });
  if (error) throw error;
}
export async function closePoll(debateId: string) {
  const { error } = await supabase.rpc('close_poll', { p_debate: debateId });
  if (error) throw error;
}
export async function announceWinner(debateId: string) {
  const { error } = await supabase.rpc('announce_winner', { p_debate: debateId });
  if (error) throw error;
}

/* ------------------------------ Q&A ------------------------------ */

export async function askQuestion(debateId: string, body: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('not authenticated');
  const { error } = await supabase.from('questions').insert({ debate_id: debateId, asker_id: user.id, body });
  if (error) throw error;
}
export async function setQuestionStatus(id: string, status: Question['status']) {
  const { error } = await supabase.from('questions').update({ status }).eq('id', id);
  if (error) throw error;
}

/* ----------------------------- GIFTS ----------------------------- */

export async function sendGift(debateId: string, toId: string, kind: string, amountCents: number) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('not authenticated');
  const { error } = await supabase.from('gifts')
    .insert({ debate_id: debateId, from_id: user.id, to_id: toId, kind, amount_cents: amountCents });
  if (error) throw error; // real-money capture happens via Stripe webhook before insert in prod
}

/* --------------------------- PROFILES ---------------------------- */

export async function getProfile(handle: string): Promise<Profile | null> {
  const { data } = await supabase.from('profiles').select('*').eq('handle', handle).maybeSingle();
  return (data as Profile) ?? null;
}
export async function topProfiles(limit = 25): Promise<Profile[]> {
  const { data, error } = await supabase.from('profiles').select('*')
    .order('points', { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []) as Profile[];
}

/* ---------------------------- SOCIAL ----------------------------- */

export async function follow(targetId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('not authenticated');
  const { error } = await supabase.from('follows').insert({ follower_id: user.id, following_id: targetId });
  if (error) throw error;
}
export async function unfollow(targetId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('not authenticated');
  const { error } = await supabase.from('follows').delete()
    .eq('follower_id', user.id).eq('following_id', targetId);
  if (error) throw error;
}

/* ---- Blocking (reversible). Blocked pairs can't see/engage each other; a
   host-block also hides that host's events from the blocked user. ---- */
export async function amIBlocking(targetId: string): Promise<boolean> {
  const { data } = await supabase.rpc('am_i_blocking', { p_user: targetId });
  return !!data;
}
export async function blockUser(targetId: string) {
  const { error } = await supabase.rpc('block_user', { p_user: targetId });
  if (error) throw error;
}
export async function unblockUser(targetId: string) {
  const { error } = await supabase.rpc('unblock_user', { p_user: targetId });
  if (error) throw error;
}

/* ---- Host/moderator permanent removal from a chamber (irreversible). ---- */
export async function removeFromChamber(debateId: string, userId: string) {
  const { error } = await supabase.rpc('remove_from_chamber', { p_debate: debateId, p_user: userId });
  if (error) throw error;
}

/* ----------------------------- TEAMS ----------------------------- */

export async function listTeams(): Promise<Team[]> {
  const { data, error } = await supabase.from('teams').select('*').order('wins', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Team[];
}
export async function createTeam(name: string, tag: string, color = '#2E9E86'): Promise<Team> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('not authenticated');
  const { data, error } = await supabase.from('teams')
    .insert({ name, tag, color, owner_id: user.id }).select().single();
  if (error) throw error; // trigger adds the owner as a member
  return data as Team;
}
export async function listTeamMembers(teamId: string): Promise<(TeamMember & { profile: Profile })[]> {
  const { data, error } = await supabase.from('team_members')
    .select('*, profile:profiles(*)').eq('team_id', teamId);
  if (error) throw error;
  return (data ?? []) as (TeamMember & { profile: Profile })[];
}
export async function addTeamMember(teamId: string, userId: string, role: TeamRole = 'member') {
  const { error } = await supabase.from('team_members').insert({ team_id: teamId, user_id: userId, role });
  if (error) throw error;
}
export async function setTeamRole(teamId: string, userId: string, role: TeamRole) {
  const { error } = await supabase.from('team_members').update({ role }).eq('team_id', teamId).eq('user_id', userId);
  if (error) throw error;
}
export async function removeTeamMember(teamId: string, userId: string) {
  const { error } = await supabase.from('team_members').delete().eq('team_id', teamId).eq('user_id', userId);
  if (error) throw error;
}

/* ----------------------------- STORE ----------------------------- */

export async function listPerks(): Promise<Perk[]> {
  const { data, error } = await supabase.from('perks').select('*').order('cost');
  if (error) throw error;
  return (data ?? []) as Perk[];
}
export async function redeemPerk(perkId: string) {
  const { error } = await supabase.rpc('redeem_perk', { p_perk: perkId });
  if (error) throw error;
}

/* -------------------- PROFILE / STORE EXTRAS --------------------- */

export async function getProfileById(id: string): Promise<Profile | null> {
  const { data } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
  return (data as Profile) ?? null;
}

export async function getAchievements(userId: string): Promise<(Achievement & { earned_at: string })[]> {
  const { data } = await supabase.from('user_achievements')
    .select('earned_at, achievement:achievements(*)').eq('user_id', userId);
  return (data ?? []).map((r: any) => ({ ...r.achievement, earned_at: r.earned_at }));
}

export async function myPerkIds(): Promise<string[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase.from('user_perks').select('perk_id').eq('user_id', user.id);
  return (data ?? []).map((r: any) => r.perk_id);
}

export async function amFollowing(targetId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.from('follows').select('follower_id')
    .eq('follower_id', user.id).eq('following_id', targetId).maybeSingle();
  return !!data;
}

/* ----------------------------- SLIDES ---------------------------- */
// Deck pages are images (PPTX / PDF / Google Slides rasterized to PNG by your
// conversion step). They live in the public `thumbnails` bucket under the
// presenter's uid folder so the storage policy allows the write.

export async function uploadDeck(debateId: string, pages: File[]): Promise<string[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('not authenticated');
  const urls: string[] = [];
  for (let i = 0; i < pages.length; i++) {
    const ext = pages[i].name.split('.').pop() ?? 'png';
    const path = `${user.id}/deck/${debateId}/${String(i).padStart(3, '0')}.${ext}`;
    const { error } = await supabase.storage.from('thumbnails').upload(path, pages[i], { upsert: true });
    if (error) throw error;
    urls.push(supabase.storage.from('thumbnails').getPublicUrl(path).data.publicUrl);
  }
  const { error: e2 } = await supabase.rpc('set_deck', { p_debate: debateId, p_urls: urls });
  if (e2) throw e2;
  return urls;
}

export async function getDeck(debateId: string): Promise<{ urls: string[]; current: number }> {
  const { data } = await supabase.from('debates')
    .select('deck_urls, current_slide').eq('id', debateId).single();
  return { urls: ((data as any)?.deck_urls ?? []) as string[], current: ((data as any)?.current_slide ?? 0) as number };
}

// Presenter advances the deck for the whole room (server enforces can_publish).
export async function setSlide(debateId: string, idx: number) {
  const { error } = await supabase.rpc('set_slide', { p_debate: debateId, p_idx: idx });
  if (error) throw error;
}

// Remove the whole deck (host or presenter).
export async function clearDeck(debateId: string) {
  const { error } = await supabase.rpc('clear_deck', { p_debate: debateId });
  if (error) throw error;
}

/* ----------------------- BROADCAST CONTROL ----------------------- */
export type BcastLayout = 'solo' | 'group' | 'spotlight' | 'news' | 'screen' | 'pip' | 'cinema'
  | 'camera' | 'slides' | 'sidebyside';   // legacy values kept for back-compat
export interface BroadcastState {
  layout: BcastLayout;
  stageId: string | null;
  slidesOn: boolean;
  presenterId: string | null;
  presentType: 'slides' | 'screen' | null;
  presentRequest: string | null;
}
export async function getBroadcastState(debateId: string): Promise<BroadcastState> {
  const { data } = await supabase.from('debates')
    .select('bcast_layout, bcast_stage_id, bcast_slides_on, bcast_presenter_id, bcast_present_type, bcast_present_request')
    .eq('id', debateId).single();
  const d = data as any;
  return {
    layout: (d?.bcast_layout ?? 'solo') as BcastLayout,
    stageId: d?.bcast_stage_id ?? null,
    slidesOn: !!d?.bcast_slides_on,
    presenterId: d?.bcast_presenter_id ?? null,
    presentType: (d?.bcast_present_type ?? null) as 'slides' | 'screen' | null,
    presentRequest: d?.bcast_present_request ?? null,
  };
}
// Host-only. Pass only the fields you want to change.
export async function setBroadcastState(debateId: string, s: Partial<{ layout: BcastLayout; stageId: string | null; slidesOn: boolean }>) {
  const { error } = await supabase.rpc('set_broadcast_state', {
    p_debate: debateId,
    p_layout: s.layout ?? null,
    p_stage_id: s.stageId === null ? '__clear__' : (s.stageId ?? null),
    p_slides_on: s.slidesOn ?? null,
  });
  if (error) throw error;
}
// Host grants/removes the active presenter (null clears the slot).
export async function setPresenter(debateId: string, identity: string | null, type: 'slides' | 'screen' = 'slides') {
  const { error } = await supabase.rpc('set_presenter', { p_debate: debateId, p_identity: identity, p_type: type });
  if (error) throw error;
}
// A debater asks the host for permission to present.
export async function requestPresent(debateId: string, identity: string) {
  const { error } = await supabase.rpc('request_present', { p_debate: debateId, p_identity: identity });
  if (error) throw error;
}
// Broadcast page subscribes to the debate row for live layout/presenter changes.
// Wrapped so a realtime/channel error can NEVER throw into React render/effect
// (which would trip an error boundary and blank the studio controls).
export function subscribeBroadcastState(debateId: string, onChange: (s: BroadcastState) => void) {
  try {
    const ch = supabase.channel(`bcast:${debateId}:${uniq()}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'debates', filter: `id=eq.${debateId}` },
        (payload: any) => {
          const n = payload.new;
          if (!n) return;
          onChange({
            layout: (n.bcast_layout ?? 'solo') as BcastLayout,
            stageId: n.bcast_stage_id ?? null,
            slidesOn: !!n.bcast_slides_on,
            presenterId: n.bcast_presenter_id ?? null,
            presentType: (n.bcast_present_type ?? null) as 'slides' | 'screen' | null,
            presentRequest: n.bcast_present_request ?? null,
          });
        })
      .subscribe();
    return () => { try { supabase.removeChannel(ch); } catch { /* noop */ } };
  } catch (e) {
    console.error('subscribeBroadcastState failed (non-fatal):', e);
    return () => {};
  }
}

// Everyone follows the presenter's position in real time.
export function subscribeSlide(debateId: string, onChange: (current: number) => void) {
  return safeSub(() => supabase.channel(`slide:${debateId}:${uniq()}`)
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'debates', filter: `id=eq.${debateId}` },
      (payload: any) => { if (payload.new?.current_slide != null) onChange(payload.new.current_slide); })
    .subscribe());
}

/* -------------------------- SEGMENT CLOCK ------------------------ */
// Host-only. Clients read the resulting fields and compute remaining locally.

export async function setSegment(debateId: string, idx: number) {
  const { error } = await supabase.rpc('set_segment', { p_debate: debateId, p_idx: idx });
  if (error) throw error;
}
export async function pauseTimer(debateId: string) {
  const { error } = await supabase.rpc('pause_timer', { p_debate: debateId });
  if (error) throw error;
}
export async function resumeTimer(debateId: string) {
  const { error } = await supabase.rpc('resume_timer', { p_debate: debateId });
  if (error) throw error;
}
// Host edits the clock — set the remaining seconds (works running or paused).
export async function setRemaining(debateId: string, secs: number) {
  const { error } = await supabase.rpc('set_remaining', { p_debate: debateId, p_secs: Math.max(0, Math.round(secs)) });
  if (error) throw error;
}

// One subscription for everything that changes on the debate row:
// status (assembly→live→ended), current_segment, the clock, and the slide.
export function subscribeDebate(debateId: string, onChange: (d: Partial<Debate>) => void) {
  return safeSub(() => supabase.channel(`debate:${debateId}:${uniq()}`)
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'debates', filter: `id=eq.${debateId}` },
      (payload: any) => onChange(payload.new as Partial<Debate>))
    .subscribe());
}

/* --------------------------- REALTIME ---------------------------- */
// Live poll bars, the "who's in the room" gallery, and the Q&A queue.

export function subscribeTally(debateId: string, onChange: (t: Tally) => void) {
  return safeSub(() => supabase.channel(`votes:${debateId}:${uniq()}`)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'votes', filter: `debate_id=eq.${debateId}` },
      async () => onChange(await getTally(debateId)))
    .subscribe());
}

/* Fires whenever any debate row changes (status flips to live/ended, viewer
   count updates, etc.) so the lobby can refresh instantly instead of waiting
   for the poll. */
export function subscribeDebatesList(onChange: () => void) {
  return safeSub(() => supabase.channel(`debates-list:${uniq()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'debates' }, () => onChange())
    .subscribe());
}

export function subscribeParticipants(debateId: string, onChange: () => void) {
  return safeSub(() => supabase.channel(`participants:${debateId}:${uniq()}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'debate_participants', filter: `debate_id=eq.${debateId}` },
      () => onChange())
    .subscribe());
}

/* Fires on the removed user's own client the moment a host/moderator removes
   them from this chamber, so they can be dropped instantly. Realtime respects
   RLS, so a user only ever receives their own removal row. */
export function subscribeMyRemoval(debateId: string, myId: string, onRemoved: () => void) {
  return safeSub(() => supabase.channel(`removals:${debateId}:${uniq()}`)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chamber_removals', filter: `debate_id=eq.${debateId}` },
      (payload: any) => { if (payload?.new?.user_id === myId) onRemoved(); })
    .subscribe());
}

export function subscribeQuestions(debateId: string, onChange: () => void) {
  return safeSub(() => supabase.channel(`questions:${debateId}:${uniq()}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'questions', filter: `debate_id=eq.${debateId}` },
      () => onChange())
    .subscribe());
}

/* ------------------------------- LIVE CHAT ----------------------------- */
export interface ChatMsg {
  id: string; debate_id: string; sender_id: string;
  sender_name: string; sender_avatar: string | null; body: string; created_at: string;
}
export async function getChat(debateId: string): Promise<ChatMsg[]> {
  const { data } = await supabase.from('chat_messages').select('*')
    .eq('debate_id', debateId).order('created_at', { ascending: true }).limit(300);
  return (data ?? []) as ChatMsg[];
}
export async function sendChat(debateId: string, body: string) {
  const { error } = await supabase.rpc('send_chat', { p_debate: debateId, p_body: body });
  if (error) throw error;
}
export function subscribeChat(debateId: string, onInsert: (m: ChatMsg) => void) {
  return safeSub(() => supabase.channel(`chat:${debateId}:${uniq()}`)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `debate_id=eq.${debateId}` },
      (p: any) => onInsert(p.new as ChatMsg))
    .subscribe());
}

/* --------------------------- NOTIFICATIONS --------------------------- */
export interface AppNotification {
  id: string; user_id: string; type: string; title: string;
  body: string | null; link: string | null; read: boolean; created_at: string;
}
export async function listNotifications(): Promise<AppNotification[]> {
  const { data } = await supabase.from('notifications').select('*')
    .order('created_at', { ascending: false }).limit(50);
  return (data ?? []) as AppNotification[];
}
export async function markNotificationsRead(ids?: string[]) {
  let q = supabase.from('notifications').update({ read: true }).eq('read', false);
  if (ids && ids.length) q = q.in('id', ids);
  const { error } = await q;
  if (error) throw error;
}
export function subscribeNotifications(userId: string, onInsert: (n: AppNotification) => void) {
  return safeSub(() => supabase.channel(`notifs:${userId}:${uniq()}`)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (p: any) => onInsert(p.new as AppNotification))
    .subscribe());
}

/* ─────────────────── TRUST & SAFETY ─────────────────── */
export type ReportTargetType = 'user' | 'debate' | 'chat_message' | 'question';
export type ReportReason = 'spam' | 'harassment' | 'hate_speech' | 'misinformation' | 'impersonation' | 'inappropriate_content' | 'other';
export type ReportStatus = 'pending' | 'reviewed' | 'actioned' | 'dismissed';
export type AppealStatus = 'open' | 'approved' | 'denied';
export type TicketCategory = 'account' | 'billing' | 'technical' | 'content' | 'other';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface Report { id: string; reporter_id: string; target_type: ReportTargetType; target_id: string; reason: ReportReason; body: string | null; status: ReportStatus; mod_note: string | null; created_at: string; }
export interface Ban { id: string; user_id: string; admin_id: string; reason: string; expires_at: string | null; lifted_at: string | null; created_at: string; }
export interface Appeal { id: string; ban_id: string; user_id: string; body: string; status: AppealStatus; admin_reply: string | null; created_at: string; }
export interface SupportTicket { id: string; user_id: string; category: TicketCategory; subject: string; body: string; status: TicketStatus; created_at: string; updated_at: string; }
export interface TicketMessage { id: string; ticket_id: string; author_id: string; body: string; is_admin: boolean; created_at: string; }
export interface FaqItem { id: string; category: string; question: string; answer: string; sort: number; }

export async function fileReport(targetType: ReportTargetType, targetId: string, reason: ReportReason, body?: string): Promise<string> {
  const { data, error } = await supabase.rpc('file_report', { p_target_type: targetType, p_target_id: targetId, p_reason: reason, p_body: body ?? null });
  if (error) throw error; return data as string;
}
export async function getMyReports(): Promise<Report[]> {
  const { data, error } = await supabase.from('reports').select('*').order('created_at', { ascending: false });
  if (error) throw error; return (data ?? []) as Report[];
}
export async function getAllReports(status?: ReportStatus): Promise<Report[]> {
  let q = supabase.from('reports').select('*').order('created_at', { ascending: false });
  if (status) q = (q as any).eq('status', status);
  const { data, error } = await q; if (error) throw error; return (data ?? []) as Report[];
}
export async function reviewReport(reportId: string, status: ReportStatus, note?: string, ban?: boolean, banReason?: string, banDays?: number): Promise<void> {
  const { error } = await supabase.rpc('review_report', { p_report: reportId, p_status: status, p_note: note ?? null, p_ban: ban ?? false, p_ban_reason: banReason ?? null, p_ban_days: banDays ?? null });
  if (error) throw error;
}
export async function liftBan(banId: string): Promise<void> {
  const { error } = await supabase.rpc('lift_ban', { p_ban: banId }); if (error) throw error;
}
export async function getAllBans(): Promise<Ban[]> {
  const { data, error } = await supabase.from('bans').select('*').order('created_at', { ascending: false });
  if (error) throw error; return (data ?? []) as Ban[];
}
export async function submitTicket(category: TicketCategory, subject: string, body: string): Promise<string> {
  const { data, error } = await supabase.rpc('submit_ticket', { p_category: category, p_subject: subject, p_body: body });
  if (error) throw error; return data as string;
}
export async function getMyTickets(): Promise<SupportTicket[]> {
  const { data, error } = await supabase.from('support_tickets').select('*').order('updated_at', { ascending: false });
  if (error) throw error; return (data ?? []) as SupportTicket[];
}
export async function getAllTickets(): Promise<SupportTicket[]> {
  const { data, error } = await supabase.from('support_tickets').select('*').order('updated_at', { ascending: false });
  if (error) throw error; return (data ?? []) as SupportTicket[];
}
export async function getTicketMessages(ticketId: string): Promise<TicketMessage[]> {
  const { data, error } = await supabase.from('ticket_messages').select('*').eq('ticket_id', ticketId).order('created_at');
  if (error) throw error; return (data ?? []) as TicketMessage[];
}
export async function replyTicket(ticketId: string, body: string): Promise<void> {
  const { error } = await supabase.rpc('reply_ticket', { p_ticket: ticketId, p_body: body }); if (error) throw error;
}
export async function resolveTicket(ticketId: string): Promise<void> {
  const { error } = await supabase.rpc('resolve_ticket', { p_ticket: ticketId }); if (error) throw error;
}
export async function fileAppeal(banId: string, body: string): Promise<string> {
  const { data, error } = await supabase.rpc('file_appeal', { p_ban: banId, p_body: body });
  if (error) throw error; return data as string;
}
export async function getMyAppeals(): Promise<Appeal[]> {
  const { data, error } = await supabase.from('appeals').select('*').order('created_at', { ascending: false });
  if (error) throw error; return (data ?? []) as Appeal[];
}
export async function getAllAppeals(): Promise<Appeal[]> {
  const { data, error } = await supabase.from('appeals').select('*').order('created_at', { ascending: false });
  if (error) throw error; return (data ?? []) as Appeal[];
}
export async function ruleAppeal(appealId: string, status: AppealStatus, reply?: string): Promise<void> {
  const { error } = await supabase.rpc('rule_appeal', { p_appeal: appealId, p_status: status, p_reply: reply ?? null });
  if (error) throw error;
}
export async function getFaq(): Promise<FaqItem[]> {
  const { data, error } = await supabase.from('faq_items').select('*').eq('published', true).order('sort');
  if (error) throw error; return (data ?? []) as FaqItem[];
}
export async function getMyBan(): Promise<Ban | null> {
  const { data } = await supabase.from('bans').select('*').is('lifted_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
  return (data as Ban) ?? null;
}

/* ─────────────────── PUBLIC HOMEPAGE STATS ─────────────────── */
export interface PlatformStats { active_users: number; live_debates: number; total_debates: number; total_votes: number; countries: number; }
export async function getPlatformStats(): Promise<PlatformStats> {
  const { data, error } = await supabase.rpc('platform_stats');
  if (error) throw error;
  return data as PlatformStats;
}
export interface TopDebater { id: string; display_name: string; handle: string; avatar_url: string | null; wins: number; rank: string; }
export async function getTopDebaters(limit = 5): Promise<TopDebater[]> {
  const { data, error } = await supabase.rpc('top_debaters_public', { p_limit: limit });
  if (error) throw error;
  return (data ?? []) as TopDebater[];
}

/* ─────────────────── BATCH C1/C2 · LIVE DEBATE HALL ───────────────────
   Frontend bindings for the read-RPCs shipped in Batch C1. All are
   SECURITY DEFINER aggregate reads (no individual rows leak), so any
   viewer can load the % bars, floor strip, and evidence feed. */

export interface FloorStats {
  prop_speaking: number;            // verified mic-live seconds, prop side
  opp_speaking: number;             // verified mic-live seconds, opp side
  evidence_count: number;
  next_up: { label: string; side: Side | null } | null;
}
export async function getFloorStats(debateId: string): Promise<FloorStats> {
  const { data, error } = await supabase.rpc('floor_stats', { p_debate: debateId });
  if (error) throw error;
  const d = (data ?? {}) as Partial<FloorStats>;
  return {
    prop_speaking: Number(d.prop_speaking ?? 0),
    opp_speaking: Number(d.opp_speaking ?? 0),
    evidence_count: Number(d.evidence_count ?? 0),
    next_up: d.next_up ?? null,
  };
}

export async function getAudienceTally(debateId: string): Promise<Tally> {
  const { data, error } = await supabase.rpc('audience_tally', { p_debate: debateId });
  if (error) throw error;
  const d = (data ?? {}) as { prop?: number; opp?: number };
  return { prop: Number(d.prop ?? 0), opp: Number(d.opp ?? 0) };
}

export interface ActivePoll {
  id: string; question: string; options: string[];
  is_open: boolean; tallies: Record<string, number>;
}
export async function getActivePoll(debateId: string): Promise<ActivePoll | null> {
  const { data, error } = await supabase.rpc('active_poll', { p_debate: debateId });
  if (error) throw error;
  if (!data) return null;
  const d = data as any;
  return {
    id: d.id, question: d.question,
    options: Array.isArray(d.options) ? d.options : [],
    is_open: !!d.is_open,
    tallies: d.tallies ?? {},
  };
}
export async function castPollVote(pollId: string, choice: number): Promise<void> {
  const { error } = await supabase.rpc('cast_poll_vote', { p_poll: pollId, p_choice: choice });
  if (error) throw error;
}

export type EvidenceKind = 'pdf' | 'chart' | 'video' | 'article' | 'image' | 'book' | 'link';
export interface EvidenceItem {
  id: string; kind: EvidenceKind; title: string; url: string | null;
  citation: string | null; side: Side | null; created_at: string;
  added_by: string; added_name: string | null; added_avatar: string | null;
  comment_count: number;
}
export async function getEvidenceFeed(debateId: string): Promise<EvidenceItem[]> {
  const { data, error } = await supabase.rpc('evidence_feed', { p_debate: debateId });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ ...r, comment_count: Number(r.comment_count ?? 0) })) as EvidenceItem[];
}

/* ─────────────────── BATCH C3 · POST-DEBATE RESULTS ───────────────────
   Aggregate-only summary (no individual ballots/chat rows exposed). */
export interface DebateSummary {
  total_time_secs: number; evidence_count: number; audience_votes: number;
  chat_count: number; judge_prop_wins: number; judge_opp_wins: number; judge_count: number;
}
export async function getDebateSummary(debateId: string): Promise<DebateSummary> {
  const { data, error } = await supabase.rpc('debate_summary', { p_debate: debateId });
  if (error) throw error;
  const d = (data ?? {}) as Partial<DebateSummary>;
  return {
    total_time_secs: Number(d.total_time_secs ?? 0),
    evidence_count: Number(d.evidence_count ?? 0),
    audience_votes: Number(d.audience_votes ?? 0),
    chat_count: Number(d.chat_count ?? 0),
    judge_prop_wins: Number(d.judge_prop_wins ?? 0),
    judge_opp_wins: Number(d.judge_opp_wins ?? 0),
    judge_count: Number(d.judge_count ?? 0),
  };
}

/* ─────────────────── BATCH C4 · EVIDENCE VIEWER ───────────────────
   Writes go straight to the tables — RLS already restricts evidence
   INSERT to host/moderator/debater, and comment INSERT to any
   participant (or anyone, on a public debate). See the ev_insert /
   evc_insert policies applied when debate_evidence was created. */
export async function addEvidence(debateId: string, input: {
  kind: EvidenceKind; title: string; url?: string | null; citation?: string | null; side?: Side | null;
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('not signed in');
  const { error } = await supabase.from('debate_evidence').insert({
    debate_id: debateId, added_by: user.id, kind: input.kind, title: input.title,
    url: input.url ?? null, citation: input.citation ?? null, side: input.side ?? null,
  });
  if (error) throw error;
}

export interface EvidenceComment {
  id: string; body: string; created_at: string;
  author: { display_name: string; avatar_url: string | null; handle: string } | null;
}
export async function getEvidenceComments(evidenceId: string): Promise<EvidenceComment[]> {
  const { data, error } = await supabase.from('evidence_comments')
    .select('id, body, created_at, author:profiles(display_name, avatar_url, handle)')
    .eq('evidence_id', evidenceId).order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as EvidenceComment[];
}
export async function addEvidenceComment(evidenceId: string, body: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('not signed in');
  const { error } = await supabase.from('evidence_comments').insert({ evidence_id: evidenceId, author_id: user.id, body });
  if (error) throw error;
}

/* ─────────────────── TEAM INVITES ───────────────────
   Replaces the old direct-add-without-consent flow. Sending an invite is a
   plain insert (RLS already restricts it to team admins/owners); accepting
   goes through a SECURITY DEFINER RPC since the invited user has no direct
   write access to team_members. */
export interface TeamInvite {
  id: string; team_id: string; invited_user_id: string; invited_by: string;
  status: 'pending' | 'accepted' | 'declined'; created_at: string;
  team?: Pick<Team, 'id' | 'name' | 'tag' | 'color'>;
  inviter?: Pick<Profile, 'display_name' | 'handle' | 'avatar_url'>;
}

export async function inviteToTeam(teamId: string, userId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('not signed in');
  const { error } = await supabase.from('team_invites')
    .insert({ team_id: teamId, invited_user_id: userId, invited_by: user.id });
  if (error) throw error;
}

export async function listMyTeamInvites(): Promise<TeamInvite[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase.from('team_invites')
    .select('*, team:teams(id,name,tag,color), inviter:profiles!team_invites_invited_by_fkey(display_name,handle,avatar_url)')
    .eq('status', 'pending').eq('invited_user_id', user.id).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as TeamInvite[];
}

export async function acceptTeamInvite(inviteId: string): Promise<void> {
  const { error } = await supabase.rpc('accept_team_invite', { p_invite: inviteId });
  if (error) throw error;
}

export async function declineTeamInvite(inviteId: string): Promise<void> {
  const { error } = await supabase.from('team_invites').update({ status: 'declined', responded_at: new Date().toISOString() }).eq('id', inviteId);
  if (error) throw error;
}

/* ─────────────────── PROFILE EDITING ─────────────────── */
export async function updateProfile(patch: {
  display_name?: string; handle?: string; bio?: string | null; topics?: string[]; socials?: Partial<import('./types').Socials>; profile_accent?: string | null;
}): Promise<Profile> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('not signed in');
  const { data, error } = await supabase.from('profiles').update(patch).eq('id', user.id).select('*').single();
  if (error) {
    if (error.code === '23505') throw new Error('That handle is already taken.');
    throw error;
  }
  return data as Profile;
}

/* ─────────────────── SEARCH ─────────────────── */
export interface SearchResults { profiles: Profile[]; debates: Debate[]; }
export async function searchAll(q: string): Promise<SearchResults> {
  const term = q.trim();
  if (!term) return { profiles: [], debates: [] };
  const [{ data: profiles }, { data: debates }] = await Promise.all([
    supabase.from('profiles').select('*').or(`display_name.ilike.%${term}%,handle.ilike.%${term}%`).limit(20),
    supabase.from('debates').select('*, host:profiles!debates_host_id_fkey(display_name,handle,avatar_url)')
      .or(`motion.ilike.%${term}%,tag.ilike.%${term}%`).eq('visibility', 'public').order('created_at', { ascending: false }).limit(20),
  ]);
  return { profiles: (profiles ?? []) as Profile[], debates: (debates ?? []) as Debate[] };
}

/* ─────────────────── REMOVE FROM STAGE (host only) ───────────────────
   Demotes a seated participant (host/mod/debater/judge) back to audience:
   updates the persisted role/side (host already has full RLS rights on
   debate_participants for their own debates) and revokes LiveKit publish
   + pushes new metadata so it's reflected live, not just on reconnect. */
export async function demoteToAudience(debateId: string, userId: string, identity: string): Promise<void> {
  const { error } = await supabase.from('debate_participants')
    .update({ role: 'audience', side: null, can_publish: false }).eq('debate_id', debateId).eq('user_id', userId);
  if (error) throw error;
}

/** Host: promote a seated audience member into a stage role (the inverse
 * of demoteToAudience). Persists the role + grants publish so a reconnect
 * doesn't silently revert them, and pushes live metadata via LiveKit. */
export async function promoteToRole(
  debateId: string, userId: string, role: 'moderator' | 'debater' | 'judge', side: Side | null,
): Promise<void> {
  const { error } = await supabase.from('debate_participants')
    .update({ role, side, can_publish: true }).eq('debate_id', debateId).eq('user_id', userId);
  if (error) throw error;
}

/* ─────────────────── TEAM CRESTS + SPEAKERS' CORNER SIDE IDENTITY ───────────────────
   Team crest upload reuses the same {user_id}/... storage convention (and
   RLS) already used for avatars/thumbnails — teams_update RLS already
   restricts the actual row write to the team's owner/admin. */
export async function getMyTeams(): Promise<Team[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  return getUserTeams(user.id);
}
export async function getUserTeams(userId: string): Promise<Team[]> {
  const { data, error } = await supabase.from('team_members')
    .select('team:teams(*)').eq('user_id', userId);
  if (error) throw error;
  return ((data ?? []) as any[]).map(r => r.team).filter(Boolean) as Team[];
}

export async function uploadTeamCrest(teamId: string, file: File): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('not signed in');
  const ext = file.name.split('.').pop() ?? 'png';
  const path = `${user.id}/team-crest-${teamId}.${ext}`;
  const { error: upErr } = await supabase.storage.from('thumbnails').upload(path, file, { upsert: true });
  if (upErr) throw upErr;
  const url = supabase.storage.from('thumbnails').getPublicUrl(path).data.publicUrl;
  const { error } = await supabase.from('teams').update({ crest_url: url }).eq('id', teamId);
  if (error) throw error;
  return url;
}

export interface SideIdentity { label: string; logoUrl: string | null; teamId: string | null }
export async function getSideIdentity(debateId: string): Promise<{ prop: SideIdentity | null; opp: SideIdentity | null }> {
  const { data, error } = await supabase.from('debate_side_identity')
    .select('side, custom_name, custom_logo_url, team:teams(id,name,crest_url)').eq('debate_id', debateId);
  if (error) throw error;
  const out: { prop: SideIdentity | null; opp: SideIdentity | null } = { prop: null, opp: null };
  for (const row of (data ?? []) as any[]) {
    const identity: SideIdentity = row.team
      ? { label: row.team.name, logoUrl: row.team.crest_url, teamId: row.team.id }
      : { label: row.custom_name ?? '', logoUrl: row.custom_logo_url ?? null, teamId: null };
    if (row.side === 'prop') out.prop = identity; else if (row.side === 'opp') out.opp = identity;
  }
  return out;
}
export async function setSideCustomIdentity(debateId: string, side: Side, name: string, logoFile?: File | null): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('not signed in');
  let logoUrl: string | undefined;
  if (logoFile) {
    const ext = logoFile.name.split('.').pop() ?? 'png';
    const path = `${user.id}/side-crest-${debateId}-${side}.${ext}`;
    const { error: upErr } = await supabase.storage.from('thumbnails').upload(path, logoFile, { upsert: true });
    if (upErr) throw upErr;
    logoUrl = supabase.storage.from('thumbnails').getPublicUrl(path).data.publicUrl;
  }
  const { error } = await supabase.from('debate_side_identity').upsert({
    debate_id: debateId, side, team_id: null, custom_name: name,
    ...(logoUrl ? { custom_logo_url: logoUrl } : {}), updated_by: user.id, updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}
export async function setSideTeam(debateId: string, side: Side, teamId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('not signed in');
  const { error } = await supabase.from('debate_side_identity').upsert({
    debate_id: debateId, side, team_id: teamId, custom_name: null, custom_logo_url: null,
    updated_by: user.id, updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

/* Speakers' Corner spotlight — persisted (rides the existing broadcast-state
   realtime + initial-read), so a late joiner sees the current spotlight
   immediately instead of only future changes. Any seated debater or the
   host may set it (see set_spotlight RPC). */
export async function setSpotlight(debateId: string, identity: string | null): Promise<void> {
  const { error } = await supabase.rpc('set_spotlight', { p_debate: debateId, p_identity: identity });
  if (error) throw error;
}
