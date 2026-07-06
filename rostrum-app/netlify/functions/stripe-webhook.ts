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
      } else if (kind === 'gift_purchase') {
        await handleGiftPurchase(session);
      } else if (kind === 'debate_entry') {
        await handleDebateEntry(session);
      } else if (kind === 'pro_subscription') {
        await handleProCheckout(session);
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

    // ── Rostrum Pro subscription lifecycle ──────────────────────────────
    // Renewals, upgrades, cancellations and lapses all arrive as
    // customer.subscription.* events (not checkout.session.completed), so we
    // keep pro_until in sync from the authoritative subscription object.
    if (stripeEvent.type === 'customer.subscription.updated' ||
        stripeEvent.type === 'customer.subscription.created') {
      await syncProSubscription(stripeEvent.data.object as Stripe.Subscription);
    }
    if (stripeEvent.type === 'customer.subscription.deleted') {
      await lapseProSubscription(stripeEvent.data.object as Stripe.Subscription);
    }

    return { statusCode: 200, body: 'ok' };
  } catch (err: any) {
    console.error('stripe-webhook processing error:', err?.message ?? err);
    // Return 500 so Stripe retries — nothing was credited if we got here.
    return { statusCode: 500, body: 'processing error' };
  }
};

/** First payment for Pro confirmed. Store the Stripe customer + subscription
 * ids on the profile so the customer.subscription.* events (and the future
 * billing portal) can find the user. pro_until itself is set authoritatively
 * by syncProSubscription from the subscription's current_period_end. */
async function handleProCheckout(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.user_id;
  if (!userId) return;
  await supabaseAdmin.from('profiles').update({
    stripe_customer_id: (session.customer as string) ?? null,
    pro_subscription_id: (session.subscription as string) ?? null,
  }).eq('id', userId);
  // The subscription.created event usually arrives around the same time and
  // sets pro_until; but retrieve-and-set here too so access is instant.
  if (session.subscription) {
    const sub = await stripe.subscriptions.retrieve(session.subscription as string);
    await syncProSubscription(sub);
  }
}

/** Set pro_until from the subscription's paid-through date when it's active
 * (or trialing); clear it if the subscription is in a non-paying state. */
async function syncProSubscription(sub: Stripe.Subscription) {
  const userId = sub.metadata?.user_id;
  if (sub.metadata?.kind !== 'pro_subscription' || !userId) return;

  const active = sub.status === 'active' || sub.status === 'trialing';
  const proUntil = active && sub.current_period_end
    ? new Date(sub.current_period_end * 1000).toISOString()
    : null;

  await supabaseAdmin.from('profiles').update({
    pro_until: proUntil,
    pro_subscription_id: sub.id,
    stripe_customer_id: (sub.customer as string) ?? null,
  }).eq('id', userId);
}

/** Subscription fully ended — let Pro lapse immediately. */
async function lapseProSubscription(sub: Stripe.Subscription) {
  const userId = sub.metadata?.user_id;
  if (!userId) return;
  await supabaseAdmin.from('profiles')
    .update({ pro_until: null, pro_subscription_id: null }).eq('id', userId);
}

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

/** Buy-and-send gift: credit the recipient's redeemable D-Bucks directly
 * from treasury (no wallet hop for the buyer needed) and log it exactly
 * like a normal in-app gift so it shows up the same way everywhere. */
async function handleGiftPurchase(session: Stripe.Checkout.Session) {
  const tierId = session.metadata?.tier_id;
  const fromId = session.metadata?.from_id;
  const toId = session.metadata?.to_id;
  const dbucksAmount = Number(session.metadata?.dbucks_amount ?? 0);
  const debateId = session.metadata?.debate_id || null;
  if (!tierId || !fromId || !toId || dbucksAmount <= 0) return;

  const { error } = await supabaseAdmin.rpc('dbucks_move', {
    p_from: 'treasury',
    p_to: `user:${toId}`,
    p_amount: dbucksAmount,
    p_color: 'redeemable',
    p_reason: 'gift',
    p_ref: { stripe_session_id: session.id, tier_id: tierId, debate_id: debateId },
    p_idem: `stripe_gift:${session.id}`,
  });
  if (error && !/duplicate key|idempotency/i.test(error.message ?? '')) throw error;

  if (!error) {
    const { data: tier } = await supabaseAdmin.from('gift_tiers').select('name, amount_cents').eq('id', tierId).maybeSingle();
    await supabaseAdmin.from('gifts').insert({
      debate_id: debateId, from_id: fromId, to_id: toId,
      kind: tier?.name ?? tierId, amount_cents: tier?.amount_cents ?? 0,
    });
    const { data: fromProfile } = await supabaseAdmin.from('profiles').select('display_name').eq('id', fromId).maybeSingle();
    await supabaseAdmin.from('notifications').insert({
      user_id: toId, type: 'gift',
      title: `${fromProfile?.display_name ?? 'Someone'} sent you a gift`,
      body: `${tier?.name ?? 'A gift'} · ${dbucksAmount} D-Bucks`,
      link: debateId ? `/debate/${debateId}` : '/store',
    });
  }
}

/** PPV debate entry confirmed — grant access by marking (or creating)
 * the participant row as paid. Money already went straight to the host
 * via the destination charge; nothing else to move here. Update-first,
 * insert-only-if-absent, so this never resets someone who was already
 * seated (e.g. a debater) back down to plain audience. */
async function handleDebateEntry(session: Stripe.Checkout.Session) {
  const debateId = session.metadata?.debate_id;
  const userId = session.metadata?.user_id;
  if (!debateId || !userId) return;

  const { data: updated } = await supabaseAdmin.from('debate_participants')
    .update({ paid: true }).eq('debate_id', debateId).eq('user_id', userId).select('user_id');
  if (!updated || updated.length === 0) {
    await supabaseAdmin.from('debate_participants')
      .insert({ debate_id: debateId, user_id: userId, role: 'audience', can_publish: false, paid: true });
  }
}
