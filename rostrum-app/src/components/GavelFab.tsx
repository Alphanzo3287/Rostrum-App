// =====================================================================
// The Rostrum · src/components/GavelFab.tsx
// Gavel as a floating chat widget: a sticky gavel button that opens the
// fact-checker, with an "Auto-check" toggle that watches the live
// transcript and flags check-worthy claims in real time.
// =====================================================================
import { useEffect, useRef, useState } from 'react';
import type { Room } from 'livekit-client';
import { GavelPanel } from './GavelPanel';
import { useLiveTranscript } from '../lib/transcript';
import { autoExtractCheck } from '../lib/gavel';
import { C, ui, display, a } from '../lib/theme';

const AUTO_INTERVAL_MS = 40_000;   // client cadence; server also enforces a per-debate cooldown

export function GavelFab({ debateId, room, name, canSpeak }: {
  debateId: string; room: Room | null; name: string; canSpeak: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [auto, setAuto] = useState(false);
  const { transcriptRef, supported, listening } = useLiveTranscript(room, name, canSpeak);

  // Auto-extract loop: while ON, periodically hand the recent transcript to
  // Gavel. The server decides whether there's anything worth checking and
  // bounds cost per debate, so this stays cheap and non-spammy.
  useEffect(() => {
    if (!auto) return;
    let alive = true;
    const tick = () => { if (alive && transcriptRef.current.trim().length > 40) autoExtractCheck(debateId, transcriptRef.current); };
    const id = setInterval(tick, AUTO_INTERVAL_MS);
    return () => { alive = false; clearInterval(id); };
  }, [auto, debateId, transcriptRef]);

  const gavelIcon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 13l-7.5 7.5a2.12 2.12 0 0 1-3-3L11 10" />
      <path d="M9.5 8.5l6 6M14 6l4 4M17.5 9.5l3-3-4-4-3 3M16 20h6" />
    </svg>
  );

  return (
    <>
      {open && (
        <div style={{ position: 'fixed', right: 20, bottom: 84, zIndex: 300, width: 380, maxWidth: 'calc(100vw - 32px)',
          maxHeight: '72vh', display: 'flex', flexDirection: 'column', borderRadius: 18, overflow: 'hidden',
          background: a(C.base2, 'F5'), backdropFilter: 'blur(22px)', border: `1px solid ${C.hairHi}`,
          boxShadow: '0 24px 70px rgba(0,0,0,.55)' }}>
          {/* header */}
          <div style={{ padding: '13px 15px', borderBottom: `1px solid ${C.hair}`, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, display: 'grid', placeItems: 'center', color: '#fff',
              background: `linear-gradient(135deg, ${C.gold}, ${C.cyan})` }}>{gavelIcon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: display, fontSize: 15, fontWeight: 700, color: C.ink, lineHeight: 1.1 }}>Gavel</div>
              <div style={{ fontFamily: ui, fontSize: 10.5, color: C.faint }}>Impartial academic fact-checker</div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: C.faint, fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
          </div>

          {/* auto-check toggle */}
          <div style={{ padding: '10px 15px', borderBottom: `1px solid ${a(C.hair, '80')}`, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: ui, fontSize: 12.5, fontWeight: 600, color: C.ink }}>Auto-check live claims</div>
              <div style={{ fontFamily: ui, fontSize: 10.5, color: C.faint, lineHeight: 1.35 }}>
                {supported
                  ? (auto ? (listening ? 'Listening & watching the transcript…' : 'Watching the transcript…') : 'Gavel flags check-worthy claims as they’re spoken.')
                  : 'Live transcription needs Chrome or Edge on this device.'}
              </div>
            </div>
            <button onClick={() => setAuto(a => !a)} disabled={!supported} aria-label="Toggle auto-check"
              style={{ position: 'relative', width: 42, height: 24, borderRadius: 999, border: 'none', flexShrink: 0,
                cursor: supported ? 'pointer' : 'default', opacity: supported ? 1 : 0.4,
                background: auto ? `linear-gradient(135deg, ${C.gold}, ${C.cyan})` : C.panel2, transition: 'background .15s' }}>
              <span style={{ position: 'absolute', top: 3, left: auto ? 21 : 3, width: 18, height: 18, borderRadius: '50%',
                background: '#fff', transition: 'left .15s' }} />
            </button>
          </div>

          {/* panel body */}
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '14px 15px', display: 'flex' }}>
            <GavelPanel debateId={debateId} />
          </div>
        </div>
      )}

      {/* the FAB */}
      <button onClick={() => setOpen(o => !o)} aria-label="Open Gavel fact-checker"
        style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 300, height: 52, padding: '0 18px 0 14px',
          display: 'flex', alignItems: 'center', gap: 9, borderRadius: 999, border: 'none', cursor: 'pointer',
          color: '#fff', fontFamily: display, fontSize: 15, fontWeight: 700, letterSpacing: '.01em',
          background: `linear-gradient(135deg, ${C.gold}, ${C.cyan})`, boxShadow: `0 10px 30px ${a(C.gold, '55')}` }}>
        {gavelIcon}
        Gavel
        {auto && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff', boxShadow: '0 0 8px #fff' }} />}
      </button>
    </>
  );
}
