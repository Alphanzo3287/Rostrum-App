// =====================================================================
// The Rostrum · netlify/functions/stripe-webhook.ts
// Point Stripe's webhook at /.netlify/functions/stripe-webhook, listening
// for checkout.session.completed. This is the ONLY place D-Bucks get
// credited for a real-money purchase — the browser never touches this,
// and the signature check means nobody can call it directly and fake a
// payment. Idempotent: dbucks_move() has a unique constraint on the
// idempotency key, so even if Stripe retries delivery (it does, by
// design), the same event can never be credited twice.
// =====================================================================
import type { Handler } from '@netlify/functions';
import Stripe from 'stripe';
import { supabaseAdmin } from '../../src/server/supabaseAdmin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export const handler: Handler = async (event) => {
  const sig = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
  if (!sig) return { statusCode: 400, body: 'missing signature' };

  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf8')
    : (event.body || '');

  let stripeEvent: Stripe.Event;
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    console.error('stripe-webhook signature verification failed:', err?.message);
    return { statusCode: 400, body: `webhook signature verification failed: ${err?.message}` };
  }

  try {
    if (stripeEvent.type === 'checkout.session.completed') {
      const session = stripeEvent.data.object as Stripe.Checkout.Session;
      const kind = session.metadata?.kind;

      if (kind === 'buyback_purchase') {
        await handleBuybackPurchase(session);
      } else {
        // dbucks_purchase — the original Phase 3 flow.
        const userId = session.metadata?.user_id;
        const dbucksAmount = Number(session.metadata?.dbucks_amount ?? 0);

        if (userId && dbucksAmount > 0) {
          const { error } = await supabaseAdmin.rpc('dbucks_move', {
            p_from: 'treasury',
            p_to: `user:${userId}`,
            p_amount: dbucksAmount,
            p_color: 'redeemable',
            p_reason: 'purchase',
            p_ref: { stripe_session_id: session.id, package_id: session.metadata?.package_id ?? null },
            p_idem: `stripe_checkout:${session.id}`,
          });
          // A unique-constraint violation here means this exact event was
          // already processed (Stripe redelivered it) — that's success,
          // not a real error, so we don't want to trigger a Stripe retry.
          if (error && !/duplicate key|idempotency/i.test(error.message ?? '')) throw error;
        }
      }
    }
    return { statusCode: 200, body: 'ok' };
  } catch (err: any) {
    console.error('stripe-webhook processing error:', err?.message ?? err);
    // Return 500 so Stripe retries — nothing was credited if we got here.
    return { statusCode: 500, body: 'processing error' };
  }
};

/** Phase 4: payment for a creator's buyback listing confirmed. Retire the
 * D-Bucks from the creator's wallet back to treasury, and mark the
 * listing sold. Money already moved directly to the creator's connected
 * account via the destination charge — nothing to do on that side here. */
async function handleBuybackPurchase(session: Stripe.Checkout.Session) {
  const listingId = session.metadata?.listing_id;
  const creatorId = session.metadata?.creator_id;
  const buyerId = session.metadata?.buyer_id;
  const dbucksAmount = Number(session.metadata?.dbucks_amount ?? 0);
  if (!listingId || !creatorId || !buyerId || dbucksAmount <= 0) return;

  const { error } = await supabaseAdmin.rpc('dbucks_move', {
    p_from: `user:${creatorId}`,
    p_to: 'treasury',
    p_amount: dbucksAmount,
    p_color: 'redeemable',
    p_reason: 'buyback',
    p_ref: { stripe_session_id: session.id, listing_id: listingId, buyer_id: buyerId },
    p_idem: `stripe_buyback:${session.id}`,
  });
  if (error && !/duplicate key|idempotency/i.test(error.message ?? '')) throw error;

  // Only mark the listing sold on the FIRST successful processing of this
  // event (dbucks_move is idempotent and no-ops on retries, but this
  // update isn't — guard it the same way rather than double-write).
  if (!error) {
    await supabaseAdmin.from('buyback_listings')
      .update({ status: 'sold', buyer_id: buyerId, stripe_session_id: session.id, sold_at: new Date().toISOString() })
      .eq('id', listingId).eq('status', 'active');
  }
}
