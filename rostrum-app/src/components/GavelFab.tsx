// =====================================================================
// The Rostrum · src/components/GavelFab.tsx
// Gavel as a DRAGGABLE floating widget: a movable gavel button that opens
// the fact-checker, an "Auto-check" toggle that watches the live
// transcript, and a subtle toast when an auto-verdict lands.
// =====================================================================
import { useEffect, useRef, useState } from 'react';
import type { Room } from 'livekit-client';
import { GavelPanel } from './GavelPanel';
import { useLiveTranscript } from '../lib/transcript';
import { autoExtractCheck, subscribeFactChecks, type FactCheck } from '../lib/gavel';
import { useDraggable, bottomRight } from '../lib/useDraggable';
import { C, ui, display, a } from '../lib/theme';

const AUTO_INTERVAL_MS = 40_000;
const WIDGET_W = 380;

const VERDICT_COLOR: Record<string, string> = {
  Supported: '#4FC2A7', Refuted: '#E86A6A', Contested: '#E5B567', Unsupported: '#8A93A0', NotFactual: '#8A93A0',
};

export function GavelFab({ debateId, room, name, canSpeak }: {
  debateId: string; room: Room | null; name: string; canSpeak: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [auto, setAuto] = useState(false);
  const [toast, setToast] = useState<FactCheck | null>(null);
  const { transcriptRef, supported, listening } = useLiveTranscript(room, name, canSpeak);
  const { pos, onPointerDown, wasDragged } = useDraggable('rostrum.gavelfab', bottomRight(120));
  const openRef = useRef(open);
  openRef.current = open;

  // Auto-extract loop.
  useEffect(() => {
    if (!auto) return;
    let alive = true;
    const tick = () => { if (alive && transcriptRef.current.trim().length > 40) autoExtractCheck(debateId, transcriptRef.current); };
    const id = setInterval(tick, AUTO_INTERVAL_MS);
    return () => { alive = false; clearInterval(id); };
  }, [auto, debateId, transcriptRef]);

  // Subtle toast when an AUTO verdict lands (skip if the widget is open — it's already in view).
  useEffect(() => {
    const unsub = subscribeFactChecks(debateId, fc => {
      if (fc.source === 'auto' && !openRef.current) {
        setToast(fc);
        setTimeout(() => setToast(t => (t?.id === fc.id ? null : t)), 7000);
      }
    }, 'toast');
    return unsub;
  }, [debateId]);

  // Position the widget/toast near the button, clamped on-screen.
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1000;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const widgetH = Math.min(vh * 0.72, 560);
  const widget = anchor(pos, WIDGET_W, widgetH, vw, vh);
  const toastPos = anchor(pos, Math.min(320, vw - 24), 62, vw, vh);

  const gavelIcon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 13l-7.5 7.5a2.12 2.12 0 0 1-3-3L11 10" />
      <path d="M9.5 8.5l6 6M14 6l4 4M17.5 9.5l3-3-4-4-3 3M16 20h6" />
    </svg>
  );

  return (
    <>
      {open && (
        <div style={{ position: 'fixed', left: widget.left, top: widget.top, zIndex: 300, width: WIDGET_W, maxWidth: 'calc(100vw - 24px)',
          height: widgetH, display: 'flex', flexDirection: 'column', borderRadius: 18, overflow: 'hidden',
          background: a(C.base2, 'F5'), backdropFilter: 'blur(22px)', border: `1px solid ${C.hairHi}`, boxShadow: '0 24px 70px rgba(0,0,0,.55)' }}>
          <div style={{ padding: '13px 15px', borderBottom: `1px solid ${C.hair}`, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, display: 'grid', placeItems: 'center', color: '#fff', background: `linear-gradient(135deg, ${C.gold}, ${C.cyan})` }}>{gavelIcon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: display, fontSize: 15, fontWeight: 700, color: C.ink, lineHeight: 1.1 }}>Gavel</div>
              <div style={{ fontFamily: ui, fontSize: 10.5, color: C.faint }}>Impartial academic fact-checker</div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: C.faint, fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
          </div>

          <div style={{ padding: '10px 15px', borderBottom: `1px solid ${a(C.hair, '80')}`, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: ui, fontSize: 12.5, fontWeight: 600, color: C.ink }}>Auto-check live claims</div>
              <div style={{ fontFamily: ui, fontSize: 10.5, color: C.faint, lineHeight: 1.35 }}>
                {supported
                  ? (auto ? (listening ? 'Listening & watching the transcript…' : 'Watching the transcript…') : 'Gavel flags check-worthy claims as they’re spoken.')
                  : 'Live transcription needs Chrome or Edge on this device.'}
              </div>
            </div>
            <button onClick={() => setAuto(v => !v)} disabled={!supported} aria-label="Toggle auto-check"
              style={{ position: 'relative', width: 42, height: 24, borderRadius: 999, border: 'none', flexShrink: 0,
                cursor: supported ? 'pointer' : 'default', opacity: supported ? 1 : 0.4,
                background: auto ? `linear-gradient(135deg, ${C.gold}, ${C.cyan})` : C.panel2, transition: 'background .15s' }}>
              <span style={{ position: 'absolute', top: 3, left: auto ? 21 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
            </button>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '14px 15px', display: 'flex' }}>
            <GavelPanel debateId={debateId} />
          </div>
        </div>
      )}

      {/* subtle auto-verdict toast */}
      {toast && !open && (
        <button onClick={() => { setOpen(true); setToast(null); }}
          style={{ position: 'fixed', left: toastPos.left, top: toastPos.top, zIndex: 299, maxWidth: Math.min(320, vw - 24),
            display: 'flex', alignItems: 'center', gap: 9, padding: '9px 13px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
            background: a(C.base2, 'F2'), backdropFilter: 'blur(14px)', border: `1px solid ${a(VERDICT_COLOR[toast.verdict] ?? '#8A93A0', '66')}`,
            boxShadow: '0 12px 34px rgba(0,0,0,.4)', animation: 'none' }}>
          <span style={{ fontSize: 14 }}>⚖️</span>
          <span style={{ minWidth: 0 }}>
            <span style={{ fontFamily: ui, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em', color: VERDICT_COLOR[toast.verdict] ?? C.faint }}>
              {toast.verdict}
            </span>
            <span style={{ display: 'block', fontFamily: ui, fontSize: 11.5, color: C.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {toast.claim}
            </span>
          </span>
        </button>
      )}

      {/* draggable FAB */}
      <button onPointerDown={onPointerDown} onClick={() => { if (!wasDragged()) setOpen(o => !o); }}
        aria-label="Gavel fact-checker (drag to move)" title="Gavel — drag to move"
        style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 300, height: 52, padding: '0 18px 0 14px', touchAction: 'none',
          display: 'flex', alignItems: 'center', gap: 9, borderRadius: 999, border: 'none', cursor: 'grab',
          color: '#fff', fontFamily: display, fontSize: 15, fontWeight: 700,
          background: `linear-gradient(135deg, ${C.gold}, ${C.cyan})`, boxShadow: `0 10px 30px ${a(C.gold, '55')}` }}>
        {gavelIcon}
        Gavel
        {auto && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff', boxShadow: '0 0 8px #fff' }} />}
      </button>
    </>
  );
}

/** Place a panel of size w×h near the FAB, opening above it, clamped on-screen. */
function anchor(pos: { x: number; y: number }, w: number, h: number, vw: number, vh: number) {
  const left = Math.min(Math.max(pos.x + 120 - w, 8), Math.max(8, vw - w - 8));
  let top = pos.y - h - 12;
  if (top < 8) top = Math.min(pos.y + 60, Math.max(8, vh - h - 8));
  return { left, top: Math.max(8, top) };
}
