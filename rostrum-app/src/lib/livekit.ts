// =====================================================================
// The Rostrum · src/lib/livekit.ts
// Thin client wrappers around the Netlify functions. Every call is
// authenticated with the user's Supabase access token.
// =====================================================================
import { supabase } from './supabaseClient';

async function authedPost<T = any>(fn: string, body: unknown): Promise<T> {
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

export interface RoomToken { url: string; token: string; room: string; role: string; canPublish: boolean; }

/* ----------------------- BROADCAST CONTROL CHANNEL -----------------------
   Instant studio control: the host publishes layout/stage/slide changes over
   the LiveKit data channel. The broadcast page (egress) receives them with no
   DB-realtime dependency, so switching is immediate and reliable. The DB is
   still updated separately for persistence (late joiners / page refresh). */
export interface BcastControlMsg {
  kind: 'bcast';
  layout?: 'camera' | 'slides' | 'sidebyside' | 'pip';
  stageId?: string | null;
  slidesOn?: boolean;
  deckChanged?: boolean;   // signal the broadcast page to refetch the deck
}

const enc = new TextEncoder();
const dec = new TextDecoder();

/** Host: publish a control message to everyone in the room (incl. the egress). */
export function publishBcastControl(room: any, msg: Omit<BcastControlMsg, 'kind'>) {
  try {
    const payload = enc.encode(JSON.stringify({ kind: 'bcast', ...msg }));
    room?.localParticipant?.publishData(payload, { reliable: true });
  } catch { /* non-fatal: DB realtime is the fallback */ }
}

/** Broadcast page: parse an incoming data payload into a control message. */
export function parseBcastControl(payload: Uint8Array): BcastControlMsg | null {
  try {
    const obj = JSON.parse(dec.decode(payload));
    return obj?.kind === 'bcast' ? obj as BcastControlMsg : null;
  } catch { return null; }
}


/** Get a LiveKit token for this debate (grants derived from your seat). */
export const getRoomToken = (debateId: string) =>
  authedPost<RoomToken>('livekit-token', { debateId });

/** Host-only controls. */
const control = (debateId: string, action: string, payload?: unknown) =>
  authedPost('livekit-control', { debateId, action, payload });

export const openMic       = (debateId: string, identity: string) => control(debateId, 'set_publish', { identity, canPublish: true });
export const closeMic      = (debateId: string, identity: string) => control(debateId, 'set_publish', { identity, canPublish: false });
export const muteAudience  = (debateId: string) => control(debateId, 'mute_audience');
export const startRecording= (debateId: string) => control(debateId, 'recording_start') as Promise<{ egressId: string }>;
export const startYouTube  = (debateId: string, streamKey?: string) => control(debateId, 'youtube_start', streamKey ? { streamKey } : {}) as Promise<{ egressId?: string; skipped?: boolean }>;
export const stopEgress    = (debateId: string, egressId: string) => control(debateId, 'egress_stop', { egressId });
export const removePeer    = (debateId: string, identity: string) => control(debateId, 'remove', { identity });

/**
 * Convenience for "Next segment": open the mics of the side now speaking,
 * close the others. Moderators/host stay open (handled by their own seats).
 * `debaters` = [{ identity, side }]; `activeSide` = 'prop' | 'opp' | null.
 */
export async function applySegmentMics(
  debateId: string,
  debaters: { identity: string; side: 'prop' | 'opp' | null }[],
  activeSide: 'prop' | 'opp' | null,
) {
  await Promise.all(debaters.map(d =>
    control(debateId, 'set_publish', { identity: d.identity, canPublish: activeSide != null && d.side === activeSide })));
}
