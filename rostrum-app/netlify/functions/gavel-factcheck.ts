// =====================================================================
// The Rostrum · netlify/functions/gavel-factcheck.ts
// On-demand fact-check. Auth + rate-limit + the shared Gavel pipeline.
// Requires env: ANTHROPIC_API_KEY.
// =====================================================================
import type { Handler } from '@netlify/functions';
import { supabaseAdmin, userFromToken } from '../../src/server/supabaseAdmin';
import { runFactCheck } from '../../src/server/gavelCore';
import { requirePro } from '../../src/server/proAccess';

const MAX_CLAIM_LEN = 1000;
const HOURLY_LIMIT = 15;

// Netlify kills synchronous functions at 10s (Free/Personal plans). Aim to be
// done by 9s so we always return our own JSON rather than a platform HTML 504.
const TOTAL_BUDGET_MS = 8500;
const INSERT_RESERVE_MS = 500;   // writing the verdict back
const MIN_PIPELINE_MS = 4000;    // never hand the pipeline a hopeless budget

export const handler: Handler = async (event) => {
  // WALL CLOCK starts here, not at runFactCheck. Netlify kills the whole
  // invocation at ~10s, and auth + the Pro gate + the rate-limit read all spend
  // real time before the pipeline begins. Budgeting only the pipeline let the
  // total drift over the limit once the Pro gate added a third round-trip.
  const t0 = Date.now();
  const elapsed = () => Date.now() - t0;

  if (event.httpMethod !== 'POST') return json(405, { error: 'method not allowed' });
  const user = await userFromToken(event.headers.authorization || event.headers.Authorization);
  if (!user) return json(401, { error: 'invalid session' });

  // Validate the (free) input BEFORE touching the database — no point paying
  // for round-trips on a request we're going to reject anyway.
  const body = safeBody(event.body);
  const debateId = String(body.debateId || '');
  const claim = String(body.claim || '').trim();
  if (!debateId) return json(400, { error: 'debateId required' });
  if (!claim) return json(400, { error: 'enter a claim to check' });
  if (claim.length > MAX_CLAIM_LEN) return json(400, { error: 'claim is too long' });

  try {
    // The Pro gate and the rate-limit read are independent — run them
    // CONCURRENTLY. Serialising them wasted ~400ms of a 10s budget.
    const since = new Date(Date.now() - 3600_000).toISOString();
    const [gate, rate] = await Promise.all([
      requirePro(user.id),
      supabaseAdmin.from('fact_checks')
        .select('id', { count: 'exact', head: true })
        .eq('requested_by', user.id).gte('created_at', since),
    ]);

    // PAID FEATURE — enforced server-side, not just in the UI.
    if (!gate.ok) return json(402, { error: gate.reason, upgrade: true });
    if ((rate.count ?? 0) >= HOURLY_LIMIT) {
      return json(429, { error: "you've reached the hourly fact-check limit — try again later" });
    }

    // Hand the pipeline only the time that's genuinely left, minus a reserve
    // for writing the verdict back.
    const budget = TOTAL_BUDGET_MS - elapsed() - INSERT_RESERVE_MS;
    const result = await runFactCheck(claim, { deadlineMs: Math.max(MIN_PIPELINE_MS, budget) });

    const { data, error } = await supabaseAdmin.from('fact_checks').insert({
      debate_id: debateId, requested_by: user.id, claim, source: 'manual',
      verdict: result.verdict, confidence: result.confidence, confidence_pct: result.confidence_pct,
      explanation: result.explanation, sources: result.sources,
    }).select().single();
    if (error) return json(500, { error: 'could not save the verdict' });
    return json(200, { factCheck: data });
  } catch (err: any) {
    console.error('gavel-factcheck error:', err?.message ?? err, `(${elapsed()}ms elapsed)`);
    const msg = String(err?.message || '');
    return json(503, { error: msg.startsWith('Gavel') ? msg : 'Gavel is temporarily unavailable. Please try again.' });
  }
};

function safeBody(raw: string | null): any { try { return raw ? JSON.parse(raw) : {}; } catch { return {}; } }
function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}
