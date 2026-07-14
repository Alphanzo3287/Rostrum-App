// =====================================================================
// The Rostrum · src/components/GavelFab.tsx
// Gavel as a DRAGGABLE floating widget: a movable gavel button that opens
// the fact-checker, an "Auto-check" toggle that watches the live
// transcript, and a subtle toast when an auto-verdict lands.
// =====================================================================
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Room } from 'livekit-client';
import { GavelWidget } from './GavelWidget';
import { GavelMascot } from './GavelMascot';
import { useLiveTranscript } from '../lib/transcript';
import { autoExtractCheck, subscribeFactChecks, type FactCheck } from '../lib/gavel';
import { useDraggable, bottomRight } from '../lib/useDraggable';
import { C, ui, display, a } from '../lib/theme';

const AUTO_INTERVAL_MS = 40_000;
const WIDGET_W = 380;

const VERDICT_COLOR: Record<string, string> = {
  Supported: '#4FC2A7', Refuted: '#E86A6A', Contested: '#E5B567', Unsupported: '#8A93A0', NotFactual: '#8A93A0',
};

export function GavelFab({ debateId, room, name, canSpeak, topic }: {
  debateId: string; room: Room | null; name: string; canSpeak: boolean; topic?: string;
}) {
  const [open, setOpen] = useState(false);
  const [auto, setAuto] = useState(false);
  const [toast, setToast] = useState<FactCheck | null>(null);
  const [fabFailed, setFabFailed] = useState(false);
  const { transcriptRef, supported, listening } = useLiveTranscript(room, name, canSpeak);
  const { pos, onPointerDown, wasDragged } = useDraggable('rostrum.gavelfab.v2', bottomRight(88, 120));
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

  // Anchor the panel/toast to the viewport EDGE nearest the FAB. Using CSS
  // right/left/bottom/top (not computed pixels) makes overflow impossible.
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1000;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const nearRight = (pos.x + 44) > vw / 2;
  const nearBottom = (pos.y + 48) > vh / 2;
  const hEdge = nearRight ? { right: 16 } : { left: 16 };
  const vEdge = nearBottom ? { bottom: 120 } : { top: 120 };

  return createPortal(
    <>
      {open && (
        <div style={{ position: 'fixed', ...hEdge, ...vEdge, zIndex: 300, width: `min(${WIDGET_W}px, calc(100vw - 32px))`,
          height: 'min(560px, calc(100vh - 140px))', display: 'flex', flexDirection: 'column', borderRadius: 18, overflow: 'hidden',
          background: a(C.base2, 'F5'), backdropFilter: 'blur(22px)', border: `1px solid ${C.hairHi}`, boxShadow: '0 24px 70px rgba(0,0,0,.55)' }}>
          <div style={{ padding: '13px 15px', borderBottom: `1px solid ${C.hair}`, display: 'flex', alignItems: 'center', gap: 10 }}>
            <GavelMascot state="avatar" size={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: display, fontSize: 15, fontWeight: 700, color: C.ink, lineHeight: 1.1 }}>Gavel</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: ui, fontSize: 10.5, color: '#A78BFA', fontWeight: 600 }}>AI Debate Assistant</span>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#4FC2A7' }} />
                <span style={{ fontFamily: ui, fontSize: 9.5, color: C.faint }}>Online</span>
              </div>
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
            <GavelWidget debateId={debateId} getTranscript={() => transcriptRef.current} topic={topic} />
          </div>
        </div>
      )}

      {/* subtle auto-verdict toast */}
      {toast && !open && (
        <button onClick={() => { setOpen(true); setToast(null); }}
          style={{ position: 'fixed', ...hEdge, ...vEdge, zIndex: 299, width: 'min(320px, calc(100vw - 32px))',
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

      {/* draggable FAB — Gavel himself */}
      <button onPointerDown={onPointerDown} onClick={() => { if (!wasDragged()) setOpen(o => !o); }}
        aria-label="Open Gavel (drag to move)" title="Gavel — click to open, drag to move"
        style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 300, touchAction: 'none', cursor: 'grab',
          background: 'transparent', border: 'none', padding: 0, lineHeight: 0 }}>
        <div style={{ position: 'relative', width: 78, height: 100 }}>
          {/* grounding glow so he pops on any background */}
          <div style={{ position: 'absolute', left: '50%', bottom: 6, transform: 'translateX(-50%)', width: 56, height: 20,
            borderRadius: '50%', background: a(C.cyan, '66'), filter: 'blur(13px)', pointerEvents: 'none' }} />
          {fabFailed
            ? <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'end center' }}><GavelMascot state="idle" size={92} float /></div>
            : <img src="/gavel/gavel-fab.png" alt="Gavel" onError={() => setFabFailed(true)}
                style={{ position: 'relative', height: 100, width: 'auto', display: 'block', margin: '0 auto',
                  filter: `drop-shadow(0 10px 16px rgba(0,0,0,.55))`, animation: 'gavelFloat 3.6s ease-in-out infinite' }} />}
          {auto && <span style={{ position: 'absolute', top: 4, right: 8, width: 12, height: 12, borderRadius: '50%',
            background: '#4FC2A7', border: '2px solid #0b0e14', boxShadow: '0 0 9px #4FC2A7' }} />}
        </div>
      </button>
    </>,
    document.body,
  );
}
