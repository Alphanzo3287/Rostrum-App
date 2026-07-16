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

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'method not allowed' });
  const user = await userFromToken(event.headers.authorization || event.headers.Authorization);
  if (!user) return json(401, { error: 'invalid session' });

  // PAID FEATURE — enforced server-side, not just in the UI.
  const gate = await requirePro(user.id);
  if (!gate.ok) return json(402, { error: gate.reason, upgrade: true });

  const body = safeBody(event.body);
  const debateId = String(body.debateId || '');
  const claim = String(body.claim || '').trim();
  if (!debateId) return json(400, { error: 'debateId required' });
  if (!claim) return json(400, { error: 'enter a claim to check' });
  if (claim.length > MAX_CLAIM_LEN) return json(400, { error: 'claim is too long' });

  try {
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await supabaseAdmin.from('fact_checks')
      .select('id', { count: 'exact', head: true }).eq('requested_by', user.id).gte('created_at', since);
    if ((count ?? 0) >= HOURLY_LIMIT) return json(429, { error: "you've reached the hourly fact-check limit — try again later" });

    // Netlify kills sync functions at ~10s. Give the model a hard 8s so we can
    // always return a readable JSON error instead of a platform HTML timeout.
    const result = await runFactCheck(claim, { deadlineMs: 8600 });
    const { data, error } = await supabaseAdmin.from('fact_checks').insert({
      debate_id: debateId, requested_by: user.id, claim, source: 'manual',
      verdict: result.verdict, confidence: result.confidence, confidence_pct: result.confidence_pct, explanation: result.explanation, sources: result.sources,
    }).select().single();
    if (error) return json(500, { error: 'could not save the verdict' });
    return json(200, { factCheck: data });
  } catch (err: any) {
    console.error('gavel-factcheck error:', err?.message ?? err);
    const msg = String(err?.message || '');
    return json(503, { error: msg.startsWith('Gavel') ? msg : 'Gavel is temporarily unavailable. Please try again.' });
  }
};

function safeBody(raw: string | null): any { try { return raw ? JSON.parse(raw) : {}; } catch { return {}; } }
function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}
