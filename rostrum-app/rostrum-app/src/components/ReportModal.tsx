// =====================================================================
// The Rostrum · ReportModal.tsx
// Reusable "Report" button + modal. Drop it next to any user avatar,
// chat message, or debate card. No layout side-effects.
// =====================================================================
import { useState } from 'react';
import { C, ui, display } from '../lib/theme';
import { fileReport, type ReportTargetType, type ReportReason } from '../lib/api';

const REASONS: { value: ReportReason; label: string }[] = [
  { value: 'spam',                label: 'Spam or self-promotion' },
  { value: 'harassment',         label: 'Harassment or bullying' },
  { value: 'hate_speech',        label: 'Hate speech' },
  { value: 'misinformation',     label: 'Misinformation' },
  { value: 'impersonation',      label: 'Impersonation' },
  { value: 'inappropriate_content', label: 'Inappropriate content' },
  { value: 'other',              label: 'Other' },
];

interface Props {
  targetType: ReportTargetType;
  targetId: string;
  label?: string;       // button label override
  onClose?: () => void; // called after success
}

export function ReportModal({ targetType, targetId, label = '⚑ Report', onClose }: Props) {
  const [open, setOpen]       = useState(false);
  const [reason, setReason]   = useState<ReportReason>('spam');
  const [body, setBody]       = useState('');
  const [busy, setBusy]       = useState(false);
  const [done, setDone]       = useState(false);
  const [err, setErr]         = useState('');

  function close() { setOpen(false); setDone(false); setErr(''); setBody(''); onClose?.(); }

  async function submit() {
    setBusy(true); setErr('');
    try {
      await fileReport(targetType, targetId, reason, body || undefined);
      setDone(true);
    } catch (e: any) { setErr(e?.message ?? 'Something went wrong'); }
    finally { setBusy(false); }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        fontFamily: ui, fontSize: 12, color: C.faint, padding: '4px 8px',
        borderRadius: 6, transition: 'color .15s',
      }}
        onMouseEnter={e => (e.currentTarget.style.color = C.garnet)}
        onMouseLeave={e => (e.currentTarget.style.color = C.faint)}>
        {label}
      </button>

      {open && (
        <div style={{ position:'fixed', inset:0, zIndex:200, display:'grid', placeItems:'center',
          background:'rgba(0,0,0,0.7)', backdropFilter:'blur(6px)' }}
          onClick={e => { if (e.target === e.currentTarget) close(); }}>
          <div style={{ width: 420, borderRadius: 14, background: C.panel,
            border: `1px solid ${C.hair}`, padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}>

            {done ? (
              <div style={{ textAlign:'center', padding: '16px 0' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
                <div style={{ fontFamily: display, fontSize: 20, color: C.ink, marginBottom: 6 }}>Report received</div>
                <div style={{ fontFamily: ui, fontSize: 13, color: C.faint, marginBottom: 20 }}>
                  Our moderation team will review it shortly.
                </div>
                <button onClick={close} style={{ padding: '9px 22px', borderRadius: 8, background: C.gold,
                  color: '#000', fontFamily: ui, fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }}>
                  Done
                </button>
              </div>
            ) : (
              <>
                <div style={{ fontFamily: display, fontSize: 20, fontWeight: 700, color: C.ink, marginBottom: 16 }}>
                  Report {targetType.replace('_', ' ')}
                </div>

                <div style={{ fontFamily: ui, fontSize: 12, fontWeight: 700, color: C.dim,
                  textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Reason</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                  {REASONS.map(r => (
                    <label key={r.value} style={{ display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 12px', borderRadius: 8, cursor: 'pointer',
                      background: reason === r.value ? `${C.gold}18` : C.base,
                      border: `1px solid ${reason === r.value ? C.gold : C.hair}`,
                      transition: 'all .12s' }}>
                      <input type="radio" name="reason" value={r.value} checked={reason === r.value}
                        onChange={() => setReason(r.value)}
                        style={{ accentColor: C.gold }} />
                      <span style={{ fontFamily: ui, fontSize: 13, color: C.ink }}>{r.label}</span>
                    </label>
                  ))}
                </div>

                <div style={{ fontFamily: ui, fontSize: 12, fontWeight: 700, color: C.dim,
                  textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>
                  Additional details <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span>
                </div>
                <textarea value={body} onChange={e => setBody(e.target.value)} maxLength={1000}
                  placeholder="Describe what you saw…"
                  style={{ width: '100%', minHeight: 72, resize: 'vertical', padding: '9px 11px',
                    borderRadius: 8, border: `1px solid ${C.hair}`, background: C.base,
                    color: C.ink, fontFamily: ui, fontSize: 13, boxSizing: 'border-box' }} />
                {err && <div style={{ fontFamily: ui, fontSize: 12, color: C.garnet, marginTop: 6 }}>{err}</div>}

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
                  <button onClick={close} style={{ padding: '9px 18px', borderRadius: 8, background: 'transparent',
                    border: `1px solid ${C.hair}`, color: C.dim, fontFamily: ui, fontSize: 13, cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button onClick={submit} disabled={busy} style={{ padding: '9px 22px', borderRadius: 8,
                    background: C.garnet, color: '#fff', fontFamily: ui, fontWeight: 700,
                    fontSize: 13, border: 'none', cursor: busy ? 'default' : 'pointer', opacity: busy ? .6 : 1 }}>
                    {busy ? 'Submitting…' : 'Submit report'}
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
