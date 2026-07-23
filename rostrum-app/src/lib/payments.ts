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

/* ---- Types ---- */
export interface Earnings { gross_cents: number; fee_cents: number; net_cents: number; currency: string; }
export interface CreatorAccount {
  connected: boolean; charges_enabled: boolean; payouts_enabled: boolean; details_submitted: boolean;
}
export interface PlatformConfig { platform_fee_bps: number; currency: string; min_charge_cents: number; }
export interface GiftTier { id: string; name: string; icon: string; amount_cents: number; price_dbucks: number; sort: number; }

/* ---- Gift tiers ---- */
export async function getGiftTiers(): Promise<GiftTier[]> {
  const { data } = await supabase
    .from('gift_tiers').select('id,name,icon,amount_cents,price_dbucks,sort').eq('active', true).order('sort');
  return (data ?? []) as GiftTier[];
}

/* ---- Send a gift ---- */
export async function sendGift(tierId: string, toUserId: string, debateId?: string) {
  const { error } = await supabase.rpc('send_gift', {
    p_tier: tierId,
    p_to: toUserId,
    ...(debateId ? { p_debate: debateId } : {}),
  });
  if (error) throw error;
}

/* ---- Debate participants (for gift target picker) ---- */
export interface DebateParticipant { user_id: string; display_name: string; avatar_url: string | null; role: string; }
export async function getDebateParticipants(debateId: string): Promise<DebateParticipant[]> {
  const { data } = await supabase
    .from('debate_participants')
    .select('user_id, role, profiles!inner(display_name, avatar_url)')
    .eq('debate_id', debateId);
  return (data ?? []).map((r: any) => ({
    user_id: r.user_id,
    display_name: r.profiles?.display_name ?? 'User',
    avatar_url: r.profiles?.avatar_url ?? null,
    role: r.role,
  }));
}

/* ---- Stripe earnings / payout ---- */
export async function getMyEarnings(): Promise<Earnings> {
  const { data, error } = await supabase.rpc('my_earnings');
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row ?? { gross_cents: 0, fee_cents: 0, net_cents: 0, currency: 'usd' };
}

export async function getPlatformConfig(): Promise<PlatformConfig> {
  const { data } = await supabase
    .from('platform_config').select('platform_fee_bps,currency,min_charge_cents').limit(1).maybeSingle();
  return data ?? { platform_fee_bps: 1500, currency: 'usd', min_charge_cents: 100 };
}

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

export const startPayoutOnboarding = () => authedPost<{ url: string }>('stripe-connect-onboard');
export const refreshPayoutStatus = () => authedPost<CreatorAccount>('stripe-account-status');

/* ---- Buy & send a gift directly with real money (no wallet top-up step) ---- */
export const startGiftCheckout = (toUserId: string, opts: { tierId?: string; amountCents?: number; debateId?: string }) =>
  authedPost<{ url: string }>('stripe-gift-checkout', { toUserId, ...opts });

/* ---- Pay-per-view debate entry (Oxford / Legacy) ---- */
export const startDebateEntryCheckout = (debateId: string) =>
  authedPost<{ url: string }>('stripe-debate-entry-checkout', { debateId });
export async function hasPaidDebateEntry(debateId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('has_paid_debate_entry', { p_debate: debateId });
  if (error) return false;
  return !!data;
}

/* ---- Level / XP / progress ---- */
export interface Progress {
  xp: number; level: number; next_level_xp: number;
  qualifying_debates: number; qualifying_lectures: number; verified_speaking_seconds: number;
  cashout_unlocked: boolean;
}
export async function getMyProgress(): Promise<Progress> {
  const { data, error } = await supabase.rpc('get_my_progress');
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row ?? { xp: 0, level: 1, next_level_xp: 300, qualifying_debates: 0, qualifying_lectures: 0, verified_speaking_seconds: 0, cashout_unlocked: false };
}

/* ============ Back Office (admin) ============ */
export interface PayoutRequest {
  id: string; user_id: string; display_name: string; handle: string;
  dbucks_amount: number; gross_cents: number; fee_cents: number; net_cents: number;
  status: 'requested' | 'paid' | 'declined' | 'failed' | 'pending';
  created_at: string; paid_at: string | null; cashable_redeemable: number;
}
export interface AdminTxn {
  id: string; created_at: string; category: string; from_label: string; to_label: string;
  dbucks: number; amount_cents: number; reason: string;
}
export interface FinancialSummary {
  gift_revenue_cents: number; payouts_paid_cents: number; payouts_pending_cents: number;
  platform_fees_cents: number; pending_count: number; circulating_dbucks: number;
}
export interface FinancialPoint { day: string; gift_cents: number; payout_cents: number; }

export async function adminListPayoutRequests(status: string | null = 'requested'): Promise<PayoutRequest[]> {
  const { data, error } = await supabase.rpc('admin_list_payout_requests', { p_status: status });
  if (error) throw error;
  return (data as PayoutRequest[]) ?? [];
}
export const approvePayout = (id: string) =>
  authedPost<{ ok: boolean; status: string }>('stripe-withdraw-approve', { withdrawalId: id, action: 'approve' });
export const declinePayout = (id: string, reason?: string) =>
  authedPost<{ ok: boolean; status: string }>('stripe-withdraw-approve', { withdrawalId: id, action: 'decline', reason });

export async function adminTransactions(limit = 100): Promise<AdminTxn[]> {
  const { data, error } = await supabase.rpc('admin_transactions', { p_limit: limit });
  if (error) throw error;
  return (data as AdminTxn[]) ?? [];
}
export async function adminFinancialSummary(): Promise<FinancialSummary> {
  const { data, error } = await supabase.rpc('admin_financial_summary');
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row ?? { gift_revenue_cents: 0, payouts_paid_cents: 0, payouts_pending_cents: 0, platform_fees_cents: 0, pending_count: 0, circulating_dbucks: 0 };
}
export async function adminFinancialTimeseries(days = 30): Promise<FinancialPoint[]> {
  const { data, error } = await supabase.rpc('admin_financial_timeseries', { p_days: days });
  if (error) throw error;
  return (data as FinancialPoint[]) ?? [];
}
