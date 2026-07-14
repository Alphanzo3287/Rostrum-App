// =====================================================================
// The Rostrum · src/components/GavelWidget.tsx
// The conversational face of Gavel: a chat feed with the mascot beside its
// messages, verdict cards with a confidence meter, debate-aware tools, and
// live auto-verdicts injected as they land.
// =====================================================================
import { useEffect, useRef, useState } from 'react';
import { requestFactCheck, askGavelStream, findSourcesFor, subscribeFactChecks, type FactCheck, type FactSource, type GavelTool, type GavelMode } from '../lib/gavel';
import { GavelMascot } from './GavelMascot';
import { C, ui, mono, display, a } from '../lib/theme';

type Msg =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'gavel'; kind: 'text'; text: string }
  | { id: string; role: 'gavel'; kind: 'progress'; text: string }
  | { id: string; role: 'gavel'; kind: 'sources'; sources: FactSource[] }
  | { id: string; role: 'gavel'; kind: 'verdict'; fc: FactCheck; note?: string };

const uid = () => Math.random().toString(36).slice(2);
const VC: Record<string, string> = { Supported: '#4FC2A7', Refuted: '#E86A6A', Contested: '#E5B567', Unsupported: '#8A93A0', NotFactual: '#8A93A0', Error: '#8A93A0' };

type Action = { tool: GavelTool | 'sources'; label: string; icon: string; mode: 'text' | 'explain' | 'sources' };
const TOOLS: Action[] = [
  { tool: 'summarize', label: 'Summarize', icon: '📄', mode: 'text' },
  { tool: 'fallacies', label: 'Fallacies', icon: '🧠', mode: 'text' },
  { tool: 'steelman', label: 'Steelman', icon: '🎯', mode: 'text' },
  { tool: 'rebuttal', label: 'Rebuttal', icon: '💥', mode: 'text' },
  { tool: 'context', label: 'Context', icon: '📚', mode: 'text' },
  { tool: 'explain', label: 'Explain', icon: '💡', mode: 'explain' },
  { tool: 'sources', label: 'Find Sources', icon: '🔎', mode: 'sources' },
];

