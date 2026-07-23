// =====================================================================
// The Rostrum · netlify/functions/stripe-pro-prices.ts
// Public, unauthenticated GET returning what Rostrum Pro actually costs,
// read straight off the Stripe Price objects. This exists so the pricing
// on /pro can never drift from the amount Checkout charges — before
// this, the numbers were hardcoded in two places and kept in sync by
// hand.
//
// Prices are looked up by LOOKUP KEY, not by id, so rotating to a new
// Price (the correct way to change pricing — never edit a Price that
// existing subscribers sit on) only means moving the lookup key across.
//
// Cheap and cacheable: one Stripe list call, well inside Netlify's
// 10-second sync-function ceiling, with CDN caching on top so the
// pricing page isn't waiting on Stripe for real users.
// =====================================================================
import type { Handler } from '@netlify/functions';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const LOOKUP_KEYS = {
  monthly: process.env.STRIPE_LOOKUP_PRO_MONTHLY || 'pro_monthly',
  annual: process.env.STRIPE_LOOKUP_PRO_ANNUAL || 'pro_annual',
} as const;

type PlanId = keyof typeof LOOKUP_KEYS;

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'method not allowed' });

  try {
    const { data: prices } = await stripe.prices.list({
      lookup_keys: [LOOKUP_KEYS.monthly, LOOKUP_KEYS.annual],
      active: true,
      expand: ['data.product'],
      limit: 10,
    });

    const byKey = new Map(prices.map((p) => [p.lookup_key ?? '', p]));
    const monthly = byKey.get(LOOKUP_KEYS.monthly);
    const annual = byKey.get(LOOKUP_KEYS.annual);

    // If Stripe answered but the keys are missing, say so plainly rather
    // than returning half a price table — the client falls back to its
    // built-in defaults, which is a better page than a blank one.
    if (!monthly || !annual) {
      console.error('stripe-pro-prices: missing lookup keys', {
        found: prices.map((p) => p.lookup_key),
        want: [LOOKUP_KEYS.monthly, LOOKUP_KEYS.annual],
      });
      return json(404, { error: 'pro prices not configured' });
    }

    const out: Record<PlanId, ReturnType<typeof shape>> = {
      monthly: shape(monthly, 'Monthly'),
      annual: shape(annual, 'Annual'),
    };

    // Annual's savings badge is DERIVED, never typed by hand, so it stays
    // true automatically if either amount changes.
    const note = savingsNote(monthly.unit_amount, annual.unit_amount, monthly.currency);
    if (note) out.annual.note = note;

    return json(200, out, {
      // Short browser cache, longer CDN cache. Pricing changes are rare
      // and a few minutes of staleness is harmless.
      'cache-control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
    });
  } catch (err: any) {
    const msg = err?.raw?.message ?? err?.message ?? 'could not load pricing';
    console.error('stripe-pro-prices error:', msg, err?.raw ?? err);
    return json(500, { error: msg });
  }
};

function shape(price: Stripe.Price, label: string) {
  return {
    label,
    price: money(price.unit_amount, price.currency),
    per: per(price.recurring),
    amount_cents: price.unit_amount ?? 0,
    currency: price.currency,
    note: undefined as string | undefined,
  };
}

/** 2000 -> "$20"  ·  1999 -> "$19.99". Whole amounts lose the ".00". */
function money(cents: number | null, currency: string): string {
  const v = (cents ?? 0) / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(v);
}

function per(r: Stripe.Price.Recurring | null): string {
  if (!r) return '';
  const n = r.interval_count ?? 1;
  return n === 1 ? `/${r.interval}` : `/${n} ${r.interval}s`;
}

/** "2 months free" when the annual discount divides evenly into whole
 *  months, otherwise a plain "Save $40". Empty string if there's no saving. */
function savingsNote(monthlyCents: number | null, annualCents: number | null, currency: string): string {
  if (!monthlyCents || !annualCents) return '';
  const saved = monthlyCents * 12 - annualCents;
  if (saved <= 0) return '';
  const months = saved / monthlyCents;
  if (Number.isInteger(months)) return `${months} month${months === 1 ? '' : 's'} free`;
  return `Save ${money(saved, currency)}`;
}

function json(statusCode: number, body: unknown, extraHeaders: Record<string, string> = {}) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body),
  };
}
