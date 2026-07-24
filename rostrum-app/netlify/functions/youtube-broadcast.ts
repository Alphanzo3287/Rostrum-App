// =====================================================================
// The Rostrum · netlify/functions/youtube-broadcast.ts
// POST { action, debateId, title?, description?, thumbnailUrl?, scheduledAt? }
// Actions:
//   create   → creates a YouTube liveBroadcast + liveStream, binds them,
//              stores in youtube_broadcasts, sets debate.youtube_stream_key.
//   go_live  → transitions the broadcast from ready → live.
//   end      → transitions broadcast to complete.
//   status   → returns current broadcast status.
//   disconnect → revokes Google token + removes youtube_tokens row.
// =====================================================================
import type { Handler } from '@netlify/functions';
import { supabaseAdmin, userFromToken } from '../../src/server/supabaseAdmin';

const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const YT            = 'https://www.googleapis.com/youtube/v3';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'method not allowed' });
  const user = await userFromToken(event.headers.authorization || event.headers.Authorization);
  if (!user) return json(401, { error: 'invalid session' });

  let body: any = {};
  try { body = JSON.parse(event.body ?? '{}'); } catch {}
  const { action, debateId, title, description, thumbnailUrl, scheduledAt, privacy } = body;

  try {
    // ── Token helpers ────────────────────────────────────────────────
    const token = await getFreshToken(user.id);
    if (!token && action !== 'disconnect') {
      // Distinguish "never connected" from "connected but Google refused the
      // refresh" — the second needs a reconnect, and telling the user they
      // aren't connected while Settings says they are is a dead end.
      const { data: hasRow } = await supabaseAdmin
        .from('youtube_tokens').select('user_id').eq('user_id', user.id).maybeSingle();
      return json(403, {
        error: hasRow
          ? 'YouTube session expired — disconnect and reconnect YouTube in Settings'
          : 'YouTube not connected',
      });
    }

    const yt = (path: string, opts?: RequestInit) =>
      fetch(`${YT}${path}`, {
        ...opts,
        headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(opts?.headers ?? {}) },
      }).then(r => r.json());

    // ── disconnect ───────────────────────────────────────────────────
    if (action === 'disconnect') {
      const { data } = await supabaseAdmin
        .from('youtube_tokens').select('access_token').eq('user_id', user.id).maybeSingle();
      if (data?.access_token) {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${data.access_token}`, { method: 'POST' });
      }
      await supabaseAdmin.from('youtube_tokens').delete().eq('user_id', user.id);
      return json(200, { disconnected: true });
    }

    // ── create ───────────────────────────────────────────────────────
    if (action === 'create') {
      if (!debateId || !title) return json(400, { error: 'debateId and title required' });

      // Map to YouTube's exact privacy values; default to unlisted (safe).
      const privacyStatus = ['public', 'unlisted', 'private'].includes(privacy)
        ? privacy : 'unlisted';

      const scheduledStartTime = scheduledAt
        ? new Date(scheduledAt).toISOString()
        : new Date(Date.now() + 60_000).toISOString();  // 1 min from now if not scheduled

      // 1. Create the broadcast
      const broadcast = await yt('/liveBroadcasts?part=snippet,status,contentDetails', {
        method: 'POST',
        body: JSON.stringify({
          snippet: {
            title, description: description ?? '',
            scheduledStartTime,
          },
          status:         { privacyStatus, selfDeclaredMadeForKids: false },
          contentDetails: { enableAutoStart: true, enableAutoStop: true, latencyPreference: 'low' },
        }),
      });
      if (!broadcast.id) return json(500, { error: broadcast.error?.message ?? 'broadcast create failed' });

      // 2. Create the live stream (RTMP ingestion point)
      const stream = await yt('/liveStreams?part=snippet,cdn', {
        method: 'POST',
        body: JSON.stringify({
          snippet: { title: `${title} · stream` },
          cdn: { frameRate: '30fps', ingestionType: 'rtmp', resolution: '1080p' },
        }),
      });
      if (!stream.id) return json(500, { error: 'liveStream create failed' });

      // 3. Bind stream to broadcast
      await yt(`/liveBroadcasts/bind?id=${broadcast.id}&part=id&streamId=${stream.id}`, { method: 'POST', body: '{}' });

      // 4. Optional thumbnail. Still best-effort (a bad image should never
      // sink the broadcast), but failures are now LOGGED — the old silent
      // catch hid a bug where this never once succeeded.
      if (thumbnailUrl) {
        try {
          const imgRes = await fetch(thumbnailUrl);
          if (!imgRes.ok) throw new Error(`image fetch ${imgRes.status}`);
          const imgBuf = await imgRes.arrayBuffer();
          if (imgBuf.byteLength > 2_000_000) throw new Error(`image ${imgBuf.byteLength}B exceeds YouTube's 2MB thumbnail limit`);
          const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg';
          const setRes = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${broadcast.id}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'content-type': contentType },
            body: imgBuf,
          });
          const setBody = await setRes.json().catch(() => ({}));
          if (!setRes.ok) {
            // Most common cause: the channel isn't phone-verified — YouTube
            // requires verification (youtube.com/verify) for custom thumbnails.
            console.warn('youtube: thumbnail rejected', setRes.status, JSON.stringify(setBody?.error ?? setBody));
          }
        } catch (err: any) {
          console.warn('youtube: thumbnail upload failed', err?.message);
        }
      }

      const rtmpUrl   = stream.cdn?.ingestionInfo?.ingestionAddress ?? '';
      const streamKey = stream.cdn?.ingestionInfo?.streamName ?? '';

      // 5. Store in DB + write to debate_secrets for LiveKit egress
      await supabaseAdmin.from('youtube_broadcasts').upsert({
        debate_id: debateId, broadcast_id: broadcast.id, stream_id: stream.id,
        rtmp_url: rtmpUrl, stream_key: streamKey, status: 'ready', privacy: privacyStatus,
        yt_title: title, yt_description: description ?? '',
        scheduled_at: scheduledAt ?? null, updated_at: new Date().toISOString(),
      }, { onConflict: 'debate_id' });

      // Write stream key into debate_secrets so LiveKit can pick it up
      await supabaseAdmin.from('debate_secrets')
        .upsert({ debate_id: debateId, youtube_stream_key: `${rtmpUrl}/${streamKey}` },
          { onConflict: 'debate_id' });

      return json(200, {
        broadcastId: broadcast.id, streamId: stream.id, rtmpUrl, streamKey,
        youtubeUrl: `https://studio.youtube.com/video/${broadcast.id}/livestreaming`,
      });
    }

    // ── go_live ──────────────────────────────────────────────────────
    if (action === 'go_live') {
      if (!debateId) return json(400, { error: 'debateId required' });
      const { data: bc } = await supabaseAdmin
        .from('youtube_broadcasts').select('broadcast_id').eq('debate_id', debateId).maybeSingle();
      if (!bc) return json(404, { error: 'no broadcast for this debate' });

      const result = await yt(
        `/liveBroadcasts/transition?broadcastStatus=live&id=${bc.broadcast_id}&part=status`,
        { method: 'POST', body: '{}' }
      );
      // YouTube returns an error object if the stream isn't ready (no data
      // arriving yet) or the broadcast is in the wrong state. Surface it so
      // the client can retry rather than falsely showing "live".
      if (result.error) {
        const reason = result.error?.errors?.[0]?.reason ?? result.error?.message ?? 'transition_failed';
        console.error('go_live transition rejected:', JSON.stringify(result.error));
        return json(409, { error: `YouTube rejected go-live: ${reason}`, reason });
      }
      const lifeStatus = result.status?.lifeCycleStatus;
      await supabaseAdmin.from('youtube_broadcasts')
        .update({ status: 'live', updated_at: new Date().toISOString() }).eq('debate_id', debateId);
      return json(200, { status: 'live', lifeCycleStatus: lifeStatus });
    }

    // ── end ──────────────────────────────────────────────────────────
    if (action === 'end') {
      if (!debateId) return json(400, { error: 'debateId required' });
      const { data: bc } = await supabaseAdmin
        .from('youtube_broadcasts').select('broadcast_id').eq('debate_id', debateId).maybeSingle();
      if (bc) {
        await yt(`/liveBroadcasts/transition?broadcastStatus=complete&id=${bc.broadcast_id}&part=status`, { method: 'POST', body: '{}' });
        await supabaseAdmin.from('youtube_broadcasts')
          .update({ status: 'complete', updated_at: new Date().toISOString() }).eq('debate_id', debateId);
      }
      return json(200, { status: 'complete' });
    }

    // ── status ───────────────────────────────────────────────────────
    if (action === 'status') {
      if (!debateId) return json(400, { error: 'debateId required' });
      const { data: bc } = await supabaseAdmin
        .from('youtube_broadcasts').select('*').eq('debate_id', debateId).maybeSingle();
      return json(200, bc ?? { status: 'none' });
    }

    return json(400, { error: 'unknown action' });

  } catch (err: any) {
    console.error('youtube-broadcast error:', err);
    return json(500, { error: err?.message ?? 'internal error' });
  }
};

