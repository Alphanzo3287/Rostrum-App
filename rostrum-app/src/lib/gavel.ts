// =====================================================================
// The Rostrum · src/lib/gavel.ts
// Client access to Gavel, the academic fact-checker.
// =====================================================================
import { supabase } from './supabaseClient';

export interface FactSource {
  title: string; year: number | null; authors: string; journal: string; citations: number; url: string;
  kind?: 'web' | 'academic';
  published?: string;
}
export interface FactCheck {
  id: string;
  debate_id: string;
  requested_by: string | null;
  claim: string;
  verdict: 'Supported' | 'Refuted' | 'Contested' | 'Unsupported' | 'NotFactual' | 'Error';
  confidence: 'low' | 'medium' | 'high' | null;
  confidence_pct?: number | null;
  explanation: string | null;
  sources: FactSource[];
  source?: 'manual' | 'auto';
  created_at: string;
  requester?: { display_name: string; handle: string } | null;
}

export type GavelTool = 'chat' | 'summarize' | 'fallacies' | 'steelman' | 'rebuttal' | 'context' | 'explain';
export type GavelMode = 'quick' | 'detailed' | 'deep';

/** Ask Gavel about the live debate, or run a debate tool over the transcript. */
export async function askGavel(input: { tool: GavelTool; question?: string; transcript?: string; topic?: string; mode?: GavelMode }): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('not authenticated');
  const res = await fetch('/.netlify/functions/gavel-assist', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(input),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? 'Gavel could not respond');
  return body.answer as string;
}

/** Retrieval only — real scholarly sources for a claim or topic (no verdict). */
export async function findSourcesFor(query: string, topic?: string): Promise<FactSource[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('not authenticated');
  const res = await fetch('/.netlify/functions/gavel-assist', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ tool: 'sources', question: query, topic }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? 'Gavel could not find sources');
  return (body.sources ?? []) as FactSource[];
}

/** Streamed version of askGavel — calls onToken as text arrives (ChatGPT-style). */
export async function askGavelStream(
  input: { tool: GavelTool; question?: string; transcript?: string; topic?: string; mode?: GavelMode },
  onToken: (chunk: string) => void,
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('not authenticated');
  const res = await fetch('/.netlify/functions/gavel-stream', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(input),
  });
  if (!res.ok || !res.body) throw new Error('Gavel could not respond');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    if (chunk) onToken(chunk);
  }
}

/** Submit a claim to Gavel. Returns the stored verdict (also visible to the room). */
export async function requestFactCheck(debateId: string, claim: string): Promise<FactCheck> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('not authenticated');
  const res = await fetch('/.netlify/functions/gavel-factcheck', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ debateId, claim }),
  });
  // A non-JSON body means the platform killed the function (timeout/crash)
  // rather than our code returning an error — say so, don't show a bare string.
  const raw = await res.text();
  let body: any = {};
  try { body = JSON.parse(raw); } catch { /* platform error page */ }
  if (!res.ok) {
    if (body?.error) throw new Error(body.error);
    if (res.status === 504 || res.status === 502 || /timed? ?out/i.test(raw)) {
      throw new Error('Gavel took too long and the request was cut off. Try Quick mode or a shorter claim.');
    }
    throw new Error(`Gavel failed (${res.status}). Please try again.`);
  }
  return body.factCheck as FactCheck;
}

/** All verdicts for a debate, newest first (public to everyone in the room). */
export async function listFactChecks(debateId: string): Promise<FactCheck[]> {
  const { data, error } = await supabase.from('fact_checks')
    .select('*, requester:profiles!fact_checks_requested_by_fkey(display_name, handle)')
    .eq('debate_id', debateId).order('created_at', { ascending: false }).limit(50);
  if (error) throw error;
  return (data ?? []) as any as FactCheck[];
}

/** Fire an auto-extract pass over recent transcript. Server bounds cost per debate. */
export async function autoExtractCheck(debateId: string, transcript: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  await fetch('/.netlify/functions/gavel-extract', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ debateId, transcript }),
  }).catch(() => {});
}

/** Live-subscribe to new verdicts in a debate (manual or auto, from anyone). */
export function subscribeFactChecks(debateId: string, onInsert: (fc: FactCheck) => void, key = 'feed') {
  const ch = supabase.channel(`factchecks:${debateId}:${key}`)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'fact_checks', filter: `debate_id=eq.${debateId}` },
      (payload) => onInsert(payload.new as any as FactCheck))
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
