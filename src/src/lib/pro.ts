// =====================================================================
// The Rostrum · src/lib/pro.ts
// Rostrum Pro: membership check + subscribe flow. A user is Pro whenever
// their pro_until is in the future (a cancelled sub rides out its paid
// period, then simply lapses).
// =====================================================================
import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import type { Profile } from './types';
import { C, a } from './theme';

export type ProPlanId = 'monthly' | 'annual';

/** Pro-only profile accent choices. Empty hex = the default multi-tone cover. */
export const PRO_ACCENTS: { id: string; hex: string; label: string }[] = [
  { id: 'default', hex: '', label: 'Default' },
  { id: 'royal',   hex: '#3B5BDB', label: 'Royal' },
  { id: 'crimson', hex: '#C0392B', label: 'Crimson' },
  { id: 'emerald', hex: '#2E9E86', label: 'Emerald' },
  { id: 'violet',  hex: '#7C4DFF', label: 'Violet' },
  { id: 'amber',   hex: '#D9A441', label: 'Amber' },
  { id: 'rose',    hex: '#D6407A', label: 'Rose' },
  { id: 'slate',   hex: '#5B6B7A', label: 'Slate' },
];

/** Cover-band background for a profile: accent-tinted for Pro members who've
 *  chosen one, otherwise the default royal/cyan/emerald gradient. */
export function coverGradient(accentHex?: string | null): string {
  if (!accentHex) return `linear-gradient(120deg, ${a(C.gold, '5C')}, ${a(C.cyan, '38')}, ${a(C.jade, '24')})`;
  return `linear-gradient(120deg, ${a(accentHex, '8A')}, ${a(accentHex, '40')}, ${a(accentHex, '12')})`;
}

export type ProPriceRow = { label: string; price: string; per: string; note?: string };
export type ProPricing = Record<ProPlanId, ProPriceRow>;

// FALLBACK ONLY — not the source of truth. Real pricing comes from the
// Stripe Price objects via /.netlify/functions/stripe-pro-prices. These
// values exist so the page renders instantly on first paint and still
// renders something sane if Stripe is unreachable. If they ever disagree
// with Stripe, Stripe wins and these are simply stale.
export const PRO_PRICING: ProPricing = {
  monthly: { label: 'Monthly', price: '$20', per: '/month' },
  annual:  { label: 'Annual',  price: '$200', per: '/year', note: '2 months free' },
};

// One in-flight request shared across every component that asks, and the
// resolved answer memoised for the rest of the page session.
let pricingPromise: Promise<ProPricing> | null = null;

/** Live Pro pricing, read off Stripe. Falls back to PRO_PRICING on any
 *  failure — this must never throw, because it renders the paywall. */
export function fetchProPricing(): Promise<ProPricing> {
  if (pricingPromise) return pricingPromise;
  pricingPromise = (async () => {
    try {
      const res = await fetch('/.netlify/functions/stripe-pro-prices');
      if (!res.ok) throw new Error(String(res.status));
      const out = await res.json();
      if (!out?.monthly?.price || !out?.annual?.price) throw new Error('malformed');
      return {
        monthly: { label: out.monthly.label, price: out.monthly.price, per: out.monthly.per, note: out.monthly.note },
        annual:  { label: out.annual.label,  price: out.annual.price,  per: out.annual.per,  note: out.annual.note  },
      } as ProPricing;
    } catch {
      // Deliberately silent: stale-but-correct-looking pricing beats an
      // error state on the upgrade page. The function logs the real cause.
      pricingPromise = null; // let a later mount retry
      return PRO_PRICING;
    }
  })();
  return pricingPromise;
}

/** Pricing for render. Starts on the fallback so there is no layout shift
 *  or spinner, then swaps in the live figures when they land. */
export function useProPricing(): { pricing: ProPricing; live: boolean } {
  const [pricing, setPricing] = useState<ProPricing>(PRO_PRICING);
  const [live, setLive] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetchProPricing().then((p) => {
      if (cancelled) return;
      setPricing(p);
      setLive(p !== PRO_PRICING);
    });
    return () => { cancelled = true; };
  }, []);
  return { pricing, live };
}

/** True if this profile currently has an active Pro membership. */
export function isPro(profile?: Pick<Profile, 'pro_until'> | null): boolean {
  return !!profile?.pro_until && new Date(profile.pro_until) > new Date();
}

/** Start the Stripe Checkout flow for Pro and redirect to it. */
export async function subscribeToPro(plan: ProPlanId): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch('/.netlify/functions/stripe-pro-subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
    body: JSON.stringify({ plan }),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok || !out.url) throw new Error(out?.error ?? 'Could not start checkout');
  window.location.href = out.url as string;
}

/** Open Stripe's hosted billing portal (update card, view invoices, cancel). */
export async function openBillingPortal(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch('/.netlify/functions/stripe-billing-portal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok || !out.url) throw new Error(out?.error ?? 'Could not open billing portal');
  window.location.href = out.url as string;
}
