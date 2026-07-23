// =====================================================================
// The Rostrum · netlify/functions/stripe-webhook.ts
// Point Stripe's webhook at /.netlify/functions/stripe-webhook. This is
// the ONLY place a payment is allowed to change state — the browser never
// touches it, and the signature check means nobody can call it directly
// and fake a payment.
//
// Everything here is direct-payment: tips and pay-per-view are direct
// charges on the creator's connected account, and Pro is a platform
// subscription. The retired D-Bucks ledger branches have been removed.
// =====================================================================
import type { Handler } from '@netlify/functions';
import Stripe from 'stripe';
import { supabaseAdmin } from '../../src/server/supabaseAdmin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Must match the application_fee_amount the checkout functions charge.
const PLATFORM_FEE_BPS = 2000;          // 20% platform fee
// Two Stripe endpoints point at this URL and each has its OWN signing secret:
//   · Account endpoint  → platform events (Rostrum Pro subscriptions)
//   · Connect endpoint  → connected-account events (tips + PPV are DIRECT
//     charges, so their checkout.session.completed fires on the creator's
//     account, not ours).
// Try each configured secret; only one will match a given event. Keeping both
// here means neither money flow can silently fail signature verification.
const webhookSecrets = [
  process.env.STRIPE_WEBHOOK_SECRET,
  process.env.STRIPE_WEBHOOK_SECRET_CONNECT,
].filter(Boolean) as string[];

/** Verify against every configured secret; throw only if none match. */
function verifyEvent(rawBody: string | Buffer, sig: string): Stripe.Event {
  if (webhookSecrets.length === 0) throw new Error('no webhook secret configured');
  let lastErr: any;
  for (const secret of webhookSecrets) {
    try { return stripe.webhooks.constructEvent(rawBody, sig, secret); }
    catch (err) { lastErr = err; }
  }
  throw lastErr;
}

