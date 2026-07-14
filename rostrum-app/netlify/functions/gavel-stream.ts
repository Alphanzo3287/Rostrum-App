// =====================================================================
// The Rostrum · netlify/functions/gavel-stream.ts
// TRUE streaming for Gavel's text tools. A Netlify v2 streaming function
// that opens an Anthropic SSE stream and forwards the text deltas to the
// browser token-by-token (ChatGPT-style). If a runtime buffers the
// response, it still arrives correctly — just not incrementally.
// Requires env: ANTHROPIC_API_KEY.
// =====================================================================
import { userFromToken } from '../../src/server/supabaseAdmin';
import { buildAssistPrompt } from '../../src/server/gavelCore';

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  const user = await userFromToken(req.headers.get('authorization'));
  if (!user) return new Response('unauthorized', { status: 401 });

  const body = await req.json().catch(() => ({} as any));
  const tool = String(body.tool || 'chat');
  const { system, user: userMsg } = buildAssistPrompt(tool, {
    transcript: String(body.transcript || '').slice(0, 8000),
    topic: String(body.topic || '').slice(0, 400),
    question: String(body.question || '').slice(0, 1000),
  });
  if ((tool === 'chat' || tool === 'explain') && !String(body.question || '').trim()) {
    return new Response('enter a claim or question', { status: 400 });
  }

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 600, system, stream: true, messages: [{ role: 'user', content: userMsg }] }),
  });
  if (!upstream.ok || !upstream.body) return new Response('gavel unavailable', { status: 502 });

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
      buffer = lines.pop() || '';                    // keep the partial last line
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
