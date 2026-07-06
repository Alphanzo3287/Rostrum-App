// =====================================================================
// The Rostrum · src/lib/analytics.ts
// Host-facing debate analytics (a Rostrum Pro perk). All figures come
// from real captured data via the get_debate_analytics RPC.
// =====================================================================
import { supabase } from './supabaseClient';

export interface DebateAnalytics {
  motion: string | null;
  format: string | null;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  duration_secs: number | null;
  current_viewers: number;
  peak_viewers: number;
  total_attendees: number;
  votes: { prop: number; opp: number; total: number };
  gifts: { total_cents: number; count: number };
  gift_top: { name: string; cents: number }[];
  speaking: { name: string; seconds: number; role: string | null; side: string | null }[];
  viewer_series: { at: string; count: number }[];
}

export async function getDebateAnalytics(debateId: string): Promise<DebateAnalytics> {
  const { data, error } = await supabase.rpc('get_debate_analytics', { p_debate: debateId });
  if (error) throw error;
  return data as DebateAnalytics;
}

export interface HostSummary {
  debates_hosted: number; total_attendees: number; total_votes: number;
  total_gift_cents: number; peak_single: number;
}
export async function getHostAnalyticsSummary(): Promise<HostSummary> {
  const { data, error } = await supabase.rpc('get_host_analytics_summary');
  if (error) throw error;
  return data as HostSummary;
}

export interface HostedDebate {
  id: string; motion: string | null; format: string | null; status: string;
  created_at: string; viewer_count: number | null;
}
/** Every debate the current user has hosted (recorded or not), newest first. */
export async function myHostedDebates(): Promise<HostedDebate[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase.from('debates')
    .select('id, motion, format, status, created_at, viewer_count')
    .eq('host_id', user.id).order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  return (data as HostedDebate[]) ?? [];
}
