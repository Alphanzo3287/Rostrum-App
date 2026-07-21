// =====================================================================
// The Rostrum · netlify/functions/gavel-selftest.ts
// Diagnostic endpoint. Open in a browser:
//   https://rostrums.site/.netlify/functions/gavel-selftest
//   https://rostrums.site/.netlify/functions/gavel-selftest?claim=your+claim
//
// It pings every source index Gavel uses and reports, per source, how many
// results came back and how long it took — so a retrieval failure is visible
// in seconds instead of hiding behind an "Unsupported" verdict.
// Reveals no secrets and never calls the paid model.
// =====================================================================
import type { Handler } from '@netlify/functions';
import { buildSearchQuery, retrieveEvidence } from '../../src/server/gavelRetrieval';
import { detectTopic } from '../../src/server/gavelSources';

const DEFAULT_CLAIM = "Academic scholars generally agree that the Qur'an was compiled during the lifetime of Muhammad";

export const handler: Handler = async (event) => {
  const claim = String(event.queryStringParameters?.claim || DEFAULT_CLAIM).slice(0, 500);
  const started = Date.now();

  try {
    const { evidence, diag, query } = await retrieveEvidence(claim, { limit: 6 });
    const totalMs = Date.now() - started;
    const reachable = diag.filter(d => !d.error).length;

    return json(200, {
      ok: evidence.length > 0,
      verdict_would_be: evidence.length > 0 ? 'a real fact-check' : 'the "no sources" card (retrieval empty)',
      claim,
      topic: detectTopic(claim),
      keyword_query: query,
      raw_query_would_have_been: claim,
      keywords_8: buildSearchQuery(claim, 8),
      keywords_4: buildSearchQuery(claim, 4),
      total_ms: totalMs,
      fits_netlify_10s_limit: totalMs < 6000,
      indexes_reachable: `${reachable}/${diag.length}`,
      per_source: diag,
      sources_found: evidence.length,
      sources: evidence.map(e => ({ kind: e.kind, title: e.title, year: e.year, journal: e.journal, url: e.url })),
      anthropic_key_present: !!process.env.ANTHROPIC_API_KEY,
    });
  } catch (err: any) {
    return json(500, { ok: false, error: String(err?.message || err), total_ms: Date.now() - started });
  }
};

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    body: JSON.stringify(body, null, 2),
  };
}
