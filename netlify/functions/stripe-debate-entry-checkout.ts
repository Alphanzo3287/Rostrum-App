// =====================================================================
// The Rostrum · netlify/functions/stripe-debate-entry-checkout.ts
// Pay-per-view entry for a paid debate. DIRECT charge on the host's
// connected account: the host is the merchant of record and receives the
// money straight away (the platform never holds it), the host bears
// Stripe's processing fee, and the platform keeps a clean 20% via
// application_fee_amount. Access is granted by stripe-webhook setting
// debate_participants.paid = true once payment clears (arrives as a
// Stripe Connect / connected-account event).
// =====================================================================
import type { Handler } from '@netlify/functions';
import Stripe from 'stripe';
import { supabaseAdmin, userFromToken } from '../../src/server/supabaseAdmin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const SITE = process.env.PUBLIC_SITE_URL || 'https://rostrums.site';
const PLATFORM_FEE_BPS = 2000; // 20%

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'method not allowed' });

  const user = await userFromToken(event.headers.authorization || event.headers.Authorization);
  if (!user) return json(401, { error: 'invalid session' });

  const body = safeBody(event.body);
  const debateId = body.debateId as string;
  if (!debateId) return json(400, { error: 'debateId required' });

  try {
    const { data: debate } = await supabaseAdmin
      .from('debates').select('id, host_id, motion, is_paid, price_cents, format')
      .eq('id', debateId).maybeSingle();
    if (!debate) return json(404, { error: 'debate not found' });
    if (!debate.is_paid || !debate.price_cents) return json(400, { error: 'this debate is free — no payment needed' });
    if (debate.host_id === user.id) return json(400, { error: "you're the host — you already have access" });

    const { data: account } = await supabaseAdmin
      .from('creator_accounts').select('stripe_account_id, charges_enabled')
      .eq('user_id', debate.host_id).maybeSingle();
    if (!account?.stripe_account_id || !account.charges_enabled) {
      return json(400, { error: "this host's payout account isn't ready to accept payments yet" });
    }

    const applicationFee = Math.round(debate.price_cents * PLATFORM_FEE_BPS / 10000);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: user.email ?? undefined,
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: debate.motion, description: 'The Rostrum — pay-per-view entry' },
          unit_amount: debate.price_cents,
        },
        quantity: 1,
      }],
      payment_intent_data: {
        application_fee_amount: applicationFee,
      },
      metadata: { kind: 'debate_entry', debate_id: debate.id, user_id: user.id },
      success_url: `${SITE}/debate/${debate.id}?entry=success`,
      cancel_url: `${SITE}/debate/${debate.id}?entry=cancelled`,
    }, { stripeAccount: account.stripe_account_id });
    return json(200, { url: session.url });
  } catch (err: any) {
    const msg = err?.raw?.message ?? err?.message ?? 'entry checkout failed';
    console.error('stripe-debate-entry-checkout error:', msg, err?.raw ?? err);
    return json(500, { error: msg });
  }
};

function safeBody(raw: string | null): any {
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}
