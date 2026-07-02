// =====================================================================
// The Rostrum · netlify/functions/stripe-checkout.ts
// Creates a Stripe Checkout Session for a supporter buying a D-Bucks
// package with real money. Package → price is decided HERE, server-side,
// from a fixed map — the client only ever sends a package id, never an
// amount, so there's no way to tamper with the price from the browser.
// The actual D-Bucks credit happens in stripe-webhook.ts once payment
// is confirmed — this function only ever starts the checkout.
// =====================================================================
import type { Handler } from '@netlify/functions';
import Stripe from 'stripe';
import { userFromToken } from '../../src/server/supabaseAdmin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const SITE = process.env.PUBLIC_SITE_URL || 'https://rostrums.site';

export const DBUCKS_PACKAGES = {
  p500:  { dbucks: 500,   price_cents: 500,   label: '500 D-Bucks' },
  p1000: { dbucks: 1000,  price_cents: 1000,  label: '1,000 D-Bucks' },
  p5000: { dbucks: 5000,  price_cents: 5000,  label: '5,000 D-Bucks' },
} as const;
export type DbucksPackageId = keyof typeof DBUCKS_PACKAGES;

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'method not allowed' });

  const user = await userFromToken(event.headers.authorization || event.headers.Authorization);
  if (!user) return json(401, { error: 'invalid session' });

  const body = safeBody(event.body);
  const packageId = body.packageId as DbucksPackageId;
  const pkg = DBUCKS_PACKAGES[packageId];
  if (!pkg) return json(400, { error: 'unknown package' });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: user.email ?? undefined,
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: pkg.label, description: 'D-Bucks for The Rostrum' },
          unit_amount: pkg.price_cents,
        },
        quantity: 1,
      }],
      metadata: { user_id: user.id, package_id: packageId, dbucks_amount: String(pkg.dbucks) },
      success_url: `${SITE}/store?purchase=success`,
      cancel_url: `${SITE}/store?purchase=cancelled`,
    });
    return json(200, { url: session.url });
  } catch (err: any) {
    const msg = err?.raw?.message ?? err?.message ?? 'stripe checkout failed';
    console.error('stripe-checkout error:', msg, err?.raw ?? err);
    return json(500, { error: msg });
  }
};

function safeBody(raw: string | null): any {
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}
