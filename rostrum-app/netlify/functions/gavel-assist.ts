// =====================================================================
// The Rostrum · netlify/functions/gavel-assist.ts
// Gavel's debate-aware assistant: answers questions about THIS debate and
// runs debate tools (summarize, fallacies, steelman, rebuttal, context)
// over the live transcript. Not a fact-check — no verdict, no DB write.
// Requires env: ANTHROPIC_API_KEY.
// =====================================================================
import type { Handler } from '@netlify/functions';
import { userFromToken } from '../../src/server/supabaseAdmin';
import { assist, findSources } from '../../src/server/gavelCore';

const TOOLS = new Set(['chat', 'summarize', 'fallacies', 'steelman', 'rebuttal', 'context', 'explain']);

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'method not allowed' });
  const user = await userFromToken(event.headers.authorization || event.headers.Authorization);
  if (!user) return json(401, { error: 'invalid session' });

  const body = safeBody(event.body);
  const rawTool = String(body.tool || 'chat');
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
    const answer = await assist(tool, { transcript, topic, question });
    return json(200, { answer });
  } catch (err: any) {
    console.error('gavel-assist error:', err?.message ?? err);
    return json(500, { error: 'Gavel is temporarily unavailable. Please try again.' });
  }
};

function safeBody(raw: string | null): any { try { return raw ? JSON.parse(raw) : {}; } catch { return {}; } }
function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}
