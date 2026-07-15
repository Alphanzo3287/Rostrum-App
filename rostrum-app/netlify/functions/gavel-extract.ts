// =====================================================================
// The Rostrum · netlify/functions/gavel-extract.ts
// Auto-extract: given a slice of the live transcript, pull the most
// check-worthy claim and fact-check it automatically. Verdicts land in
// the same public feed, marked source='auto'.
//
// Cost/abuse is bounded by a PER-DEBATE cooldown (server-enforced), so it
// doesn't matter how many viewers toggle auto-check on.
// Requires env: ANTHROPIC_API_KEY.
// =====================================================================
import type { Handler } from '@netlify/functions';
import { supabaseAdmin, userFromToken } from '../../src/server/supabaseAdmin';
import { runFactCheck, extractClaimFromTranscript } from '../../src/server/gavelCore';
import { requirePro } from '../../src/server/proAccess';

const COOLDOWN_MS = 35_000;   // at most one auto-check per debate per 35s

export const handler: Handler = async (event) => {
  const t0 = Date.now();
  const elapsed = () => Date.now() - t0;
  if (event.httpMethod !== 'POST') return json(405, { error: 'method not allowed' });
  const user = await userFromToken(event.headers.authorization || event.headers.Authorization);
  if (!user) return json(401, { error: 'invalid session' });

  const body = safeBody(event.body);
  const debateId = String(body.debateId || '');
  const transcript = String(body.transcript || '').trim();
  if (!debateId) return json(400, { error: 'debateId required' });
  if (transcript.length < 40) return json(200, { skipped: 'not enough transcript yet' });

  try {
    // Auto-check runs on the toggler's behalf — same paid gate. Run it
    // CONCURRENTLY with the cooldown read; both are independent DB round-trips
    // and this function shares the same ~10s ceiling.
    const since = new Date(Date.now() - COOLDOWN_MS).toISOString();
    const [gate, cool] = await Promise.all([
      requirePro(user.id),
      supabaseAdmin.from('fact_checks')
        .select('id', { count: 'exact', head: true })
        .eq('debate_id', debateId).eq('source', 'auto').gte('created_at', since),
    ]);
    if (!gate.ok) return json(402, { error: gate.reason, upgrade: true });
    if ((cool.count ?? 0) > 0) return json(200, { skipped: 'cooldown' });

    const claim = await extractClaimFromTranscript(transcript);
    if (!claim) return json(200, { skipped: 'no check-worthy claim' });

    // Don't re-check a claim we already auto-checked recently in this debate.
    const recentSince = new Date(Date.now() - 10 * 60_000).toISOString();
    const { data: recent } = await supabaseAdmin.from('fact_checks')
      .select('claim').eq('debate_id', debateId).eq('source', 'auto').gte('created_at', recentSince).limit(20);
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    if ((recent ?? []).some(r => norm(r.claim) === norm(claim))) return json(200, { skipped: 'duplicate' });

    // Only the time genuinely left: this path also spends a call extracting
    // the claim before the pipeline runs.
    const result = await runFactCheck(claim, { deadlineMs: Math.max(4000, 8500 - elapsed() - 500) });
    const { data, error } = await supabaseAdmin.from('fact_checks').insert({
      debate_id: debateId, requested_by: null, claim, source: 'auto',
      verdict: result.verdict, confidence: result.confidence, confidence_pct: result.confidence_pct, explanation: result.explanation, sources: result.sources,
    }).select().single();
    if (error) return json(500, { error: 'could not save the verdict' });
    return json(200, { factCheck: data });
  } catch (err: any) {
    console.error('gavel-extract error:', err?.message ?? err);
    return json(200, { skipped: 'error' });   // auto path fails silently
  }
};

function safeBody(raw: string | null): any { try { return raw ? JSON.parse(raw) : {}; } catch { return {}; } }
function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}
