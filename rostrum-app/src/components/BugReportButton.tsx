// =====================================================================
// The Rostrum · src/components/BugReportButton.tsx
// Small floating "Report a bug" button + quick submission modal.
// =====================================================================
import { useState } from 'react';
import { submitBugReport } from '../lib/reports';
import { useDraggable, bottomRight } from '../lib/useDraggable';
import { C, ui, display, solidGold } from '../lib/theme';

export function BugReportButton() {
  const { pos, onPointerDown, wasDragged } = useDraggable('rostrum.bugfab', bottomRight(96));
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  async function send() {
    if (!body.trim()) { setErr('Please describe the bug.'); return; }
    setBusy(true); setErr('');
    try { await submitBugReport(body.trim()); setDone(true); setBody(''); }
    catch (e: any) { setErr(e?.message ?? 'Could not send. Please try again.'); }
    finally { setBusy(false); }
  }
  function close() { setOpen(false); setDone(false); setErr(''); }

  return (
    <>
      <button onPointerDown={onPointerDown} onClick={() => { if (!wasDragged()) setOpen(true); }} title="Report a bug (drag to move)"
        style={{
          position: 'fixed', left: pos.x, top: pos.y, zIndex: 50, display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 15px', borderRadius: 999, cursor: 'grab', touchAction: 'none', fontFamily: ui, fontSize: 13, fontWeight: 700,
          color: C.ink, background: C.panel, border: `1px solid ${C.hair}`, boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
        }}>
        <span style={{ fontSize: 15 }}>🐞</span> Bug
      </button>

      {open && (
        <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.55)',
          display: 'grid', placeItems: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 'min(460px, 100%)', background: C.panel,
            border: `1px solid ${C.hair}`, borderRadius: 18, padding: 22, boxShadow: '0 30px 80px rgba(0,0,0,0.5)' }}>
            {done ? (
              <div style={{ textAlign: 'center', padding: '10px 0' }}>
                <div style={{ fontSize: 34 }}>✅</div>
                <div style={{ fontFamily: display, fontSize: 20, fontWeight: 700, color: C.ink, margin: '10px 0 6px' }}>Thank you!</div>
                <p style={{ fontFamily: ui, fontSize: 13.5, color: C.dim, lineHeight: 1.55, margin: '0 0 18px' }}>
                  Your report was sent. We'll investigate and work on a fix.
                </p>
                <button onClick={close} style={{ ...solidGold }}>Done</button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
                  <span style={{ fontSize: 20 }}>🐞</span>
                  <h3 style={{ fontFamily: display, fontSize: 20, fontWeight: 700, color: C.ink, margin: 0 }}>Report a bug</h3>
                </div>
                <p style={{ fontFamily: ui, fontSize: 13, color: C.faint, lineHeight: 1.5, margin: '0 0 14px' }}>
                  Tell us what went wrong. The page you're on is included automatically.
                </p>
                <textarea value={body} onChange={e => setBody(e.target.value)} autoFocus
                  placeholder="What happened? What did you expect?"
                  style={{ width: '100%', minHeight: 120, resize: 'vertical', boxSizing: 'border-box', padding: '12px 14px',
                    borderRadius: 12, border: `1px solid ${C.hair}`, background: C.base2, color: C.ink,
                    fontFamily: ui, fontSize: 14, lineHeight: 1.5, outline: 'none' }} />
                {err && <div style={{ fontFamily: ui, fontSize: 12.5, color: C.garnetHi, marginTop: 8 }}>{err}</div>}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
                  <button onClick={close} style={{ padding: '10px 16px', borderRadius: 11, cursor: 'pointer',
                    background: 'transparent', border: `1px solid ${C.hair}`, color: C.dim, fontFamily: ui, fontSize: 13.5, fontWeight: 600 }}>
                    Cancel
                  </button>
                  <button onClick={send} disabled={busy || !body.trim()}
                    style={{ ...solidGold, opacity: (busy || !body.trim()) ? 0.6 : 1 }}>
                    {busy ? 'Sending…' : 'Send report'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
