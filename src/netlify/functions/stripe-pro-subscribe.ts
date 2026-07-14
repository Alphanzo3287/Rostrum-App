// =====================================================================
// The Rostrum · netlify/functions/stripe-pro-subscribe.ts
// Starts a Stripe Checkout Session (subscription mode) for Rostrum Pro.
// Price is decided HERE, server-side — the client only sends a plan id
// ('monthly' | 'annual'), never an amount. Activation happens in
// stripe-webhook.ts on the subscription events, never from the browser.
// =====================================================================
import type { Handler } from '@netlify/functions';
import Stripe from 'stripe';
import { supabaseAdmin, userFromToken } from '../../src/server/supabaseAdmin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const SITE = process.env.PUBLIC_SITE_URL || 'https://rostrums.site';

// Pricing lives here so it can never be tampered with from the client.
// Adjust these freely — they're the single source of truth for Pro pricing.
export const PRO_PLANS = {
  monthly: { price_cents: 1500,  interval: 'month' as const, interval_count: 1, label: 'Rostrum Pro · Monthly' },
  annual:  { price_cents: 15000, interval: 'year'  as const, interval_count: 1, label: 'Rostrum Pro · Annual' },
} as const;
export type ProPlanId = keyof typeof PRO_PLANS;

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'method not allowed' });

  const user = await userFromToken(event.headers.authorization || event.headers.Authorization);
  if (!user) return json(401, { error: 'invalid session' });

  const body = safeBody(event.body);
  const planId = (body.plan as ProPlanId) ?? 'monthly';
  const plan = PRO_PLANS[planId];
  if (!plan) return json(400, { error: 'unknown plan' });

  // Already Pro? Don't let them double-subscribe.
  const { data: me } = await supabaseAdmin.from('profiles')
    .select('pro_until, stripe_customer_id').eq('id', user.id).maybeSingle();
  if (me?.pro_until && new Date(me.pro_until) > new Date()) {
    return json(400, { error: 'You already have Rostrum Pro.' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: me?.stripe_customer_id || undefined,
      customer_email: me?.stripe_customer_id ? undefined : (user.email ?? undefined),
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: plan.label, description: 'Rostrum Pro membership' },
          unit_amount: plan.price_cents,
          recurring: { interval: plan.interval, interval_count: plan.interval_count },
        },
        quantity: 1,
      }],
      // Metadata on the SUBSCRIPTION itself so lifecycle events (renew,
      // cancel) can always resolve back to the user.
      subscription_data: { metadata: { kind: 'pro_subscription', user_id: user.id } },
      metadata: { kind: 'pro_subscription', user_id: user.id, plan: planId },
      success_url: `${SITE}/pro?upgrade=success`,
      cancel_url: `${SITE}/pro?upgrade=cancelled`,
      allow_promotion_codes: true,
    });
    return json(200, { url: session.url });
  } catch (err: any) {
    const msg = err?.raw?.message ?? err?.message ?? 'stripe checkout failed';
    console.error('stripe-pro-subscribe error:', msg, err?.raw ?? err);
    return json(500, { error: msg });
  }
};

function safeBody(raw: string | null): any {
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}
