// =====================================================================
// The Rostrum · src/lib/replays.ts
// Replay listing + playback + host management (visibility / delete).
// =====================================================================
import { supabase } from './supabaseClient';

export interface ReplayItem {
  id: string; title: string; format: string | null; status: string;
  created_at: string; recording_visibility: 'private' | 'public';
  host_id: string;
}
export interface ReplayAccess {
  playUrl: string; downloadUrl: string; visibility: 'private' | 'public'; title: string | null;
}

/** Free hosts keep replays this long; Rostrum Pro keeps them forever. */
export const REPLAY_RETENTION_DAYS = 7;

/** Has this replay passed the free-tier retention window? */
export function isReplayExpired(createdAt: string, hostIsPro: boolean): boolean {
  if (hostIsPro) return false;
  return Date.now() - new Date(createdAt).getTime() > REPLAY_RETENTION_DAYS * 24 * 60 * 60 * 1000;
}

async function authedPost<T = any>(body: unknown): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch('/.netlify/functions/replay', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
    body: JSON.stringify(body),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out?.error ?? `replay request failed (${res.status})`);
  return out as T;
}

/** Replays I host (any visibility) — for the Library. */
export async function myReplays(): Promise<ReplayItem[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase.from('debates')
    .select('id, title:motion, format, status, created_at, recording_visibility, host_id')
    .eq('host_id', user.id).not('recording_url', 'is', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as ReplayItem[]) ?? [];
}

/** A user's PUBLIC replays — for their profile. Expired free-tier replays are
 *  hidden; a Pro host's replays never expire. */
export async function publicReplaysOf(hostId: string): Promise<ReplayItem[]> {
  const { data: host } = await supabase.from('profiles').select('pro_until').eq('id', hostId).maybeSingle();
  const hostIsPro = !!host?.pro_until && new Date(host.pro_until) > new Date();

  const { data, error } = await supabase.from('debates')
    .select('id, title:motion, format, status, created_at, recording_visibility, host_id')
    .eq('host_id', hostId).eq('recording_visibility', 'public')
    .not('recording_url', 'is', null)
    .order('created_at', { ascending: false }).limit(24);
  if (error) throw error;
  const rows = (data as ReplayItem[]) ?? [];
  return rows.filter(r => !isReplayExpired(r.created_at, hostIsPro));
}

export const getReplayAccess = (debateId: string) =>
  authedPost<ReplayAccess>({ action: 'play', debateId });

export const setReplayVisibility = (debateId: string, visibility: 'private' | 'public') =>
  authedPost<{ ok: true; visibility: string }>({ action: 'set_visibility', debateId, visibility });

export const deleteReplay = (debateId: string) =>
  authedPost<{ ok: true }>({ action: 'delete', debateId });
