// =====================================================================
// The Rostrum · src/components/GavelFab.tsx
// Gavel as a DRAGGABLE floating widget: a movable gavel button that opens
// the fact-checker, an "Auto-check" toggle that watches the live
// transcript, and a subtle toast when an auto-verdict lands.
// =====================================================================
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Room } from 'livekit-client';
import { GavelWidget } from './GavelWidget';
import { GavelMascot } from './GavelMascot';
import { useLiveTranscript } from '../lib/transcript';
import { autoExtractCheck, subscribeFactChecks, type FactCheck } from '../lib/gavel';
import { useDraggable, bottomRight } from '../lib/useDraggable';
import { C, ui, display, a } from '../lib/theme';

const AUTO_INTERVAL_MS = 40_000;
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
  const [hovered, setHovered] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);
  const [fixPos, setFixPos] = useState<{ left: number; top: number } | null>(null);
  const [vp, setVp] = useState(() => ({
    w: typeof document !== 'undefined' ? document.documentElement.clientWidth : 1000,
    h: typeof document !== 'undefined' ? document.documentElement.clientHeight : 800,
  }));
  useLayoutEffect(() => {
    const onResize = () => setVp({ w: document.documentElement.clientWidth, h: document.documentElement.clientHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const { transcriptRef, supported, listening } = useLiveTranscript(room, name, canSpeak);
  const { pos, onPointerDown, wasDragged } = useDraggable('rostrum.gavelfab.v2', bottomRight(96, 140));
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

  // Attach the panel to Gavel and keep it fully on-screen. Clamp against
  // documentElement.clientWidth/Height (the VISIBLE viewport, excluding any
  // scrollbar) — that's what stops the right-edge cut-off.
  const FAB_W = 96, FAB_H = 128;
  const W = Math.min(400, vp.w - 24);
  const H = Math.min(600, vp.h - 132);
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi));
  const panelPos = (pw: number, ph: number) => {
    let left = pos.x + FAB_W / 2 - pw / 2;          // centered over Gavel
    let top = pos.y - ph - 14;                        // above Gavel
    if (top < 12) top = pos.y + FAB_H - 6;            // …or below if no room above
    return { left: clamp(left, 12, vp.w - pw - 12), top: clamp(top, 12, vp.h - ph - 12) };
  };
  const widgetXY = panelPos(W, H);
  const toastXY = panelPos(Math.min(340, vp.w - 24), 62);
  const shownXY = fixPos ?? widgetXY;

  // Reset the correction whenever the anchor/viewport changes.
  useLayoutEffect(() => { setFixPos(null); }, [open, pos.x, pos.y, vp.w, vp.h, W, H]);
  // GROUND TRUTH: measure the actually-rendered widget and pull it back inside
  // the visible viewport if any edge overflows. Runs once per reset (guarded).
  useLayoutEffect(() => {
    if (!open || fixPos || !widgetRef.current) return;
    const r = widgetRef.current.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    let left = widgetXY.left, top = widgetXY.top, changed = false;
    if (r.right > vw - 12) { left = widgetXY.left - (r.right - (vw - 12)); changed = true; }
    if (left < 12) { left = 12; changed = true; }
    if (r.bottom > vh - 12) { top = widgetXY.top - (r.bottom - (vh - 12)); changed = true; }
    if (top < 12) { top = 12; changed = true; }
    if (changed) setFixPos({ left, top });
  });

  return createPortal(
    <>
      {open && (
        <div ref={widgetRef} style={{ position: 'fixed', left: shownXY.left, top: shownXY.top, zIndex: 300, width: W,
          maxWidth: 'calc(100vw - 24px)', maxHeight: 'calc(100vh - 24px)',
          height: H, display: 'flex', flexDirection: 'column', borderRadius: 20, overflow: 'hidden',
          background: a(C.base2, 'F5'), backdropFilter: 'blur(22px)', border: `1px solid ${C.hairHi}`, boxShadow: '0 24px 70px rgba(0,0,0,.55)' }}>
          <div style={{ padding: '15px 17px', borderBottom: `1px solid ${C.hair}`, display: 'flex', alignItems: 'center', gap: 12 }}>
            <GavelMascot state="avatar" size={54} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: display, fontSize: 17, fontWeight: 700, color: C.ink, lineHeight: 1.1 }}>Gavel</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span style={{ fontFamily: ui, fontSize: 11.5, color: '#A78BFA', fontWeight: 600 }}>AI Debate Assistant</span>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#4FC2A7' }} />
                <span style={{ fontFamily: ui, fontSize: 10.5, color: C.faint }}>Online</span>
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: C.faint, fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
          </div>

          <div style={{ padding: '12px 17px', borderBottom: `1px solid ${a(C.hair, '80')}`, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: ui, fontSize: 13.5, fontWeight: 600, color: C.ink }}>Auto-check live claims</div>
              <div style={{ fontFamily: ui, fontSize: 11, color: C.faint, lineHeight: 1.35 }}>
                {supported
                  ? (auto ? (listening ? 'Listening & watching the transcript…' : 'Watching the transcript…') : 'Gavel flags check-worthy claims as they’re spoken.')
                  : 'Live transcription needs Chrome or Edge on this device.'}
              </div>
            </div>
            <button onClick={() => setAuto(v => !v)} disabled={!supported} aria-label="Toggle auto-check"
              style={{ position: 'relative', width: 46, height: 26, borderRadius: 999, border: 'none', flexShrink: 0,
                cursor: supported ? 'pointer' : 'default', opacity: supported ? 1 : 0.4,
                background: auto ? `linear-gradient(135deg, ${C.gold}, ${C.cyan})` : C.panel2, transition: 'background .15s' }}>
              <span style={{ position: 'absolute', top: 3, left: auto ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
            </button>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '15px 17px', display: 'flex' }}>
            <GavelWidget debateId={debateId} getTranscript={() => transcriptRef.current} topic={topic} />
          </div>
        </div>
      )}

      {/* subtle auto-verdict toast */}
      {toast && !open && (
        <button onClick={() => { setOpen(true); setToast(null); }}
          style={{ position: 'fixed', left: toastXY.left, top: toastXY.top, zIndex: 299, width: Math.min(340, vp.w - 24),
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
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
        aria-label="Open Gavel (drag to move)" title="Gavel — click to open, drag to move"
        style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 300, touchAction: 'none', cursor: 'grab',
          background: 'transparent', border: 'none', padding: 0, lineHeight: 0 }}>
        <div style={{ position: 'relative', width: 96, height: 124 }}>
          {/* grounding glow so he pops on any background */}
          <div style={{ position: 'absolute', left: '50%', bottom: 6, transform: 'translateX(-50%)', width: 68, height: 24,
            borderRadius: '50%', background: a(C.cyan, hovered ? '88' : '66'), filter: 'blur(14px)', pointerEvents: 'none', transition: 'background .2s' }} />
          {fabFailed
            ? <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'end center' }}><GavelMascot state="idle" size={116} float /></div>
            : <img src="/gavel/gavel-fab.png" alt="Gavel" onError={() => setFabFailed(true)}
                style={{ position: 'relative', height: 124, width: 'auto', display: 'block', margin: '0 auto',
                  filter: `drop-shadow(0 12px 18px rgba(0,0,0,.55))`,
                  animation: hovered ? 'gavelBounce .6s ease' : 'gavelFloat 3.6s ease-in-out infinite' }} />}
          {auto && <span style={{ position: 'absolute', top: 6, right: 12, width: 13, height: 13, borderRadius: '50%',
            background: '#4FC2A7', border: '2px solid #0b0e14', boxShadow: '0 0 9px #4FC2A7' }} />}
        </div>
      </button>
    </>,
    document.body,
  );
}
