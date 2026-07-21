// =====================================================================
// The Rostrum · src/components/DeviceGear.tsx
// The in-room camera/mic settings button. Lives in the RoleDock next to
// the Mic / Camera toggles. Opens a small popover with the DevicePicker;
// device changes switch the LIVE published track immediately via useRoom.
// =====================================================================
import { useState } from 'react';
import { C } from '../lib/theme';
import { DevicePicker } from './DevicePicker';

export function DeviceGear({ onCamera, onMic }: {
  onCamera: (deviceId: string) => void;
  onMic: (deviceId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Camera & mic settings"
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: 8, cursor: 'pointer',
          background: open ? C.panel2 : 'transparent',
          border: `1px solid ${open ? C.gold : C.hair}`, color: C.dim,
        }}>
        {/* gear glyph */}
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {open && (
        <>
          {/* click-away */}
          <div onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 1490 }} />
          <div style={{
            position: 'absolute', bottom: 'calc(100% + 10px)', left: 0, zIndex: 1500,
            width: 300, padding: 16, borderRadius: 12,
            background: C.panel, border: `1px solid ${C.hair}`,
            boxShadow: '0 18px 60px rgba(0,0,0,0.5)',
          }}>
            <div style={{ fontSize: 12, letterSpacing: '0.6px', textTransform: 'uppercase',
              color: C.faint, marginBottom: 12 }}>Camera &amp; microphone</div>
            <DevicePicker compact onCameraChange={onCamera} onMicChange={onMic} />
          </div>
        </>
      )}
    </div>
  );
}
