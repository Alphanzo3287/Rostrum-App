// =====================================================================
// The Rostrum · src/lib/tournaments.ts
// Single-elimination tournaments: browse, create, register.
// Bracket generation & advancement arrive in later phases.
// =====================================================================
import { supabase } from './supabaseClient';

export interface Tournament {
  id: string;
  title: string;
  description: string | null;
  kind: 'individual' | 'team';
  debate_format: string;
  size: number;
  status: 'registration' | 'live' | 'completed' | 'cancelled';
  prize_pool: number;
  starts_at: string | null;
  created_by: string;
  champion_entrant_id: string | null;
  created_at: string;
  entrant_count?: number;
}

export interface TournamentEntrant {
  id: string;
  user_id: string | null;
  team_id: string | null;
  seed: number | null;
  eliminated: boolean;
  profile?: { display_name: string; handle: string; avatar_url: string | null };
}

export async function listTournaments(): Promise<Tournament[]> {
  const { data, error } = await supabase.from('tournaments').select('*')
    .neq('status', 'cancelled').order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  return (data ?? []) as Tournament[];
}

export async function getTournament(id: string): Promise<Tournament | null> {
  const { data, error } = await supabase.from('tournaments').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as Tournament) ?? null;
}

export async function tournamentEntrants(id: string): Promise<TournamentEntrant[]> {
  const { data, error } = await supabase.from('tournament_entrants')
    .select('id, user_id, team_id, seed, eliminated, profile:profiles(display_name, handle, avatar_url)')
    .eq('tournament_id', id).order('registered_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as any as TournamentEntrant[];
}

export async function isRegistered(id: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.from('tournament_entrants')
    .select('id').eq('tournament_id', id).eq('user_id', user.id).maybeSingle();
  return !!data;
}

export async function createTournament(input: {
  title: string; description?: string; debateFormat: string; size: number; startsAt?: string | null;
}): Promise<Tournament> {
  const { data, error } = await supabase.rpc('create_tournament', {
    p_title: input.title, p_description: input.description ?? null,
    p_debate_format: input.debateFormat, p_size: input.size, p_starts_at: input.startsAt ?? null,
  });
  if (error) throw error;
  return data as Tournament;
}

export const registerForTournament = (id: string) => supabase.rpc('register_for_tournament', { p_tournament: id }).then(r => { if (r.error) throw r.error; });
export const withdrawFromTournament = (id: string) => supabase.rpc('withdraw_from_tournament', { p_tournament: id }).then(r => { if (r.error) throw r.error; });
export const deleteTournament = (id: string) => supabase.rpc('delete_tournament', { p_tournament: id }).then(r => { if (r.error) throw r.error; });
export const startTournament = (id: string) => supabase.rpc('start_tournament', { p_tournament: id }).then(r => { if (r.error) throw r.error; });
export async function startMatch(matchId: string): Promise<string> {
  const { data, error } = await supabase.rpc('start_tournament_match', { p_match: matchId });
  if (error) throw error;
  return data as string;   // the created debate id
}

export interface BracketSlot { name: string; seed: number | null }
export interface BracketMatch {
  id: string; round: number; slot: number; status: string;
  a: BracketSlot | null; b: BracketSlot | null; winner_entrant: string | null;
  entrant_a: string | null; entrant_b: string | null; debate_id: string | null;
}

/** The full bracket: every match with resolved entrant names, plus round count. */
export async function getBracket(tournamentId: string): Promise<{ rounds: number; matches: BracketMatch[] }> {
  const [mRes, eRes] = await Promise.all([
    supabase.from('tournament_matches').select('*').eq('tournament_id', tournamentId).order('round').order('slot'),
    supabase.from('tournament_entrants').select('id, seed, profile:profiles(display_name)').eq('tournament_id', tournamentId),
  ]);
  const emap = new Map<string, BracketSlot>();
  for (const e of (eRes.data ?? []) as any[]) emap.set(e.id, { name: e.profile?.display_name ?? 'Entrant', seed: e.seed });
  const matches: BracketMatch[] = (mRes.data ?? []).map((m: any) => ({
    id: m.id, round: m.round, slot: m.slot, status: m.status,
    entrant_a: m.entrant_a, entrant_b: m.entrant_b, winner_entrant: m.winner_entrant, debate_id: m.debate_id,
    a: m.entrant_a ? emap.get(m.entrant_a) ?? null : null,
    b: m.entrant_b ? emap.get(m.entrant_b) ?? null : null,
  }));
  const rounds = matches.reduce((mx, m) => Math.max(mx, m.round), 0);
  return { rounds, matches };
}
