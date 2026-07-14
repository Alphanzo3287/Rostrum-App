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

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
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

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: me.stripe_customer_id,
      return_url: `${SITE}/pro`,
    });
    return json(200, { url: session.url });
  } catch (err: any) {
    const msg = err?.raw?.message ?? err?.message ?? 'could not open billing portal';
    console.error('stripe-billing-portal error:', msg, err?.raw ?? err);
    return json(500, { error: msg });
  }
};

function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}
