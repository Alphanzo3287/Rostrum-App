// =====================================================================
// The Rostrum · netlify/functions/stripe-pro-subscribe.ts
// Starts a Stripe Checkout Session (subscription mode) for Rostrum Pro.
// The client only sends a plan id ('monthly' | 'annual'), never an
// amount — the server maps that to a STORED Stripe Price. Activation
// happens in stripe-webhook.ts on the subscription events, never from
// the browser.
//
// These are real Price objects under product "Rostrum Pro"
// (prod_UwJo0HotlkxB4n), not inline price_data. That is what lets the
// Customer Billing Portal offer monthly <-> annual switching, and what
// makes Stripe report revenue broken down by plan. To change what a
// plan costs, create a NEW Price in Stripe and repoint the env var —
// never edit a Price that existing subscribers are already on.
// =====================================================================
import type { Handler } from '@netlify/functions';
import Stripe from 'stripe';
import { supabaseAdmin, userFromToken } from '../../src/server/supabaseAdmin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const SITE = process.env.PUBLIC_SITE_URL || 'https://rostrums.site';

// Plan id -> stored Stripe Price. Env vars win so the same code can run
// against test-mode prices; the literals are the live-mode defaults.
export const PRO_PLANS = {
  monthly: {
    price_id: process.env.STRIPE_PRICE_PRO_MONTHLY || 'price_1TwRB8LQOp6Yo5xcCUPUfV20',
    label: 'Rostrum Pro · Monthly',
  },
  annual: {
    price_id: process.env.STRIPE_PRICE_PRO_ANNUAL || 'price_1TwRBCLQOp6Yo5xcLTsaLZQR',
    label: 'Rostrum Pro · Annual',
  },
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
      line_items: [{ price: plan.price_id, quantity: 1 }],
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
    // Log the real Stripe error; never return it. Raw messages have
    // included masked-but-partial API keys and internal account ids.
    const detail = err?.raw?.message ?? err?.message ?? 'stripe checkout failed';
    const msg = 'Could not start checkout. Please try again.';
    console.error('stripe-pro-subscribe error:', detail, err?.raw ?? err);
    return json(500, { error: msg });
  }
};

function safeBody(raw: string | null): any {
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}
