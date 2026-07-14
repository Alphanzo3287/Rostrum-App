// =====================================================================
// The Rostrum · netlify/functions/gavel-factcheck.ts
// On-demand fact-check. Auth + rate-limit + the shared Gavel pipeline.
// Requires env: ANTHROPIC_API_KEY.
// =====================================================================
import type { Handler } from '@netlify/functions';
import { supabaseAdmin, userFromToken } from '../../src/server/supabaseAdmin';
import { runFactCheck } from '../../src/server/gavelCore';

const MAX_CLAIM_LEN = 1000;
const HOURLY_LIMIT = 15;

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'method not allowed' });
  const user = await userFromToken(event.headers.authorization || event.headers.Authorization);
  if (!user) return json(401, { error: 'invalid session' });

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

    const result = await runFactCheck(claim);
    const { data, error } = await supabaseAdmin.from('fact_checks').insert({
      debate_id: debateId, requested_by: user.id, claim, source: 'manual',
      verdict: result.verdict, confidence: result.confidence, confidence_pct: result.confidence_pct, explanation: result.explanation, sources: result.sources,
    }).select().single();
    if (error) return json(500, { error: 'could not save the verdict' });
    return json(200, { factCheck: data });
  } catch (err: any) {
    console.error('gavel-factcheck error:', err?.message ?? err);
    return json(500, { error: 'Gavel is temporarily unavailable. Please try again.' });
  }
};

function safeBody(raw: string | null): any { try { return raw ? JSON.parse(raw) : {}; } catch { return {}; } }
function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}
