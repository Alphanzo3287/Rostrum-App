// =====================================================================
// The Rostrum · netlify/functions/livekit-control.ts
// Host-only room control. Verifies the caller owns the debate, then:
//   set_publish     — open/close one participant's mic (segment gating)
//   mute_audience   — failsafe: revoke publish from anyone marked audience
//   recording_start — start MP4 egress (→ S3 / LiveKit Cloud storage)
//   youtube_start   — RTMP simulcast to YouTube
//   egress_stop     — stop a recording or stream
//   remove          — eject a participant
// =====================================================================
import type { Handler } from '@netlify/functions';
import { createHmac } from 'crypto';
import {
  RoomServiceClient, EgressClient,
  EncodedFileOutput, EncodedFileType, S3Upload,
  StreamOutput, StreamProtocol, AccessToken,
} from 'livekit-server-sdk';
import { supabaseAdmin, userFromToken } from '../../src/server/supabaseAdmin';

const SITE = process.env.PUBLIC_SITE_URL || process.env.URL || 'https://rostrums.site';

/** Same signature scheme as broadcast-token.ts so the page can self-authorize. */
function broadcastSig(debateId: string): string {
  return createHmac('sha256', process.env.LIVEKIT_API_SECRET!).update(`broadcast:${debateId}`).digest('hex').slice(0, 32);
}

const httpUrl = (process.env.LIVEKIT_URL || '')
  .replace('wss://', 'https://').replace('ws://', 'http://');
const KEY = process.env.LIVEKIT_API_KEY!;
const SECRET = process.env.LIVEKIT_API_SECRET!;

const rooms  = new RoomServiceClient(httpUrl, KEY, SECRET);
const egress = new EgressClient(httpUrl, KEY, SECRET);

const PUBLISH = (canPublish: boolean) => ({ canPublish, canSubscribe: true, canPublishData: true });

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'method not allowed' });

  const user = await userFromToken(event.headers.authorization || event.headers.Authorization);
  if (!user) return json(401, { error: 'invalid session' });

  const { debateId, action, payload = {} } = safeBody(event.body);
  if (!debateId || !action) return json(400, { error: 'debateId and action required' });

  const { data: debate } = await supabaseAdmin
    .from('debates').select('id, host_id, livekit_room').eq('id', debateId).single();
  if (!debate) return json(404, { error: 'debate not found' });
  if (debate.host_id !== user.id) return json(403, { error: 'host only' });

  const room = debate.livekit_room as string;

  try {
    switch (action) {
      // open/close a single mic — used as each segment begins/ends
      case 'set_publish':
        await rooms.updateParticipant(room, payload.identity, undefined, PUBLISH(!!payload.canPublish));
        return json(200, { ok: true });

      // failsafe: make sure no audience member is publishing
      case 'mute_audience': {
        const list = await rooms.listParticipants(room);
        await Promise.all(list.map(async (p) => {
          const md = parseMeta(p.metadata);
          if (md.role === 'audience' && p.permission?.canPublish) {
            await rooms.updateParticipant(room, p.identity, undefined, PUBLISH(false));
          }
        }));
        return json(200, { ok: true });
      }

      // start recording to MP4. LiveKit Cloud users can drop the S3 block and
      // use built-in egress storage instead.
      case 'recording_start': {
        const file = new EncodedFileOutput({
          fileType: EncodedFileType.MP4,
          filepath: `recordings/${room}-${Date.now()}.mp4`,
          output: { case: 's3', value: new S3Upload({
            accessKey: process.env.S3_ACCESS_KEY!,
            secret:    process.env.S3_SECRET!,
            bucket:    process.env.S3_BUCKET!,
            region:    process.env.S3_REGION!,
          }) },
        });
        const info = await egress.startRoomCompositeEgress(room, { file }, { layout: 'speaker-dark' });
        return json(200, { egressId: info.egressId });
      }

      // simulcast the room to YouTube Live via RTMP ingest.
      // Uses WEB egress pointed at our branded broadcast page, so YouTube
      // viewers see the full show (slides, name plates, audience) — not a
      // raw video grid. The page connects to the room with a hidden,
      // subscribe-only token minted here.
      case 'youtube_start': {
        let key = payload.streamKey as string | undefined;
        if (!key) {
          const { data } = await supabaseAdmin.from('debate_secrets')
            .select('youtube_stream_key').eq('debate_id', debateId).maybeSingle();
          key = data?.youtube_stream_key ?? undefined;
        }
        if (!key) return json(200, { skipped: true });   // no simulcast configured
        const rtmpUrl = /^rtmps?:\/\//i.test(key)
          ? key
          : `rtmp://a.rtmp.youtube.com/live2/${key}`;

        // Mint a hidden, subscribe-only token for the egress browser.
        const viewer = new AccessToken(KEY, SECRET, {
          identity: `egress-${debateId.slice(0, 8)}`,
          name: 'Broadcast',
          ttl: '6h',
        });
        viewer.addGrant({
          roomJoin: true, room,
          canSubscribe: true, canPublish: false, canPublishData: false,
          hidden: true,                  // don't appear in the participant list
        });
        const viewerToken = await viewer.toJwt();

        const broadcastUrl =
          `${SITE}/broadcast/${debateId}?t=${encodeURIComponent(viewerToken)}` +
          `&u=${encodeURIComponent(process.env.LIVEKIT_URL || '')}`;

        const stream = new StreamOutput({
          protocol: StreamProtocol.RTMP,
          urls: [rtmpUrl],
        });
        const info = await egress.startWebEgress(broadcastUrl, { stream });
        return json(200, { egressId: info.egressId });
      }

      case 'egress_stop':
        await egress.stopEgress(payload.egressId);
        return json(200, { ok: true });

      case 'remove':
        await rooms.removeParticipant(room, payload.identity);
        return json(200, { ok: true });

      default:
        return json(400, { error: `unknown action: ${action}` });
    }
  } catch (err: any) {
    return json(500, { error: err?.message ?? 'control failed' });
  }
};

function parseMeta(m?: string) { try { return JSON.parse(m || '{}'); } catch { return {}; } }
function safeBody(b?: string | null) { try { return JSON.parse(b || '{}'); } catch { return {}; } }
function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}
