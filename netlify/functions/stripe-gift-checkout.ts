// =====================================================================
// The Rostrum · netlify/functions/stripe-gift-checkout.ts
// Direct-cash tip to a creator (the "Patreon" model). ONE real-money
// charge, created DIRECTLY on the creator's connected account, so:
//   · the creator is the merchant of record and receives the money
//     straight away (the platform never holds it — no liability),
//   · the creator bears Stripe's processing fee (~2.9% + 30¢),
//   · the platform keeps a clean 20% via application_fee_amount.
// No D-Bucks are involved — this replaces the old buy-D-Bucks-then-gift
// flow entirely. Amount is validated server-side, never trusted raw.
// =====================================================================
import type { Handler } from '@netlify/functions';
import Stripe from 'stripe';
import { supabaseAdmin, userFromToken } from '../../src/server/supabaseAdmin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const SITE = process.env.PUBLIC_SITE_URL || 'https://rostrums.site';
const PLATFORM_FEE_BPS = 2000;          // 20% platform fee
const MIN_CENTS = 100;                   // $1 minimum tip
const MAX_CENTS = 50000;                 // $500 maximum tip

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'method not allowed' });

  const user = await userFromToken(event.headers.authorization || event.headers.Authorization);
  if (!user) return json(401, { error: 'invalid session' });

  const body = safeBody(event.body);
  const toUserId = body.toUserId as string;
  const debateId = (body.debateId as string) || null;
  if (!toUserId) return json(400, { error: 'toUserId required' });
  if (toUserId === user.id) return json(400, { error: "you can't tip yourself" });

  // Amount: a preset tier OR a custom amount, both validated server-side.
  let amountCents: number | null = null;
  if (body.tierId) {
    const { data: tier } = await supabaseAdmin
      .from('gift_tiers').select('amount_cents, active').eq('id', body.tierId).maybeSingle();
    if (!tier || !tier.active) return json(400, { error: 'gift tier not found' });
    amountCents = tier.amount_cents;
  } else if (body.amountCents != null) {
    amountCents = Math.round(Number(body.amountCents));
  }
  if (amountCents == null || !Number.isFinite(amountCents)) return json(400, { error: 'a tip amount is required' });
  if (amountCents < MIN_CENTS) return json(400, { error: 'minimum tip is $1' });
  if (amountCents > MAX_CENTS) return json(400, { error: 'maximum tip is $500' });

  try {
    const { data: recipient } = await supabaseAdmin
      .from('profiles').select('id, display_name, handle').eq('id', toUserId).maybeSingle();
    if (!recipient) return json(404, { error: 'recipient not found' });

    // The creator must have a payout-ready connected account to receive tips.
    const { data: account } = await supabaseAdmin
      .from('creator_accounts').select('stripe_account_id, charges_enabled')
      .eq('user_id', toUserId).maybeSingle();
    if (!account?.stripe_account_id || !account.charges_enabled) {
      return json(400, { error: "this creator isn't set up to receive tips yet" });
    }

    const applicationFee = Math.round(amountCents * PLATFORM_FEE_BPS / 10000);

    // DIRECT charge on the creator's account (2nd arg). The creator is the
    // settlement merchant; our application fee transfers to the platform clean.
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: user.email ?? undefined,
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Tip to ${recipient.display_name ?? '@' + recipient.handle}`,
            description: 'The Rostrum — direct creator tip',
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      }],
      payment_intent_data: { application_fee_amount: applicationFee },
      metadata: {
        kind: 'gift_direct', from_id: user.id, to_id: toUserId,
        debate_id: debateId ?? '', amount_cents: String(amountCents),
      },
      success_url: debateId ? `${SITE}/debate/${debateId}?gift=success` : `${SITE}/?gift=success`,
      cancel_url: debateId ? `${SITE}/debate/${debateId}?gift=cancelled` : `${SITE}/?gift=cancelled`,
    }, { stripeAccount: account.stripe_account_id });

    return json(200, { url: session.url });
  } catch (err: any) {
    const msg = err?.raw?.message ?? err?.message ?? 'gift checkout failed';
    console.error('stripe-gift-checkout error:', msg, err?.raw ?? err);
    return json(500, { error: msg });
  }
};

function safeBody(raw: string | null): any {
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}
