// =====================================================================
// The Rostrum · src/lib/youtube.ts
// Client wrappers for the YouTube integration.
// Connect once via OAuth; create/manage broadcasts per debate.
// =====================================================================
import { supabase } from './supabaseClient';

async function authedPost<T = any>(fn: string, body: unknown = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('not authenticated');
  const res = await fetch(`/.netlify/functions/${fn}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? `${fn} failed`);
  return res.json();
}

export interface YouTubeConnection {
  connected: boolean;
  channel_id: string | null;
  channel_title: string | null;
}

export interface YouTubeBroadcastInfo {
  broadcastId: string;
  streamId: string;
  rtmpUrl: string;
  streamKey: string;
  youtubeUrl: string;   // link to YouTube Studio livestreaming page
}

/** Is this user connected to YouTube? */
export async function getYouTubeConnection(): Promise<YouTubeConnection> {
  const { data, error } = await supabase.rpc('get_youtube_connection');
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row ?? { connected: false, channel_id: null, channel_title: null };
}

/**
 * Start the OAuth connect flow. Opens the Google consent screen.
 * The user will be redirected back to /settings?yt=connected when done.
 */
export async function connectYouTube(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('not authenticated');
  // Redirect the browser to the auth function, carrying the JWT as state.
  window.location.href =
    `/.netlify/functions/youtube-auth?action=connect&token=${session.access_token}`;
}

/** Revoke and remove the YouTube connection. */
export const disconnectYouTube = () =>
  authedPost<{ disconnected: boolean }>('youtube-broadcast', { action: 'disconnect' });

/**
 * Create a YouTube broadcast + RTMP stream for a debate.
 * Called when the host creates or schedules a debate with YouTube enabled.
 */
export const createYouTubeBroadcast = (opts: {
  debateId: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  scheduledAt?: string;   // ISO string — for scheduled debates
}) => authedPost<YouTubeBroadcastInfo>('youtube-broadcast', { action: 'create', ...opts });

/** Transition the broadcast to live (call when debate goes live). */
export const goLiveOnYouTube = (debateId: string) =>
  authedPost('youtube-broadcast', { action: 'go_live', debateId });

/** End the broadcast (call when debate ends). */
export const endYouTubeBroadcast = (debateId: string) =>
  authedPost('youtube-broadcast', { action: 'end', debateId });

/** Get the broadcast status for a debate. */
export const getYouTubeBroadcastStatus = (debateId: string) =>
  authedPost<{ status: string; yt_title?: string; youtubeUrl?: string }>(
    'youtube-broadcast', { action: 'status', debateId }
  );
