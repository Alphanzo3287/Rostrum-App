// =====================================================================
// The Rostrum · src/lib/rewards.ts
// End-of-debate XP reward summary for the current user.
// =====================================================================
import { supabase } from './supabaseClient';

export interface DebateReward {
  xp_awarded: number;
  old_level: number;
  new_level: number;
  leveled_up: boolean;
  current_xp: number;
  level_floor_xp: number;
  next_level_xp: number;
  milestones: { level: number; reward: number }[];
}

/** What the current user earned in a debate — or null if they earned nothing. */
export async function getDebateReward(debateId: string): Promise<DebateReward | null> {
  const { data, error } = await supabase.rpc('get_debate_reward', { p_debate: debateId });
  if (error || !data) return null;
  return data as DebateReward;
}
