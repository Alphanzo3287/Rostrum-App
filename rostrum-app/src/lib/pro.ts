// =====================================================================
// The Rostrum · src/lib/pro.ts
// Rostrum Pro: membership check + subscribe flow. A user is Pro whenever
// their pro_until is in the future (a cancelled sub rides out its paid
// period, then simply lapses).
// =====================================================================
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

/** Claim the monthly Pro stipend if eligible. Idempotent (once per calendar
 *  month, server-enforced); returns the D-Bucks granted, or 0 if not due. */
export async function claimProStipend(): Promise<number> {
  const { data, error } = await supabase.rpc('claim_pro_stipend');
  if (error) return 0;
  return Number(data ?? 0);
}
