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
