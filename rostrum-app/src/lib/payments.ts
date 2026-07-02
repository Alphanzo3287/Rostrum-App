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
export interface Wallet { promo: number; redeemable: number; total: number; }
export interface Earnings { gross_cents: number; fee_cents: number; net_cents: number; currency: string; }
export interface CreatorAccount {
  connected: boolean; charges_enabled: boolean; payouts_enabled: boolean; details_submitted: boolean;
}
export interface PlatformConfig { platform_fee_bps: number; currency: string; min_charge_cents: number; }
export interface GiftTier { id: string; name: string; icon: string; amount_cents: number; price_dbucks: number; sort: number; }

/* ---- D-Bucks wallet ---- */
export async function getMyWallet(): Promise<Wallet> {
  const { data, error } = await supabase.rpc('get_my_wallet');
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row ?? { promo: 0, redeemable: 0, total: 0 };
}

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

/* ---- Buy D-Bucks with real money ----
   Display-only copy of the server's package map (netlify/functions/
   stripe-checkout.ts is the source of truth for actual pricing — the
   server never trusts anything the client sends about price). */
export const DBUCKS_PACKAGES = [
  { id: 'p500',  dbucks: 500,  priceCents: 500 },
  { id: 'p1000', dbucks: 1000, priceCents: 1000 },
  { id: 'p5000', dbucks: 5000, priceCents: 5000 },
] as const;
export const startDbucksCheckout = (packageId: string) => authedPost<{ url: string }>('stripe-checkout', { packageId });
/* Store: buy a gift's D-Bucks value into your own wallet, to send later. */
export const startGiftDbucksCheckout = (tierId: string) => authedPost<{ url: string }>('stripe-checkout', { tierId });

/* ---- Phase 4: creator buy-back listings ----
   One active listing per creator. Creator lists some of their redeemable
   D-Bucks for sale with a digital product attached; a supporter buys it
   for real money, split 85/15 straight to the creator's bank via Stripe
   Connect, and the D-Bucks retire back to treasury. */
export interface BuybackListing {
  id: string; creator_id: string; dbucks_amount: number; price_cents: number;
  product_name: string; product_file_path: string; status: 'active' | 'sold' | 'cancelled';
  buyer_id: string | null; created_at: string; sold_at: string | null;
}

export async function getMyListing(): Promise<BuybackListing | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('buyback_listings').select('*')
    .eq('creator_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
  return (data as BuybackListing) ?? null;
}

export async function getCreatorListing(creatorId: string): Promise<BuybackListing | null> {
  const { data } = await supabase.from('buyback_listings').select('*')
    .eq('creator_id', creatorId).eq('status', 'active').maybeSingle();
  return (data as BuybackListing) ?? null;
}

export async function createBuybackListing(
  dbucks: number, priceCents: number, productName: string, file: File,
): Promise<BuybackListing> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('not signed in');
  const ext = file.name.split('.').pop() ?? 'pdf';
  const path = `${user.id}/${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage.from('creator-products').upload(path, file);
  if (upErr) throw upErr;
  const { data, error } = await supabase.rpc('create_buyback_listing', {
    p_dbucks: dbucks, p_price_cents: priceCents, p_product_name: productName, p_file_path: path,
  });
  if (error) throw error;
  return data as BuybackListing;
}

export async function cancelBuybackListing(listingId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_buyback_listing', { p_listing: listingId });
  if (error) throw error;
}

export const startBuybackCheckout = (listingId: string) => authedPost<{ url: string }>('stripe-buyback-checkout', { listingId });
export const getBuybackDownloadUrl = (listingId: string) => authedPost<{ url: string }>('buyback-download', { listingId });

/* ---- Buy & send a gift directly with real money (no wallet top-up step) ---- */
export const startGiftCheckout = (tierId: string, toUserId: string, debateId?: string) =>
  authedPost<{ url: string }>('stripe-gift-checkout', { tierId, toUserId, debateId });

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
  qualifying_debates: number; verified_speaking_seconds: number;
  cashout_unlocked: boolean;
}
export async function getMyProgress(): Promise<Progress> {
  const { data, error } = await supabase.rpc('get_my_progress');
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row ?? { xp: 0, level: 1, next_level_xp: 300, qualifying_debates: 0, verified_speaking_seconds: 0, cashout_unlocked: false };
}
