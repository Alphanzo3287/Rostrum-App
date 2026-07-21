// =====================================================================
// The Rostrum · netlify/functions/replay.ts
// Replay access + management. The R2 recordings bucket is PRIVATE, so
// playback/download use short-lived presigned URLs, gated by visibility:
//   - host: always allowed
//   - others: only when the debate's recording_visibility = 'public'
// Host-only management: set visibility (public/private) and delete
// (removes the R2 object AND clears recording_url — irreversible).
// =====================================================================
import type { Handler } from '@netlify/functions';
import { S3Client, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { supabaseAdmin, userFromToken } from '../../src/server/supabaseAdmin';

const BUCKET = process.env.S3_BUCKET || 'recordings';
const s3 = new S3Client({
  region: process.env.S3_REGION || 'auto',
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET!,
  },
});

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

/** The webhook stores the egress "location" — may be a full URL or a path.
 *  Reduce it to the object key inside the bucket. */
function objectKey(location: string): string {
  let s = location;
  try { const u = new URL(location); s = u.pathname; } catch { /* not a URL */ }
  s = s.replace(/^\/+/, '');
  if (s.startsWith(`${BUCKET}/`)) s = s.slice(BUCKET.length + 1);
  return s;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });

  const user = await userFromToken(event.headers.authorization || event.headers.Authorization);
  if (!user) return json(401, { error: 'sign in required' });

  let body: any = {};
  try { body = JSON.parse(event.body || '{}'); } catch { /* noop */ }
  const { action, debateId } = body as { action?: string; debateId?: string };
  if (!action || !debateId) return json(400, { error: 'action and debateId required' });

  const { data: debate } = await supabaseAdmin.from('debates')
    .select('id, host_id, title:motion, recording_url, recording_visibility, created_at, host:profiles!debates_host_id_fkey(pro_until)')
    .eq('id', debateId).maybeSingle();
  if (!debate) return json(404, { error: 'debate not found' });

  const isHost = debate.host_id === user.id;

  // Replay retention: free hosts keep replays for 7 days; Rostrum Pro keeps
  // them forever. Computed from the HOST's Pro status (not the viewer's).
  const RETENTION_DAYS = 7;
  const hostPro = !!(debate as any).host?.pro_until && new Date((debate as any).host.pro_until) > new Date();
  const ageMs = Date.now() - new Date(debate.created_at as string).getTime();
  const expired = !hostPro && ageMs > RETENTION_DAYS * 24 * 60 * 60 * 1000;

  switch (action) {
    // Short-lived presigned URLs for the player + a download variant that
    // triggers a file save with a friendly name.
    case 'play': {
      if (!debate.recording_url) return json(404, { error: 'no recording for this debate' });
      if (expired) {
        return json(403, { error: isHost
          ? 'This replay expired after 7 days on the free plan. Upgrade to Rostrum Pro to keep your replays forever.'
          : 'This replay is no longer available.' });
      }
      if (!isHost && debate.recording_visibility !== 'public') {
        return json(403, { error: 'this replay is private' });
      }
      const key = objectKey(debate.recording_url);
      const safeName = `${(debate.title || 'rostrum-replay').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-')}.mp4`;
      const playUrl = await getSignedUrl(s3,
        new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: 3600 });
      const downloadUrl = await getSignedUrl(s3,
        new GetObjectCommand({ Bucket: BUCKET, Key: key,
          ResponseContentDisposition: `attachment; filename="${safeName}"` }), { expiresIn: 3600 });
      return json(200, { playUrl, downloadUrl, visibility: debate.recording_visibility, title: debate.title });
    }

    case 'set_visibility': {
      if (!isHost) return json(403, { error: 'only the host can change visibility' });
      const vis = body.visibility === 'public' ? 'public' : 'private';
      await supabaseAdmin.from('debates').update({ recording_visibility: vis }).eq('id', debateId);
      return json(200, { ok: true, visibility: vis });
    }

    case 'delete': {
      if (!isHost) return json(403, { error: 'only the host can delete a replay' });
      if (debate.recording_url) {
        try {
          await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: objectKey(debate.recording_url) }));
        } catch { /* object may already be gone — still clear the link */ }
      }
      await supabaseAdmin.from('debates')
        .update({ recording_url: null, recording_visibility: 'private' }).eq('id', debateId);
      return json(200, { ok: true });
    }

    default:
      return json(400, { error: `unknown action: ${action}` });
  }
};
