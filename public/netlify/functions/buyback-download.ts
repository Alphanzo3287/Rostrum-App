// =====================================================================
// The Rostrum · netlify/functions/buyback-download.ts
// The creator-products bucket is private with no public read policy —
// this is the ONLY way to get a working link to a listing's file, and it
// only hands one out to the buyer who actually paid (or the creator who
// uploaded it). The signed URL is freshly generated each call and
// expires quickly, rather than a long-lived link that could leak.
// =====================================================================
import type { Handler } from '@netlify/functions';
import { supabaseAdmin, userFromToken } from '../../src/server/supabaseAdmin';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'method not allowed' });

  const user = await userFromToken(event.headers.authorization || event.headers.Authorization);
  if (!user) return json(401, { error: 'invalid session' });

  const body = safeBody(event.body);
  const listingId = body.listingId as string;
  if (!listingId) return json(400, { error: 'listingId required' });

  const { data: listing } = await supabaseAdmin
    .from('buyback_listings')
    .select('creator_id, buyer_id, status, product_file_path')
    .eq('id', listingId).maybeSingle();
  if (!listing) return json(404, { error: 'listing not found' });

  const isCreator = listing.creator_id === user.id;
  const isBuyer = listing.status === 'sold' && listing.buyer_id === user.id;
  if (!isCreator && !isBuyer) return json(403, { error: 'not authorized for this listing' });

  const { data, error } = await supabaseAdmin.storage
    .from('creator-products').createSignedUrl(listing.product_file_path, 300); // 5 minutes
  if (error || !data) return json(500, { error: error?.message ?? 'could not generate download link' });

  return json(200, { url: data.signedUrl });
};

function safeBody(raw: string | null): any {
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}
