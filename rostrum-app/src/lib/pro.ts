// =====================================================================
// The Rostrum · src/lib/pro.ts
// Rostrum Pro: membership check + subscribe flow. A user is Pro whenever
// their pro_until is in the future (a cancelled sub rides out its paid
// period, then simply lapses).
// =====================================================================
import { supabase } from './supabaseClient';
import type { Profile } from './types';

export type ProPlanId = 'monthly' | 'annual';

export const PRO_PRICING: Record<ProPlanId, { label: string; price: string; per: string; note?: string }> = {
  monthly: { label: 'Monthly', price: '$15', per: '/month' },
  annual:  { label: 'Annual',  price: '$150', per: '/year', note: '2 months free' },
};

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
