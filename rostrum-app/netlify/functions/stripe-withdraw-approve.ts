// =====================================================================
// The Rostrum · netlify/functions/stripe-withdraw-approve.ts
// Admin-only. Approves or declines a queued payout request.
//   action 'approve' -> fire the Stripe transfer, mark paid (refund on fail)
//   action 'decline' -> refund the D-Bucks, mark declined
// The caller must be an admin; verified server-side against profiles.is_admin.
// =====================================================================
import type { Handler } from '@netlify/functions';
import Stripe from 'stripe';
import { supabaseAdmin, userFromToken } from '../../src/server/supabaseAdmin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'method not allowed' });

  const user = await userFromToken(event.headers.authorization || event.headers.Authorization);
  if (!user) return json(401, { error: 'invalid session' });

  // Server-side admin gate.
  const { data: me } = await supabaseAdmin.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  if (!me?.is_admin) return json(403, { error: 'admin only' });

  const body = safeBody(event.body);
  const id = String(body.withdrawalId ?? '');
  const action = String(body.action ?? 'approve');
  if (!id) return json(400, { error: 'withdrawalId required' });

  // Load the request; it must still be awaiting approval.
  const { data: wd } = await supabaseAdmin
    .from('withdrawals').select('id, user_id, net_cents, status').eq('id', id).maybeSingle();
  if (!wd) return json(404, { error: 'request not found' });
  if (wd.status !== 'requested') return json(409, { error: `request is already ${wd.status}` });

  // ---- Decline: refund + mark declined ----
  if (action === 'decline') {
    const { error } = await supabaseAdmin.rpc('admin_decline_withdrawal', {
      p_id: id, p_reason: (body.reason ? String(body.reason) : 'declined by admin'),
    });
    if (error) return json(400, { error: error.message ?? 'could not decline' });
    return json(200, { ok: true, status: 'declined' });
  }

  // ---- Approve: fire the transfer ----
  const { data: account } = await supabaseAdmin
    .from('creator_accounts').select('stripe_account_id, payouts_enabled')
    .eq('user_id', wd.user_id).maybeSingle();
  if (!account?.stripe_account_id || !account.payouts_enabled) {
    return json(400, { error: "recipient's payout account isn't ready" });
  }

  try {
    const transfer = await stripe.transfers.create({
      amount: wd.net_cents, currency: 'usd', destination: account.stripe_account_id,
      metadata: { kind: 'dbucks_withdrawal', withdrawal_id: wd.id, user_id: wd.user_id, approved_by: user.id },
    }, { idempotencyKey: `withdraw:${wd.id}` });

    await supabaseAdmin.rpc('admin_mark_withdrawal_paid', { p_id: wd.id, p_transfer: transfer.id });
    return json(200, { ok: true, status: 'paid', transfer_id: transfer.id });
  } catch (err: any) {
    const msg = err?.raw?.message ?? err?.message ?? 'payout failed';
    console.error('approve transfer error:', msg, err?.raw ?? err);
    await supabaseAdmin.rpc('refund_withdrawal', { p_id: wd.id, p_reason: msg }).catch(() => {});
    return json(502, { error: `payout failed and the D-Bucks were returned: ${msg}` });
  }
};

function safeBody(raw: string | null): any { try { return raw ? JSON.parse(raw) : {}; } catch { return {}; } }
function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}
