// =====================================================================
// The Rostrum · src/components/GavelPanel.tsx
// Gavel — the academic fact-checker. Submit a claim; Gavel checks it
// against real scholarly sources and posts a neutral verdict visible to
// the whole room.
// =====================================================================
import { useEffect, useState } from 'react';
import { requestFactCheck, listFactChecks, type FactCheck } from '../lib/gavel';
import { C, ui, mono, display, a } from '../lib/theme';

const VERDICT: Record<string, { label: string; color: string; bg: string }> = {
  Supported:   { label: 'Supported',              color: '#4FC2A7', bg: a('#2E9E86', '1A') },
  Refuted:     { label: 'Refuted',                color: '#E86A6A', bg: a('#C0392B', '1A') },
  Contested:   { label: 'Contested',              color: '#E5B567', bg: a('#C9972F', '1A') },
  Unsupported: { label: 'Unsupported by sources', color: '#8A93A0', bg: a('#8A93A0', '14') },
  NotFactual:  { label: 'Not a factual claim',    color: '#8A93A0', bg: a('#8A93A0', '14') },
  Error:       { label: 'Error',                  color: '#8A93A0', bg: a('#8A93A0', '14') },
};

const ago = (iso: string) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'now'; if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`; return `${Math.floor(s / 86400)}d`;
};

export function GavelPanel({ debateId }: { debateId: string }) {
  const [claim, setClaim] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [checks, setChecks] = useState<FactCheck[]>([]);

  const load = () => { listFactChecks(debateId).then(setChecks).catch(() => {}); };
  useEffect(load, [debateId]);

  async function submit() {
    const c = claim.trim();
    if (!c || busy) return;
    setBusy(true); setErr('');
    try {
      const fc = await requestFactCheck(debateId, c);
      setChecks(prev => [fc, ...prev]);
      setClaim('');
    } catch (e: any) { setErr(e?.message ?? 'Fact-check failed'); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ fontFamily: ui, fontSize: 12, color: C.faint, lineHeight: 1.5, marginBottom: 12 }}>
        Paste a claim your opponent made. Gavel checks it against real academic sources and posts an impartial verdict for the whole room to see.
      </div>

      {/* composer */}
      <div style={{ marginBottom: 14 }}>
        <textarea value={claim} onChange={e => setClaim(e.target.value)} rows={3} maxLength={1000}
          placeholder="e.g. Minimum wage increases always cause higher unemployment."
          style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, resize: 'vertical',
            background: C.panel2, border: `1px solid ${C.hair}`, color: C.ink, fontFamily: ui, fontSize: 13, outline: 'none' }} />
        {err && <div style={{ fontFamily: ui, fontSize: 11.5, color: '#E86A6A', marginTop: 6 }}>{err}</div>}
        <button onClick={submit} disabled={busy || !claim.trim()}
          style={{ width: '100%', marginTop: 8, padding: '10px', borderRadius: 10, border: 'none',
            cursor: busy || !claim.trim() ? 'default' : 'pointer', fontFamily: ui, fontSize: 13, fontWeight: 700, color: '#fff',
            opacity: busy || !claim.trim() ? 0.5 : 1, background: `linear-gradient(135deg, ${C.gold}, ${C.cyan})` }}>
          {busy ? '⚖️ Gavel is checking…' : '⚖️ Check with Gavel'}
        </button>
      </div>

      {/* verdict feed */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {checks.length === 0 && (
          <div style={{ fontFamily: ui, fontSize: 12.5, color: C.faint, textAlign: 'center', padding: '20px 0' }}>
            No fact-checks yet. Be the first to put a claim to the test.
          </div>
        )}
        {checks.map(fc => <VerdictCard key={fc.id} fc={fc} />)}
      </div>
    </div>
  );
}

function VerdictCard({ fc }: { fc: FactCheck }) {
  const v = VERDICT[fc.verdict] ?? VERDICT.Error;
  return (
    <div style={{ borderRadius: 12, background: C.panel, border: `1px solid ${C.hair}`, padding: '12px 13px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: ui, fontSize: 10.5, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase',
          padding: '3px 9px', borderRadius: 999, color: v.color, background: v.bg, border: `1px solid ${a(v.color, '44')}` }}>
          {v.label}
        </span>
        {fc.confidence && (
          <span style={{ fontFamily: mono, fontSize: 10, color: C.faint }}>· {fc.confidence} confidence</span>
        )}
        <span style={{ marginLeft: 'auto', fontFamily: mono, fontSize: 10, color: C.faint }}>
          {fc.requester?.display_name ?? 'Someone'} · {ago(fc.created_at)}
        </span>
      </div>

      <div style={{ fontFamily: display, fontSize: 13.5, fontWeight: 600, color: C.ink, lineHeight: 1.4, marginBottom: 6 }}>
        “{fc.claim}”
      </div>
      {fc.explanation && (
        <div style={{ fontFamily: ui, fontSize: 12.5, color: C.dim, lineHeight: 1.55 }}>{fc.explanation}</div>
      )}

      {fc.sources.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${a(C.hair, '80')}` }}>
          <div style={{ fontFamily: ui, fontSize: 9.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: C.faint, marginBottom: 7 }}>
            Sources ({fc.sources.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {fc.sources.map((s, i) => (
              <a key={i} href={s.url || undefined} target="_blank" rel="noopener noreferrer"
                style={{ textDecoration: 'none', display: 'block' }}>
                <div style={{ fontFamily: ui, fontSize: 12, color: s.url ? C.cyan : C.dim, lineHeight: 1.35 }}>{s.title}</div>
                <div style={{ fontFamily: mono, fontSize: 10, color: C.faint, marginTop: 1 }}>
                  {s.authors}{s.year ? ` · ${s.year}` : ''}{s.journal ? ` · ${s.journal}` : ''} · cited {s.citations}×
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
