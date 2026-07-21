// =====================================================================
// The Rostrum · netlify/functions/livekit-webhook.ts
// Point your LiveKit project's webhook at /.netlify/functions/livekit-webhook
// - egress_ended           -> save the MP4 location to debates.recording_url
// - participant_joined/left -> keep debates.viewer_count fresh
// - track_published (audio) -> start speaking-time clock
// - track_unpublished (audio) / participant_left -> stop clock, accumulate seconds
// =====================================================================
import type { Handler } from '@netlify/functions';
import { WebhookReceiver, RoomServiceClient } from 'livekit-server-sdk';
import { supabaseAdmin } from '../../src/server/supabaseAdmin';

const receiver = new WebhookReceiver(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!);
const httpUrl = (process.env.LIVEKIT_URL || '').replace('wss://', 'https://').replace('ws://', 'http://');
const rooms = new RoomServiceClient(httpUrl, process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!);

export const handler: Handler = async (event) => {
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  // Netlify may base64-encode the body depending on content-type; LiveKit's
  // signature is over the RAW body, so decode first or the check fails (401).
  const raw = event.isBase64Encoded && event.body
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : (event.body || '');

  let e: any;
  let sigOk = false;
  let note: string | null = null;
  try {
    e = await receiver.receive(raw, authHeader);
    sigOk = true;
  } catch (err: any) {
    note = String(err?.message ?? err).slice(0, 300);
  }

  // Diagnostic log (temporary): every attempt, so we can see delivery + signature.
  try {
    await supabaseAdmin.from('webhook_log').insert({
      has_auth: !!authHeader, body_len: raw.length, sig_ok: sigOk,
      event_type: sigOk ? (e?.event ?? null) : null, note,
    });
  } catch { /* logging must never break the webhook */ }

  if (!sigOk) return { statusCode: 401, body: 'bad signature' };

  const room = e.room?.name ?? e.egressInfo?.roomName;

  // ── Egress (recording) ──────────────────────────────────────────────
  if (e.event === 'egress_ended') {
    const fr = e.egressInfo?.fileResults?.[0] ?? e.egressInfo?.file;
    // Prefer the bare object key; objectKey() in replay.ts handles either form.
    const loc = fr?.filename || fr?.location;
    // egress_ended payloads can arrive with no room on the event OR the egress
    // info. The filename embeds it (livekit-control names files `${room}-${ts}.mp4`),
    // so recover it from there as a last resort.
    let egRoom: string = room || e.egressInfo?.roomName || (e.egressInfo as any)?.room_name || '';
    if (!egRoom && fr?.filename) {
      const m = String(fr.filename).match(/^(.+)-\d+\.mp4$/);
      if (m) egRoom = m[1];
    }
    if (loc && egRoom) {
      await supabaseAdmin.from('debates')
        .update({ recording_url: loc }).eq('livekit_room', egRoom);
      try { await supabaseAdmin.from('webhook_log').insert({
        has_auth: true, body_len: 0, sig_ok: true,
        event_type: 'recording_saved', note: `room=${egRoom} loc=${String(loc).slice(0, 180)}`,
      }); } catch { /* diagnostics must never break the webhook */ }
    } else {
      // Never fail silently again: record exactly what the payload offered.
      try { await supabaseAdmin.from('webhook_log').insert({
        has_auth: true, body_len: 0, sig_ok: true,
        event_type: 'egress_no_location', note: `room=${egRoom || '?'} fr=${JSON.stringify(fr ?? null).slice(0, 220)}`,
      }); } catch { /* noop */ }
    }
  }

  // ── Viewer count ────────────────────────────────────────────────────
  if (e.event === 'participant_joined' || e.event === 'participant_left') {
    if (room) {
      // Ask LiveKit for the real participant list — more reliable than the
      // numParticipants field, which isn't always populated on these payloads.
      let count = e.room?.numParticipants ?? null;
      try { count = (await rooms.listParticipants(room)).length; } catch { /* room may be gone */ }
      if (count != null) {
        await supabaseAdmin.from('debates').update({ viewer_count: count }).eq('livekit_room', room);
        // Time-series snapshot for the analytics drop-off chart.
        try {
          const { data: d } = await supabaseAdmin.from('debates').select('id').eq('livekit_room', room).maybeSingle();
          if (d?.id) await supabaseAdmin.from('debate_viewer_snapshots').insert({ debate_id: d.id, count });
        } catch { /* snapshot is best-effort */ }
        try { await supabaseAdmin.from('webhook_log').insert({ has_auth: true, body_len: 0, sig_ok: true, event_type: 'count_write', note: `room=${room} count=${count}` }); } catch { /* noop */ }
      }
    }
  }

  // ── Speaking time capture ───────────────────────────────────────────
  // LiveKit identity = user UUID (set in livekit-token.ts)
  const userId = e.participant?.identity;

  if (e.event === 'track_published' && userId && room) {
    const isAudio = e.track?.type === 'AUDIO' || e.track?.source === 'MICROPHONE';
    if (isAudio) {
      const debateId = await roomToDebate(room);
      if (debateId) {
        // Upsert the row and start the mic clock
        await supabaseAdmin.from('debate_speaking').upsert({
          debate_id: debateId,
          user_id: userId,
          mic_on_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'debate_id,user_id', ignoreDuplicates: false });
      }
    }
  }

  if ((e.event === 'track_unpublished' || e.event === 'participant_left') && userId && room) {
    const isAudio = e.event === 'participant_left' || e.track?.type === 'AUDIO' || e.track?.source === 'MICROPHONE';
    if (isAudio) {
      const debateId = await roomToDebate(room);
      if (debateId) await closeMicSession(debateId, userId);
    }
  }

  return { statusCode: 200, body: 'ok' };
};

/** Resolve a LiveKit room name to a debate UUID. */
async function roomToDebate(room: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('debates').select('id').eq('livekit_room', room).maybeSingle();
  return data?.id ?? null;
}

/** Close an open mic session: add elapsed seconds, clear mic_on_at. */
async function closeMicSession(debateId: string, userId: string) {
  const { data: row } = await supabaseAdmin
    .from('debate_speaking')
    .select('mic_on_at, speaking_seconds')
    .eq('debate_id', debateId).eq('user_id', userId)
    .maybeSingle();

  if (!row?.mic_on_at) return; // mic wasn't on

  const elapsed = Math.max(0, Math.floor((Date.now() - new Date(row.mic_on_at).getTime()) / 1000));
  const newTotal = (row.speaking_seconds ?? 0) + elapsed;

  await supabaseAdmin.from('debate_speaking').update({
    speaking_seconds: newTotal,
    mic_on_at: null,
    updated_at: new Date().toISOString(),
  }).eq('debate_id', debateId).eq('user_id', userId);
}
