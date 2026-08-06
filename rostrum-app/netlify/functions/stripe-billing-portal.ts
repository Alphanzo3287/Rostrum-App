// =====================================================================
// The Rostrum · netlify/functions/stripe-billing-portal.ts
// Opens a Stripe Customer Billing Portal session so a Pro member can
// update their card, view invoices, and cancel — all hosted by Stripe.
// We just hand back the URL; Stripe handles the rest, and the resulting
// subscription changes flow back through stripe-webhook.ts.
// =====================================================================
import type { Handler } from '@netlify/functions';
import Stripe from 'stripe';
import { supabaseAdmin, userFromToken } from '../../src/server/supabaseAdmin';

// Managed Payments (enabled on this account) requires API version
// 2025-03-31.basil+; the SDK's pinned default (2025-02-24.acacia) is
// rejected. Pin explicitly rather than upgrading the SDK.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-03-31.basil' as any });
const SITE = process.env.PUBLIC_SITE_URL || 'https://rostrums.site';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'method not allowed' });

  const user = await userFromToken(event.headers.authorization || event.headers.Authorization);
  if (!user) return json(401, { error: 'invalid session' });

  const { data: me } = await supabaseAdmin.from('profiles')
    .select('stripe_customer_id').eq('id', user.id).maybeSingle();
  if (!me?.stripe_customer_id) {
    return json(400, { error: "No billing account found — you don't have an active membership to manage." });
  }

  // Same self-heal as stripe-pro-subscribe: a customer id carried over
  // from a previous Stripe account makes billingPortal.sessions.create
  // throw "No such customer". Verify first; if dead, clear it and tell
  // the user the truth instead of "try again".
  try {
    const c = await stripe.customers.retrieve(me.stripe_customer_id);
    if ((c as any).deleted) throw new Error('deleted');
  } catch {
    console.warn('stripe-billing-portal: clearing stale customer id', { userId: user.id, customerId: me.stripe_customer_id });
    await supabaseAdmin.from('profiles').update({ stripe_customer_id: null }).eq('id', user.id);
    return json(400, { error: 'Your billing account was reset. If you have Rostrum Pro, please subscribe again — contact support if this seems wrong.' });
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: me.stripe_customer_id,
      return_url: `${SITE}/pro`,
    });
    return json(200, { url: session.url });
  } catch (err: any) {
    // Log the real Stripe error; never return it. Raw messages have
    // included masked-but-partial API keys and internal account ids.
    const detail = err?.raw?.message ?? err?.message ?? 'could not open billing portal';
    const msg = 'Could not open the billing portal. Please try again.';
    console.error('stripe-billing-portal error:', detail, err?.raw ?? err);
    return json(500, { error: msg });
  }
};

function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}
