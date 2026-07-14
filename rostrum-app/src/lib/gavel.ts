// =====================================================================
// The Rostrum · src/lib/gavel.ts
// Client access to Gavel, the academic fact-checker.
// =====================================================================
import { supabase } from './supabaseClient';

export interface FactSource {
  title: string; year: number | null; authors: string; journal: string; citations: number; url: string;
}
export interface FactCheck {
  id: string;
  debate_id: string;
  requested_by: string | null;
  claim: string;
  verdict: 'Supported' | 'Refuted' | 'Contested' | 'Unsupported' | 'NotFactual' | 'Error';
  confidence: 'low' | 'medium' | 'high' | null;
  explanation: string | null;
  sources: FactSource[];
  source?: 'manual' | 'auto';
  created_at: string;
  requester?: { display_name: string; handle: string } | null;
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
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? 'fact-check failed');
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
export function subscribeFactChecks(debateId: string, onInsert: (fc: FactCheck) => void) {
  const ch = supabase.channel(`factchecks:${debateId}`)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'fact_checks', filter: `debate_id=eq.${debateId}` },
      (payload) => onInsert(payload.new as any as FactCheck))
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
