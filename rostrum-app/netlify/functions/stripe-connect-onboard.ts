// =====================================================================
// The Rostrum · netlify/functions/stripe-connect-onboard.ts
// Creates (or reuses) the caller's Stripe Connect Express account and
// returns a hosted onboarding link. This is how a creator links a bank
// account so they can be paid out. We never see or store bank details —
// Stripe collects them on its hosted flow.
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

  try {
    // Reuse an existing connected account if we already made one for this user.
    const { data: existing } = await supabaseAdmin
      .from('creator_accounts').select('stripe_account_id').eq('user_id', user.id).maybeSingle();

    let accountId = existing?.stripe_account_id as string | undefined;

    // A stored id is only reusable if THIS platform key can still see it.
    // Accounts created under a different (or test-mode) platform survive in
    // our table and make every later call fail with "does not have access to
    // account ..." — including this one, which would otherwise leave the
    // creator permanently unable to re-onboard. Verify, and re-create if not.
    if (accountId) {
      try {
        await stripe.accounts.retrieve(accountId);
      } catch {
        console.warn('stripe-connect-onboard: dropping unreachable account', { userId: user.id, accountId });
        accountId = undefined;
      }
    }

    if (!accountId) {
      // Both card_payments + transfers are required together for Express accounts.
      const account = await stripe.accounts.create({
        type: 'express',
        email: user.email ?? undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers:     { requested: true },
        },
        metadata: { user_id: user.id },
      });
      accountId = account.id;
      await supabaseAdmin.from('creator_accounts').upsert({
        user_id: user.id,
        stripe_account_id: accountId,
        // A fresh account has earned nothing yet. Clearing these matters:
        // stale charges_enabled=true is what let the tip modal offer a
        // payout account that could not actually take a payment.
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
        updated_at: new Date().toISOString(),
      });
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${SITE}/earnings?onboarding=refresh`,
      return_url:  `${SITE}/earnings?onboarding=done`,
      type: 'account_onboarding',
    });

    return json(200, { url: link.url });
  } catch (err: any) {
    // Surface the real Stripe error message so it shows in the UI.
    // Log the real Stripe error; never return it. Raw messages have
    // included masked-but-partial API keys and internal account ids.
    const detail = err?.raw?.message ?? err?.message ?? 'stripe onboarding failed';
    const msg = 'Could not start payout setup. Please try again.';
    console.error('stripe-connect-onboard error:', detail, err?.raw ?? err);
    return json(500, { error: msg });
  }
};

function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}
