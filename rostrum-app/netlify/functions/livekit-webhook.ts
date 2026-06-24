// =====================================================================
// The Rostrum · netlify/functions/livekit-webhook.ts
// Point your LiveKit project's webhook at /.netlify/functions/livekit-webhook
// - egress_ended      -> save the MP4 location to debates.recording_url
//                        (this is what powers "Download MP4" on the Results screen)
// - participant_joined/left -> keep debates.viewer_count fresh
// =====================================================================
import type { Handler } from '@netlify/functions';
import { WebhookReceiver } from 'livekit-server-sdk';
import { supabaseAdmin } from '../../src/server/supabaseAdmin';

const receiver = new WebhookReceiver(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!);

export const handler: Handler = async (event) => {
  let e;
  try {
    e = await receiver.receive(event.body || '', event.headers.authorization || event.headers.Authorization);
  } catch {
    return { statusCode: 401, body: 'bad signature' };
  }

  if (e.event === 'egress_ended') {
    const loc = e.egressInfo?.fileResults?.[0]?.location ?? e.egressInfo?.file?.location;
    const room = e.egressInfo?.roomName;
    if (loc && room) {
      await supabaseAdmin.from('debates')
        .update({ recording_url: loc }).eq('livekit_room', room);
    }
  }

  if (e.event === 'participant_joined' || e.event === 'participant_left') {
    const room = e.room?.name;
    const count = e.room?.numParticipants;
    if (room && count != null) {
      await supabaseAdmin.from('debates')
        .update({ viewer_count: count }).eq('livekit_room', room);
    }
  }

  return { statusCode: 200, body: 'ok' };
};