// ── Token management: refresh if expired ────────────────────────────────
async function getFreshToken(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('youtube_tokens').select('access_token,refresh_token,expires_at').eq('user_id', userId).maybeSingle();
  if (!data) return null;

  // If token still valid (with 2-min buffer), return it directly.
  if (new Date(data.expires_at).getTime() - Date.now() > 120_000) return data.access_token;

  // Refresh
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: data.refresh_token,
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type:    'refresh_token',
    }),
  });
  const tokens = await res.json();
  if (!tokens.access_token) {
    // Surface WHY Google refused — this was previously swallowed, making
    // every refresh failure look like "not connected" with no trace.
    console.error('youtube: token refresh failed', {
      userId, error: tokens.error, description: tokens.error_description,
    });
    // invalid_grant = the refresh token itself is dead (revoked, or expired
    // by Google's 7-day limit for OAuth apps in Testing mode). The row is
    // unusable; delete it so the UI honestly shows "not connected" instead
    // of a connected-looking Settings page over a broken stream button.
    if (tokens.error === 'invalid_grant') {
      await supabaseAdmin.from('youtube_tokens').delete().eq('user_id', userId);
    }
    return null;
  }

  const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();
  await supabaseAdmin.from('youtube_tokens').update({
    access_token: tokens.access_token,
    expires_at:   expiresAt,
    updated_at:   new Date().toISOString(),
  }).eq('user_id', userId);

  return tokens.access_token;
}

function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}
