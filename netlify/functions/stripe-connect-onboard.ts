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
    const msg = err?.raw?.message ?? err?.message ?? 'stripe onboarding failed';
    console.error('stripe-connect-onboard error:', msg, err?.raw ?? err);
    return json(500, { error: msg });
  }
};

function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}