export const handler: Handler = async (event) => {
  const sig = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
  if (!sig) return { statusCode: 400, body: 'missing signature' };

  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf8')
    : (event.body || '');

  let stripeEvent: Stripe.Event;
  try {
    stripeEvent = verifyEvent(rawBody, sig);
  } catch (err: any) {
    console.error('stripe-webhook signature verification failed:', err?.message);
    return { statusCode: 400, body: `webhook signature verification failed: ${err?.message}` };
  }

  try {
    if (stripeEvent.type === 'checkout.session.completed') {
      const session = stripeEvent.data.object as Stripe.Checkout.Session;
      const kind = session.metadata?.kind;

      if (kind === 'gift_direct') {
        await handleGiftDirect(session);
      } else if (kind === 'debate_entry') {
        await handleDebateEntry(session);
      } else if (kind === 'pro_subscription') {
        await handleProCheckout(session);
      } else {
        // Unrecognised kind. Log it rather than silently returning 200 — a
        // mislabelled checkout should be visible, not vanish.
        console.warn('stripe-webhook: unhandled checkout kind', { kind, session: session.id });
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

  // The paid-through date lives on the Subscription in older Stripe API
  // versions and on each Subscription Item in newer ones. The webhook
  // endpoint's API version decides which shape we receive, so read whichever
  // is present — otherwise a version bump silently zeroes out Pro access.
  const anySub = sub as any;
  const periodEnd: number | null =
    anySub.current_period_end ??
    anySub.items?.data?.[0]?.current_period_end ??
    null;

  const base = {
    pro_subscription_id: sub.id,
    stripe_customer_id: (sub.customer as string) ?? null,
  };

  // Fail LOUD, not silent. If the subscription is paying but we can't find the
  // renewal date, do NOT clear pro_until — revoking a paying member's access
  // because of a payload-shape change is the worst possible outcome. Keep the
  // existing access, record the ids, and shout in the logs.
  if (active && !periodEnd) {
    console.error(
      'stripe-webhook: active Pro subscription with no readable period end — ' +
      'check the webhook endpoint API version',
      { subscription: sub.id, status: sub.status, fields: Object.keys(anySub) },
    );
    await supabaseAdmin.from('profiles').update(base).eq('id', userId);
    return;
  }

  await supabaseAdmin.from('profiles').update({
    ...base,
    pro_until: active && periodEnd
      ? new Date(periodEnd * 1000).toISOString()
      : null,
  }).eq('id', userId);
}

/** Subscription fully ended — let Pro lapse immediately. */
async function lapseProSubscription(sub: Stripe.Subscription) {
  const userId = sub.metadata?.user_id;
  if (!userId) return;
  await supabaseAdmin.from('profiles')
    .update({ pro_until: null, pro_subscription_id: null }).eq('id', userId);
}

/** Direct-cash tip confirmed. The money already went straight to the creator's
 * connected account (we never hold it). We only log it for history/analytics
 * and notify the creator — no D-Bucks, no treasury, no liability. This event
 * arrives on the creator's connected account (Stripe Connect webhook). */
async function handleGiftDirect(session: Stripe.Checkout.Session) {
  const fromId = session.metadata?.from_id;
  const toId = session.metadata?.to_id;
  const debateId = session.metadata?.debate_id || null;
  const amountCents = Number(session.metadata?.amount_cents ?? session.amount_total ?? 0);
  if (!fromId || !toId || amountCents <= 0) return;

  // Idempotent: skip if we've already recorded this session.
  const { data: existing } = await supabaseAdmin.from('gifts')
    .select('id').eq('stripe_session_id', session.id).maybeSingle();
  if (existing) return;

  await supabaseAdmin.from('gifts').insert({
    debate_id: debateId, from_id: fromId, to_id: toId,
    kind: 'tip', amount_cents: amountCents, stripe_session_id: session.id,
  });

  // Record the creator's earning. `gifts` is the social record; `transactions`
  // is the money ledger my_earnings() sums for the Earnings screen. Writing
  // only to `gifts` is why earnings previously read $0.00 forever.
  await recordEarning({
    payerId: fromId, creatorId: toId, type: 'gift',
    amountCents, debateId, sessionId: session.id,
  });

  const { data: fromProfile } = await supabaseAdmin.from('profiles').select('display_name').eq('id', fromId).maybeSingle();
  const dollars = (amountCents / 100).toFixed(2);
  await supabaseAdmin.from('notifications').insert({
    user_id: toId, type: 'gift',
    title: `${fromProfile?.display_name ?? 'Someone'} tipped you $${dollars}`,
    body: 'A direct tip was paid into your connected Stripe account.',
    link: debateId ? `/debate/${debateId}` : '/me',
  });
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

  // The host is the merchant of record on a PPV direct charge, so they are
  // the counterparty who earned it.
  const { data: debate } = await supabaseAdmin.from('debates')
    .select('host_id, price_cents').eq('id', debateId).maybeSingle();
  if (debate?.host_id && debate.price_cents) {
    await recordEarning({
      payerId: userId, creatorId: debate.host_id, type: 'entry',
      amountCents: debate.price_cents, debateId, sessionId: session.id,
    });
  }
}

/** Write one row to the `transactions` ledger. Idempotent via the unique
 *  index on stripe_session_id, so a Stripe redelivery is a no-op rather
 *  than a double-count. Never throws the webhook into a retry loop over a
 *  duplicate — the payment itself already succeeded. */
async function recordEarning(o: {
  payerId: string; creatorId: string; type: 'gift' | 'entry';
  amountCents: number; debateId: string | null; sessionId: string;
}) {
  const feeCents = Math.round(o.amountCents * PLATFORM_FEE_BPS / 10000);
  const { error } = await supabaseAdmin.from('transactions').insert({
    user_id: o.payerId,
    counterparty_id: o.creatorId,
    type: o.type,
    amount_cents: o.amountCents,
    fee_cents: feeCents,
    debate_id: o.debateId,
    stripe_session_id: o.sessionId,
    status: 'succeeded',
    currency: 'usd',
  });
  if (error && !/duplicate key|unique/i.test(error.message ?? '')) {
    console.error('stripe-webhook: could not record earning', error.message, o);
  }
}
