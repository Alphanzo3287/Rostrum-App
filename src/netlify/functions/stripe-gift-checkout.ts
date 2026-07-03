// =====================================================================
// The Rostrum · netlify/functions/stripe-gift-checkout.ts
// Buy a specific gift tier and send it directly, in one real-money
// charge — replaces the old "buy D-Bucks in bulk, then spend them"
// two-step flow for anyone who doesn't already have enough wallet
// balance. Price comes from gift_tiers.amount_cents server-side, never
// trusted from the client.
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

  const body = safeBody(event.body);
  const tierId = body.tierId as string;
  const toUserId = body.toUserId as string;
  const debateId = (body.debateId as string) || null;
  if (!tierId || !toUserId) return json(400, { error: 'tierId and toUserId required' });
  if (toUserId === user.id) return json(400, { error: "you can't gift yourself" });

  try {
    const { data: tier } = await supabaseAdmin
      .from('gift_tiers').select('id, name, amount_cents, price_dbucks, active')
      .eq('id', tierId).maybeSingle();
    if (!tier || !tier.active) return json(400, { error: 'gift tier not found' });

    const { data: recipient } = await supabaseAdmin.from('profiles').select('id').eq('id', toUserId).maybeSingle();
    if (!recipient) return json(404, { error: 'recipient not found' });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: user.email ?? undefined,
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: `${tier.name} gift`, description: 'The Rostrum — gift' },
          unit_amount: tier.amount_cents,
        },
        quantity: 1,
      }],
      metadata: {
        kind: 'gift_purchase', tier_id: tier.id, from_id: user.id, to_id: toUserId,
        dbucks_amount: String(tier.price_dbucks), debate_id: debateId ?? '',
      },
      success_url: debateId ? `${SITE}/debate/${debateId}?gift=success` : `${SITE}/?gift=success`,
      cancel_url: debateId ? `${SITE}/debate/${debateId}?gift=cancelled` : `${SITE}/?gift=cancelled`,
    });
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
