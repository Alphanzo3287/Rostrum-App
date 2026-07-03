// =====================================================================
// The Rostrum · netlify/functions/stripe-buyback-checkout.ts
// A supporter buys a creator's buyback listing. One Stripe charge, split
// automatically: 85% goes straight to the creator's connected account,
// 15% stays with the platform as an application fee — money lands with
// the creator immediately, no separate manual payout step. The D-Bucks
// only retire from the creator's wallet once stripe-webhook confirms the
// payment actually went through.
// =====================================================================
import type { Handler } from '@netlify/functions';
import Stripe from 'stripe';
import { supabaseAdmin, userFromToken } from '../../src/server/supabaseAdmin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const SITE = process.env.PUBLIC_SITE_URL || 'https://rostrums.site';
const PLATFORM_FEE_BPS = 1500; // 15%, matches platform_config.platform_fee_bps elsewhere

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'method not allowed' });

  const user = await userFromToken(event.headers.authorization || event.headers.Authorization);
  if (!user) return json(401, { error: 'invalid session' });

  const body = safeBody(event.body);
  const listingId = body.listingId as string;
  if (!listingId) return json(400, { error: 'listingId required' });

  try {
    const { data: listing } = await supabaseAdmin
      .from('buyback_listings')
      .select('id, creator_id, dbucks_amount, price_cents, product_name, status')
      .eq('id', listingId).maybeSingle();
    if (!listing) return json(404, { error: 'listing not found' });
    if (listing.status !== 'active') return json(400, { error: 'this listing is no longer available' });
    if (listing.creator_id === user.id) return json(400, { error: "you can't buy your own listing" });

    const { data: account } = await supabaseAdmin
      .from('creator_accounts').select('stripe_account_id, charges_enabled')
      .eq('user_id', listing.creator_id).maybeSingle();
    if (!account?.stripe_account_id || !account.charges_enabled) {
      return json(400, { error: "this creator's payout account isn't ready to receive payments yet" });
    }

    const applicationFee = Math.round(listing.price_cents * PLATFORM_FEE_BPS / 10000);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: user.email ?? undefined,
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: listing.product_name, description: 'The Rostrum — creator buy-back' },
          unit_amount: listing.price_cents,
        },
        quantity: 1,
      }],
      payment_intent_data: {
        application_fee_amount: applicationFee,
        transfer_data: { destination: account.stripe_account_id },
      },
      metadata: {
        kind: 'buyback_purchase',
        listing_id: listing.id,
        creator_id: listing.creator_id,
        buyer_id: user.id,
        dbucks_amount: String(listing.dbucks_amount),
      },
      success_url: `${SITE}/store?buyback=success&listing=${listing.id}`,
      cancel_url: `${SITE}/store?buyback=cancelled`,
    });
    return json(200, { url: session.url });
  } catch (err: any) {
    const msg = err?.raw?.message ?? err?.message ?? 'buyback checkout failed';
    console.error('stripe-buyback-checkout error:', msg, err?.raw ?? err);
    return json(500, { error: msg });
  }
};

function safeBody(raw: string | null): any {
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}
