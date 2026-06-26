// =====================================================================
// The Rostrum · src/lib/payments.ts
// Client wrappers for the monetization layer. Reads go straight to tables/
// RPCs (RLS keeps them honest); money actions go through Netlify functions
// that talk to Stripe. Amounts are ALWAYS decided server-side.
// =====================================================================
import { supabase } from './supabaseClient';

async function authedPost<T = any>(fn: string, body: unknown = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('not authenticated');
  const res = await fetch(`/.netlify/functions/${fn}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? `${fn} failed`);
  return res.json();
}

export interface Earnings { gross_cents: number; fee_cents: number; net_cents: number; currency: string; }
export interface CreatorAccount {
  connected: boolean; charges_enabled: boolean; payouts_enabled: boolean; details_submitted: boolean;
}
export interface PlatformConfig { platform_fee_bps: number; currency: string; min_charge_cents: number; }
export interface GiftTier { id: string; name: string; icon: string; amount_cents: number; sort: number; }

/** Caller's lifetime creator earnings, computed from the ledger server-side. */
export async function getMyEarnings(): Promise<Earnings> {
  const { data, error } = await supabase.rpc('my_earnings');
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row ?? { gross_cents: 0, fee_cents: 0, net_cents: 0, currency: 'usd' };
}

/** Platform fee config (not secret — used to show "platform keeps X%"). */
export async function getPlatformConfig(): Promise<PlatformConfig> {
  const { data } = await supabase
    .from('platform_config').select('platform_fee_bps,currency,min_charge_cents').limit(1).maybeSingle();
  return data ?? { platform_fee_bps: 1500, currency: 'usd', min_charge_cents: 100 };
}

/** Locally-stored payout-account flags (may lag Stripe; refresh syncs them). */
export async function getCreatorAccount(): Promise<CreatorAccount> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { connected: false, charges_enabled: false, payouts_enabled: false, details_submitted: false };
  const { data } = await supabase
    .from('creator_accounts')
    .select('stripe_account_id,charges_enabled,payouts_enabled,details_submitted')
    .eq('user_id', user.id).maybeSingle();
  if (!data) return { connected: false, charges_enabled: false, payouts_enabled: false, details_submitted: false };
  return {
    connected: !!data.stripe_account_id,
    charges_enabled: !!data.charges_enabled,
    payouts_enabled: !!data.payouts_enabled,
    details_submitted: !!data.details_submitted,
  };
}

/** Server-defined gift/tip catalog. */
export async function getGiftTiers(): Promise<GiftTier[]> {
  const { data } = await supabase
    .from('gift_tiers').select('id,name,icon,amount_cents,sort').eq('active', true).order('sort');
  return (data ?? []) as GiftTier[];
}

/** Begin / resume Stripe Connect onboarding → returns a hosted URL to redirect to. */
export const startPayoutOnboarding = () => authedPost<{ url: string }>('stripe-connect-onboard');

/** Pull live payout-account status from Stripe and sync it locally. */
export const refreshPayoutStatus = () => authedPost<CreatorAccount>('stripe-account-status');
