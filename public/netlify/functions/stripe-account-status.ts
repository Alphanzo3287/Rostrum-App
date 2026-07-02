// =====================================================================
// The Rostrum · netlify/functions/stripe-account-status.ts
// Fetches the caller's Stripe Connect account, mirrors its readiness flags
// into creator_accounts, and returns them. Called by the earnings screen
// (e.g. right after the user returns from Stripe onboarding) so the UI can
// reflect live status without waiting on a webhook.
// =====================================================================
import type { Handler } from '@netlify/functions';
import Stripe from 'stripe';
import { supabaseAdmin, userFromToken } from '../../src/server/supabaseAdmin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const DISCONNECTED = {
  connected: false, charges_enabled: false, payouts_enabled: false, details_submitted: false,
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'method not allowed' });

  const user = await userFromToken(event.headers.authorization || event.headers.Authorization);
  if (!user) return json(401, { error: 'invalid session' });

  try {
    const { data: row } = await supabaseAdmin
      .from('creator_accounts').select('stripe_account_id').eq('user_id', user.id).maybeSingle();

    const accountId = row?.stripe_account_id as string | undefined;
    if (!accountId) return json(200, DISCONNECTED);

    const acct = await stripe.accounts.retrieve(accountId);
    const status = {
      connected: true,
      charges_enabled: !!acct.charges_enabled,
      payouts_enabled: !!acct.payouts_enabled,
      details_submitted: !!acct.details_submitted,
    };

    await supabaseAdmin.from('creator_accounts').update({
      charges_enabled: status.charges_enabled,
      payouts_enabled: status.payouts_enabled,
      details_submitted: status.details_submitted,
      updated_at: new Date().toISOString(),
    }).eq('user_id', user.id);

    return json(200, status);
  } catch (err: any) {
    return json(500, { error: err?.message ?? 'stripe status check failed' });
  }
};

function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}
