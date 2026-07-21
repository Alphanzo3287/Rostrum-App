// =====================================================================
// The Rostrum · src/components/DeviceGear.tsx
// The in-room camera/mic settings button. Lives in the RoleDock next to
// the Mic / Camera toggles. Opens a picker popover with the DevicePicker;
// device changes switch the LIVE published track immediately via useRoom.
//
// The popover renders in a PORTAL with fixed positioning anchored to the
// button's measured rect — the dock uses overflow-x:auto for horizontal
// scroll, which (per spec) also clips overflow-y, so an in-flow popover
// would be hidden. The portal escapes the dock entirely.
// =====================================================================
import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { C } from '../lib/theme';
import { DevicePicker } from './DevicePicker';

export function DeviceGear({ onCamera, onMic }: {
  onCamera: (deviceId: string) => void;
  onMic: (deviceId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ left: number; bottom: number }>({ left: 0, bottom: 0 });

  // Anchor the fixed popover above the button whenever it opens.
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const W = 300;
    // Keep the 300px panel on-screen: clamp left so it never overflows.
    const left = Math.max(12, Math.min(r.left, window.innerWidth - W - 12));
    setPos({ left, bottom: window.innerHeight - r.top + 10 });
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen(o => !o)}
        title="Camera & mic settings"
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: 8, cursor: 'pointer', flexShrink: 0,
          background: open ? C.panel2 : 'transparent',
          border: `1px solid ${open ? C.gold : C.hair}`, color: C.dim,
        }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {open && createPortal(
        <>
          <div onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 1490 }} />
          <div style={{
            position: 'fixed', left: pos.left, bottom: pos.bottom, zIndex: 1500,
            width: 300, padding: 16, borderRadius: 12,
            background: C.panel, border: `1px solid ${C.hair}`,
            boxShadow: '0 18px 60px rgba(0,0,0,0.5)',
          }}>
            <div style={{ fontSize: 12, letterSpacing: '0.6px', textTransform: 'uppercase',
              color: C.faint, marginBottom: 12 }}>Camera &amp; microphone</div>
            <DevicePicker compact onCameraChange={onCamera} onMicChange={onMic} />
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