export function GavelWidget({ debateId, getTranscript, topic }: {
  debateId: string; getTranscript: () => string; topic?: string;
}) {
  const [messages, setMessages] = useState<Msg[]>([
    { id: 'w', role: 'gavel', kind: 'text', text: "Hello, I'm Gavel — your impartial fact-checker. Enter a claim to check it against real academic sources, or use a tool to summarize the debate, spot fallacies, and more." },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<GavelMode>('quick');
  const [mascot, setMascot] = useState<'idle' | 'thinking' | 'happy' | 'unsure' | 'error'>('idle');
  const feedRef = useRef<HTMLDivElement>(null);

  const add = (m: Msg) => setMessages(p => [...p, m]);
  const remove = (id: string) => setMessages(p => p.filter(m => m.id !== id));
  const settle = (s: typeof mascot) => { setMascot(s); setTimeout(() => setMascot('idle'), 4000); };

  useEffect(() => { feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' }); }, [messages]);

  // Inject auto-flagged verdicts into the conversation as they arrive.
  useEffect(() => subscribeFactChecks(debateId, fc => {
    if (fc.source === 'auto') add({ id: fc.id, role: 'gavel', kind: 'verdict', fc, note: 'Auto-flagged from the live debate' });
  }, 'widget'), [debateId]);

  async function factCheck(claim: string) {
    if (!claim.trim() || busy) return;
    add({ id: uid(), role: 'user', text: claim });
    setInput(''); setBusy(true); setMascot('thinking');
    const pid = uid(); add({ id: pid, role: 'gavel', kind: 'progress', text: 'Searching academic sources…' });
    try {
      const fc = await requestFactCheck(debateId, claim);
      remove(pid); add({ id: fc.id, role: 'gavel', kind: 'verdict', fc });
      settle(fc.verdict === 'Supported' || fc.verdict === 'Refuted' ? 'happy' : 'unsure');
    } catch (e: any) {
      remove(pid); add({ id: uid(), role: 'gavel', kind: 'text', text: e?.message ?? 'Gavel could not check that.' }); settle('error');
    } finally { setBusy(false); }
  }

  async function runAction(a: Action) {
    if (busy) return;
    if (a.mode === 'sources') return runSources();
    if (a.mode === 'explain') {
      if (!input.trim()) { setInput(''); add({ id: uid(), role: 'gavel', kind: 'text', text: 'Type a claim in the box first, then tap Explain.' }); return; }
      return runText(a.tool as GavelTool, `Explain: "${input.trim()}"`, input.trim());
    }
    return runText(a.tool as GavelTool, a.label);
  }

  // Streamed text response (ChatGPT-style token-by-token).
  async function runText(tool: GavelTool, label: string, question?: string) {
    add({ id: uid(), role: 'user', text: label });
    setBusy(true); setMascot('thinking');
    const mid = uid(); add({ id: mid, role: 'gavel', kind: 'text', text: '' });
    let acc = '';
    try {
      await askGavelStream({ tool, question, transcript: getTranscript(), topic, mode }, chunk => {
        acc += chunk;
        setMessages(p => p.map(m => (m.id === mid && m.role === 'gavel' && m.kind === 'text' ? { ...m, text: acc } : m)));
      });
      if (!acc.trim()) setMessages(p => p.map(m => (m.id === mid && m.role === 'gavel' && m.kind === 'text' ? { ...m, text: 'Gavel had nothing to add on that.' } : m)));
      settle('happy');
    } catch (e: any) {
      setMessages(p => p.map(m => (m.id === mid && m.role === 'gavel' && m.kind === 'text' ? { ...m, text: e?.message ?? 'Gavel could not respond.' } : m)));
      settle('error');
    } finally { setBusy(false); }
  }

  async function runSources() {
    const q = input.trim() || topic || '';
    if (!q) { add({ id: uid(), role: 'gavel', kind: 'text', text: 'Type a claim or topic to find sources for.' }); return; }
    add({ id: uid(), role: 'user', text: `Find sources: ${input.trim() || topic}` });
    setBusy(true); setMascot('thinking');
    const pid = uid(); add({ id: pid, role: 'gavel', kind: 'progress', text: 'Searching academic sources…' });
    try {
      const sources = await findSourcesFor(q, topic);
      remove(pid);
      if (sources.length === 0) { add({ id: uid(), role: 'gavel', kind: 'text', text: 'No scholarly sources found for that query.' }); settle('unsure'); }
      else { add({ id: uid(), role: 'gavel', kind: 'sources', sources }); settle('happy'); }
    } catch (e: any) {
      remove(pid); add({ id: uid(), role: 'gavel', kind: 'text', text: e?.message ?? 'Gavel could not find sources.' }); settle('error');
    } finally { setBusy(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', flex: 1, minHeight: 0, minWidth: 0, width: '100%' }}>
      {/* tools */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', minWidth: 0, paddingBottom: 10, marginBottom: 4 }}>
        {TOOLS.map(t => (
          <button key={t.tool} onClick={() => runAction(t)} disabled={busy}
            style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: 999,
              border: `1px solid ${C.hair}`, background: C.panel2, color: C.dim, cursor: busy ? 'default' : 'pointer',
              fontFamily: ui, fontSize: 12.5, fontWeight: 600, opacity: busy ? 0.5 : 1, whiteSpace: 'nowrap' }}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* conversation */}
      <div ref={feedRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12, paddingRight: 2 }}>
        {messages.map(m => m.role === 'user'
          ? (
            <div key={m.id} style={{ alignSelf: 'flex-end', maxWidth: '85%', minWidth: 0, padding: '9px 13px', borderRadius: '14px 14px 4px 14px',
              background: a('#7C3AED', 'E6'), color: '#fff', fontFamily: ui, fontSize: 14, lineHeight: 1.5, overflowWrap: 'anywhere' }}>{m.text}</div>
          ) : (
            <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', maxWidth: '100%', minWidth: 0 }}>
              <GavelMascot state="avatar" size={42} />
              <div style={{ flex: 1, minWidth: 0 }}>
                {m.kind === 'text' && <Bubble><span style={{ whiteSpace: 'pre-wrap' }}>{m.text || '…'}</span></Bubble>}
                {m.kind === 'progress' && <Bubble><span style={{ color: C.faint }}>{m.text}</span></Bubble>}
                {m.kind === 'sources' && <SourcesBubble sources={m.sources} />}
                {m.kind === 'verdict' && <VerdictBubble fc={m.fc} note={m.note} />}
              </div>
            </div>
          ))}
      </div>

      {/* response mode + input */}
      <div style={{ display: 'flex', gap: 5, marginTop: 12, marginBottom: 8 }}>
        {([['quick', 'Quick', '~250 words'], ['detailed', 'Detailed', '400–600 words'], ['deep', 'Deep', '800–1200 words']] as [GavelMode, string, string][]).map(([m, label, hint]) => (
          <button key={m} onClick={() => setMode(m)} title={hint}
            style={{ flex: 1, padding: '6px 0', borderRadius: 8, cursor: 'pointer',
              border: `1px solid ${mode === m ? a(C.cyan, '66') : C.hair}`,
              background: mode === m ? a(C.cyan, '16') : 'transparent',
              color: mode === m ? C.cyan : C.faint, fontFamily: ui, fontSize: 11, fontWeight: 700 }}>
            {label}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') factCheck(input); }}
          placeholder="Enter a claim to fact-check…" disabled={busy}
          style={{ flex: 1, minWidth: 0, padding: '11px 13px', borderRadius: 12, background: C.panel2, border: `1px solid ${C.hair}`,
            color: C.ink, fontFamily: ui, fontSize: 14, outline: 'none' }} />
        <button onClick={() => factCheck(input)} disabled={busy || !input.trim()} aria-label="Send"
          style={{ width: 44, borderRadius: 12, border: 'none', cursor: busy || !input.trim() ? 'default' : 'pointer',
            opacity: busy || !input.trim() ? 0.5 : 1, color: '#fff', background: `linear-gradient(135deg, ${C.gold}, ${C.cyan})`, display: 'grid', placeItems: 'center' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
        </button>
      </div>
      <div style={{ fontFamily: ui, fontSize: 9.5, color: C.faint, textAlign: 'center', marginTop: 6 }}>
        Impartial · grounded in academic sources · <span style={{ color: mascot === 'thinking' ? C.gold : C.faint }}>{mascot === 'thinking' ? 'working…' : 'ready'}</span>
      </div>
    </div>
  );
}

function Bubble({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '9px 13px', borderRadius: '14px 14px 14px 4px', background: C.panel, border: `1px solid ${C.hair}`,
      color: C.dim, fontFamily: ui, fontSize: 13.5, lineHeight: 1.55, minWidth: 0, overflowWrap: 'anywhere' }}>{children}</div>
  );
}

function VerdictBubble({ fc, note }: { fc: FactCheck; note?: string }) {
  const color = VC[fc.verdict] ?? '#8A93A0';
  const pct = fc.confidence_pct ?? (fc.confidence === 'high' ? 88 : fc.confidence === 'medium' ? 60 : fc.confidence === 'low' ? 28 : null);
  return (
    <div style={{ borderRadius: '14px 14px 14px 4px', background: C.panel, border: `1px solid ${a(color, '44')}`, padding: '11px 13px', minWidth: 0, overflowWrap: 'anywhere' }}>
      {note && <div style={{ fontFamily: ui, fontSize: 9.5, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: C.cyan, marginBottom: 6 }}>{note}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
        <span style={{ fontSize: 13 }}>⚖️</span>
        <span style={{ fontFamily: ui, fontSize: 10.5, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: C.faint }}>Verdict:</span>
        <span style={{ fontFamily: display, fontSize: 14, fontWeight: 800, color }}>{fc.verdict === 'NotFactual' ? 'Not a factual claim' : fc.verdict}</span>
      </div>
      {fc.explanation && <div style={{ fontFamily: ui, fontSize: 12.5, color: C.dim, lineHeight: 1.5 }}>{fc.explanation}</div>}

      {pct != null && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: ui, fontSize: 9.5, color: C.faint, marginBottom: 4 }}>
            <span>Confidence</span><span>{pct}% · {pct >= 75 ? 'High' : pct >= 45 ? 'Moderate' : 'Low'}</span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: C.panel2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, background: color }} />
          </div>
        </div>
      )}

      {fc.sources.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 9, borderTop: `1px solid ${a(C.hair, '80')}` }}>
          <div style={{ fontFamily: ui, fontSize: 9, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: C.faint, marginBottom: 6 }}>Sources ({fc.sources.length})</div>
          {fc.sources.map((s, i) => <SourceRow key={i} s={s} />)}
        </div>
      )}
    </div>
  );
}

function SourcesBubble({ sources }: { sources: FactSource[] }) {
  return (
    <div style={{ borderRadius: '14px 14px 14px 4px', background: C.panel, border: `1px solid ${C.hair}`, padding: '11px 13px', minWidth: 0, overflowWrap: 'anywhere' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        <span style={{ fontSize: 13 }}>🔎</span>
        <span style={{ fontFamily: ui, fontSize: 11, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: C.faint }}>
          {sources.length} scholarly source{sources.length === 1 ? '' : 's'}
        </span>
      </div>
      {sources.map((s, i) => <SourceRow key={i} s={s} />)}
    </div>
  );
}

/** One source row, badged by provenance so the room can see live-web vs scholarly. */
function SourceRow({ s }: { s: FactSource }) {
  const web = s.kind === 'web';
  const meta = web
    ? [s.authors, s.published].filter(Boolean).join(' · ')
    : `${s.authors}${s.year ? ` · ${s.year}` : ''}${s.journal ? ` · ${s.journal}` : ''} · cited ${s.citations}×`;
  return (
    <a href={s.url || undefined} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'block', marginBottom: 7 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
        <span style={{ fontSize: 10, flexShrink: 0 }} title={web ? 'Live web source' : 'Academic source'}>{web ? '🌐' : '📚'}</span>
        <span style={{ fontFamily: ui, fontSize: 11.5, color: s.url ? C.cyan : C.dim, lineHeight: 1.35, overflowWrap: 'anywhere' }}>{s.title}</span>
      </div>
      <div style={{ fontFamily: mono, fontSize: 9.5, color: C.faint, marginLeft: 15 }}>{meta}</div>
    </a>
  );
}
