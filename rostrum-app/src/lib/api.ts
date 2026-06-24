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

/* ----------------------------- LOBBY ----------------------------- */

export async function listLiveDebates(): Promise<Debate[]> {
  const { data, error } = await supabase
    .from('debates')
    .select('*, host:profiles!debates_host_id_fkey(display_name,handle,avatar_url)')
    .in('status', ['assembly', 'live'])
    .order('viewer_count', { ascending: false });
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
  segments: { label: string; side: Side | null; durationSecs: number }[];
  thumbnailFile?: File | null;
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
    status: 'assembly',
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
  const { error: e2 } = await supabase.from('debates')
    .update({ deck_urls: urls, current_slide: 0 }).eq('id', debateId);
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

// Everyone follows the presenter's position in real time.
export function subscribeSlide(debateId: string, onChange: (current: number) => void) {
  const ch = supabase.channel(`slide:${debateId}`)
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'debates', filter: `id=eq.${debateId}` },
      (payload: any) => { if (payload.new?.current_slide != null) onChange(payload.new.current_slide); })
    .subscribe();
  return () => { supabase.removeChannel(ch); };
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

// One subscription for everything that changes on the debate row:
// status (assembly→live→ended), current_segment, the clock, and the slide.
export function subscribeDebate(debateId: string, onChange: (d: Partial<Debate>) => void) {
  const ch = supabase.channel(`debate:${debateId}`)
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'debates', filter: `id=eq.${debateId}` },
      (payload: any) => onChange(payload.new as Partial<Debate>))
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}

/* --------------------------- REALTIME ---------------------------- */
// Live poll bars, the "who's in the room" gallery, and the Q&A queue.

export function subscribeTally(debateId: string, onChange: (t: Tally) => void) {
  const ch = supabase.channel(`votes:${debateId}`)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'votes', filter: `debate_id=eq.${debateId}` },
      async () => onChange(await getTally(debateId)))
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}

export function subscribeParticipants(debateId: string, onChange: () => void) {
  const ch = supabase.channel(`participants:${debateId}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'debate_participants', filter: `debate_id=eq.${debateId}` },
      () => onChange())
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}

export function subscribeQuestions(debateId: string, onChange: () => void) {
  const ch = supabase.channel(`questions:${debateId}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'questions', filter: `debate_id=eq.${debateId}` },
      () => onChange())
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
