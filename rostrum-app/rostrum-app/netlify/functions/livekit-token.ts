// =====================================================================
// The Rostrum · netlify/functions/livekit-token.ts
// Mints a LiveKit access token whose media grants come from the caller's
// debate_participants row. THIS is where "audience can't take the mic" is
// enforced — canPublish mirrors can_publish from the database.
// =====================================================================
import type { Handler } from '@netlify/functions';
import { AccessToken } from 'livekit-server-sdk';
import { supabaseAdmin, userFromToken } from '../../src/server/supabaseAdmin';

const LIVEKIT_URL = process.env.LIVEKIT_URL!;       // wss://...
const API_KEY     = process.env.LIVEKIT_API_KEY!;
const API_SECRET  = process.env.LIVEKIT_API_SECRET!;

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'method not allowed' });

  const user = await userFromToken(event.headers.authorization || event.headers.Authorization);
  if (!user) return json(401, { error: 'invalid session' });

  const { debateId } = safeBody(event.body);
  if (!debateId) return json(400, { error: 'debateId required' });

  const { data: debate } = await supabaseAdmin
    .from('debates').select('id, livekit_room, host_id').eq('id', debateId).single();
  if (!debate) return json(404, { error: 'debate not found' });

  // Look up the caller's seat. Spectators who haven't formally joined get an
  // audience seat (no publish) so they can still watch.
  let { data: part } = await supabaseAdmin
    .from('debate_participants').select('role, side, can_publish')
    .eq('debate_id', debateId).eq('user_id', user.id).maybeSingle();
  if (!part) {
    await supabaseAdmin.from('debate_participants')
      .upsert({ debate_id: debateId, user_id: user.id, role: 'audience', can_publish: false });
    part = { role: 'audience', side: null, can_publish: false };
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles').select('display_name, avatar_url, handle').eq('id', user.id).single();

  const room = debate.livekit_room || `debate_${debate.id}`;
  const isHost = debate.host_id === user.id;

  const at = new AccessToken(API_KEY, API_SECRET, {
    identity: user.id,
    name: profile?.display_name ?? 'Guest',
    metadata: JSON.stringify({ role: part.role, side: part.side, avatar: profile?.avatar_url ?? null, handle: profile?.handle ?? null }),
    ttl: '3h',
  });
  at.addGrant({
    roomJoin: true,
    room,
    canSubscribe: true,                 // everyone can watch/listen
    canPublish: !!part.can_publish,     // audience = false (house rule)
    canPublishData: true,               // raise-hand / reactions over data channel
    roomAdmin: isHost,                  // host can mute others + manage the room
  });

  return json(200, {
    url: LIVEKIT_URL,
    token: await at.toJwt(),
    room,
    role: part.role,
    canPublish: !!part.can_publish,
  });
};

function safeBody(b?: string | null) { try { return JSON.parse(b || '{}'); } catch { return {}; } }
function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}
