// =====================================================================
// The Rostrum · netlify/functions/gavel-stream.ts
// TRUE streaming for Gavel's text tools (Netlify v2 streaming function).
// Uses the same prompt builder + effort/budget routing as gavel-assist so
// streamed and buffered answers are identical. Requires ANTHROPIC_API_KEY.
// =====================================================================
import { userFromToken } from '../../src/server/supabaseAdmin';
import { buildAssistPrompt, assistRequestConfig, needsFreshEvidence, type GavelMode } from '../../src/server/gavelCore';
import { selectDomains } from '../../src/server/gavelSources';
import { requirePro } from '../../src/server/proAccess';

const MODES = new Set(['quick', 'detailed', 'deep']);
const WEB_TOOL_VERSIONS = ['web_search_20260318', 'web_search_20260209', 'web_search_20250305'];
let effortSupported = true;   // self-healing: flips off once if the API rejects it
let webToolIdx = 0;
let webToolSupported = true;

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  const user = await userFromToken(req.headers.get('authorization'));
  if (!user) return new Response('unauthorized', { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return new Response('Gavel is not configured (missing ANTHROPIC_API_KEY).', { status: 503 });

  // PAID FEATURE — enforced server-side, not just in the UI.
  const gate = await requirePro(user.id);
  if (!gate.ok) return new Response(gate.reason, { status: 402 });

  const body = await req.json().catch(() => ({} as any));
  const tool = String(body.tool || 'chat');
  const mode = (MODES.has(String(body.mode)) ? String(body.mode) : 'quick') as GavelMode;
  if ((tool === 'chat' || tool === 'explain') && !String(body.question || '').trim()) {
    return new Response('enter a claim or question', { status: 400 });
  }

  const { system, user: userMsg } = buildAssistPrompt(tool, {
    transcript: String(body.transcript || '').slice(0, 8000),
    topic: String(body.topic || '').slice(0, 400),
    question: String(body.question || '').slice(0, 1000),
    mode,
  });
  const cfg = assistRequestConfig(tool, mode);
  const subject = [String(body.question || ''), String(body.topic || '')].filter(Boolean).join(' ');
  const domains = cfg.webUses ? selectDomains(subject, { fresh: needsFreshEvidence(subject) }) : [];

  const call = (withEffort: boolean, withWeb: boolean, withDomains: boolean) => fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-5', max_tokens: cfg.maxTokens, system, stream: true,
      ...(withEffort ? { effort: cfg.effort } : {}),
      ...(withWeb && cfg.webUses
        ? { tools: [{
            type: WEB_TOOL_VERSIONS[webToolIdx], name: 'web_search', max_uses: cfg.webUses,
            ...(withDomains && domains.length ? { allowed_domains: domains } : {}),
          }] }
        : {}),
      messages: [{ role: 'user', content: userMsg }],
    }),
  });

  let useWeb = webToolSupported && !!cfg.webUses;
  let useDomains = true;
  let upstream = await call(effortSupported, useWeb, useDomains);
  while (upstream.status === 400) {
    const errBody = await upstream.text().catch(() => '');
    if (useWeb && useDomains && /domain/i.test(errBody)) {
      useDomains = false;
      upstream = await call(effortSupported, useWeb, false);
      continue;
    }
    if (useWeb && /web_search|tools?\b/i.test(errBody)) {
      if (webToolIdx < WEB_TOOL_VERSIONS.length - 1) webToolIdx++;
      else { webToolSupported = false; useWeb = false; }
      upstream = await call(effortSupported, useWeb, useDomains);
      continue;
    }
    if (effortSupported && /effort/i.test(errBody)) {
      effortSupported = false;
      upstream = await call(false, useWeb, useDomains);
      continue;
    }
    return new Response(`Gavel request rejected: ${errBody.slice(0, 160)}`, { status: 502 });
  }
  if (!upstream.ok || !upstream.body) return new Response(`Gavel unavailable (${upstream.status})`, { status: 502 });

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) { controller.close(); return; }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith('data:')) continue;
        const data = t.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        try {
          const obj = JSON.parse(data);
          if (obj.type === 'content_block_delta' && obj.delta?.type === 'text_delta' && obj.delta.text) {
            controller.enqueue(encoder.encode(obj.delta.text));
          }
        } catch { /* partial/non-JSON line — ignore */ }
      }
    },
    cancel() { try { reader.cancel(); } catch { /* ignore */ } },
  });

  return new Response(stream, {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-cache', 'x-content-type-options': 'nosniff' },
  });
};
