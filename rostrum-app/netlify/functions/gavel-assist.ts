// =====================================================================
// The Rostrum · netlify/functions/gavel-assist.ts
// Gavel's debate-aware assistant: answers questions about THIS debate and
// runs debate tools (summarize, fallacies, steelman, rebuttal, context)
// over the live transcript. Not a fact-check — no verdict, no DB write.
// Requires env: ANTHROPIC_API_KEY.
// =====================================================================
import type { Handler } from '@netlify/functions';
import { userFromToken } from '../../src/server/supabaseAdmin';
import { assist, findSources, type GavelMode } from '../../src/server/gavelCore';
import { requirePro } from '../../src/server/proAccess';

const TOOLS = new Set(['chat', 'summarize', 'fallacies', 'steelman', 'rebuttal', 'context', 'explain']);
const MODES = new Set(['quick', 'detailed', 'deep']);

export const handler: Handler = async (event) => {
  const t0 = Date.now();   // wall clock — auth + the Pro gate spend real time
  if (event.httpMethod !== 'POST') return json(405, { error: 'method not allowed' });
  const user = await userFromToken(event.headers.authorization || event.headers.Authorization);
  if (!user) return json(401, { error: 'invalid session' });

  // PAID FEATURE — enforced server-side, not just in the UI.
  const gate = await requirePro(user.id);
  if (!gate.ok) return json(402, { error: gate.reason, upgrade: true });

  const body = safeBody(event.body);
  const rawTool = String(body.tool || 'chat');
  const mode = (MODES.has(String(body.mode)) ? String(body.mode) : 'quick') as GavelMode;
  const question = String(body.question || '').slice(0, 1000);
  const transcript = String(body.transcript || '').slice(0, 8000);
  const topic = String(body.topic || '').slice(0, 400);

  try {
    // Retrieval-only: return real scholarly sources for the query (or topic).
    if (rawTool === 'sources') {
      const q = (question.trim() || topic.trim());
      if (!q) return json(400, { error: 'enter a claim or topic to find sources for' });
      const sources = await findSources(q);
      return json(200, { sources });
    }

    const tool = TOOLS.has(rawTool) ? rawTool : 'chat';
    if ((tool === 'chat' || tool === 'explain') && !question.trim()) return json(400, { error: 'enter a claim or question' });
    const { answer, sources } = await assist(tool, { transcript, topic, question, mode,
      deadlineMs: Math.max(4000, 8500 - (Date.now() - t0)) });
    return json(200, { answer, sources });
  } catch (err: any) {
    const raw = String(err?.message ?? err);
    console.error('gavel-assist error:', raw, '| stack:', String(err?.stack ?? '').slice(0, 400));
    const msg = raw.startsWith('Gavel') ? raw : `Gavel hit an unexpected error: ${raw.slice(0, 180)}`;
    return json(503, { error: msg });
  }
};

function safeBody(raw: string | null): any { try { return raw ? JSON.parse(raw) : {}; } catch { return {}; } }
function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}
