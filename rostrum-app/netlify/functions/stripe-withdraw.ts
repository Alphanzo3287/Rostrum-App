// =====================================================================
// The Rostrum · netlify/functions/stripe-withdraw.ts
// A creator REQUESTS a cash-out. The D-Bucks are reserved immediately
// (so the balance can't be double-spent), but NO money moves yet — the
// request queues for manual admin approval in the Back Office. Approval
// (which fires the Stripe transfer) happens in stripe-withdraw-approve.ts.
// =====================================================================
import type { Handler } from '@netlify/functions';
import { supabaseAdmin, userFromToken } from '../../src/server/supabaseAdmin';

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

  // Reserve the funds and open a pending-approval request.
  const { data: wd, error } = await supabaseAdmin
    .rpc('request_withdrawal', { p_user: user.id, p_dbucks: dbucks });
  if (error) return json(400, { error: error.message ?? 'could not submit withdrawal' });
  const withdrawal = Array.isArray(wd) ? wd[0] : wd;
  if (!withdrawal?.id) return json(500, { error: 'withdrawal could not be created' });

  return json(200, {
    ok: true, requested: true,
    net_cents: withdrawal.net_cents, fee_cents: withdrawal.fee_cents, gross_cents: withdrawal.gross_cents,
  });
};

function safeBody(raw: string | null): any { try { return raw ? JSON.parse(raw) : {}; } catch { return {}; } }
function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}
