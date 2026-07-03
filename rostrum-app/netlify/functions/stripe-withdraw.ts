// =====================================================================
// The Rostrum · netlify/functions/stripe-withdraw.ts
// Cash-out: a qualified creator converts REDEEMABLE D-Bucks into a real
// payout to their connected Stripe account (which then pays out to their
// bank). Flow: reserve the D-Bucks atomically (request_withdrawal, which
// guards against overdraw under a row lock) -> create a Stripe Transfer
// for the net amount -> mark paid. If the transfer fails, refund the
// D-Bucks and mark the withdrawal failed, so a user is never left short.
// =====================================================================
import type { Handler } from '@netlify/functions';
import Stripe from 'stripe';
import { supabaseAdmin, userFromToken } from '../../src/server/supabaseAdmin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'method not allowed' });

  const user = await userFromToken(event.headers.authorization || event.headers.Authorization);
  if (!user) return json(401, { error: 'invalid session' });

  const body = safeBody(event.body);
  const dbucks = Math.floor(Number(body.dbucks ?? 0));
  if (!dbucks || dbucks <= 0) return json(400, { error: 'amount required' });

  // Payout account must be onboarded and enabled for payouts.
  const { data: account } = await supabaseAdmin
    .from('creator_accounts').select('stripe_account_id, payouts_enabled')
    .eq('user_id', user.id).maybeSingle();
  if (!account?.stripe_account_id || !account.payouts_enabled) {
    return json(400, { error: "your payout account isn't set up for withdrawals yet" });
  }

  // Reserve the funds atomically (validates unlock, minimum, and balance
  // under a row lock; deducts redeemable D-Bucks; opens a pending row).
  const { data: wd, error: reqErr } = await supabaseAdmin
    .rpc('request_withdrawal', { p_user: user.id, p_dbucks: dbucks });
  if (reqErr) return json(400, { error: reqErr.message ?? 'could not start withdrawal' });
  const withdrawal = Array.isArray(wd) ? wd[0] : wd;
  if (!withdrawal?.id) return json(500, { error: 'withdrawal could not be created' });

  try {
    const transfer = await stripe.transfers.create({
      amount: withdrawal.net_cents,
      currency: 'usd',
      destination: account.stripe_account_id,
      metadata: { kind: 'dbucks_withdrawal', withdrawal_id: withdrawal.id, user_id: user.id },
    }, { idempotencyKey: `withdraw:${withdrawal.id}` });

    await supabaseAdmin.from('withdrawals')
      .update({ status: 'paid', stripe_transfer_id: transfer.id, paid_at: new Date().toISOString() })
      .eq('id', withdrawal.id);

    return json(200, {
      ok: true,
      net_cents: withdrawal.net_cents,
      fee_cents: withdrawal.fee_cents,
      gross_cents: withdrawal.gross_cents,
    });
  } catch (err: any) {
    // Payout failed — give the D-Bucks back and mark it failed so the
    // creator is made whole. Refund is idempotent and only fires once.
    const msg = err?.raw?.message ?? err?.message ?? 'payout failed';
    console.error('stripe-withdraw transfer error:', msg, err?.raw ?? err);
    await supabaseAdmin.rpc('refund_withdrawal', { p_id: withdrawal.id, p_reason: msg }).catch(() => {});
    return json(502, { error: `payout failed and your D-Bucks were returned: ${msg}` });
  }
};

function safeBody(raw: string | null): any {
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}
