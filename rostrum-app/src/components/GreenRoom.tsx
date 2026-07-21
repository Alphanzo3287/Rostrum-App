// =====================================================================
// The Rostrum · src/components/GreenRoom.tsx
// The pre-join "green room": pick camera + mic and see a live preview
// before entering the chamber. Choices persist (useMediaDevices), so
// useRoom publishes with the right device the moment you join.
// =====================================================================
import { C } from '../lib/theme';
import { DevicePicker } from './DevicePicker';

export function GreenRoom({ motion, onEnter, onCancel }: {
  motion: string;
  onEnter: () => void;
  onCancel: () => void;
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1400,
      background: 'rgba(4,6,10,0.86)', backdropFilter: 'blur(10px)',
      display: 'grid', placeItems: 'center', padding: 20,
    }}>
      <div style={{
        width: 'min(560px, 96vw)', maxHeight: '92vh', overflowY: 'auto',
        background: C.panel, border: `1px solid ${C.hair}`, borderRadius: 16,
        padding: 24, boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
      }}>
        <div style={{ fontSize: 12, letterSpacing: '1.2px', textTransform: 'uppercase', color: C.faint }}>
          Check your camera &amp; mic
        </div>
        <h2 style={{ margin: '6px 0 18px', fontSize: 20, color: C.ink, lineHeight: 1.25 }}>{motion}</h2>

        <DevicePicker />

        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button onClick={onCancel} style={{
            flex: '0 0 auto', padding: '11px 16px', borderRadius: 9,
            background: 'transparent', color: C.dim, border: `1px solid ${C.hair}`,
            fontSize: 14, cursor: 'pointer',
          }}>Back</button>
          <button onClick={onEnter} style={{
            flex: 1, padding: '11px 16px', borderRadius: 9,
            background: C.gold, color: '#fff', border: 'none',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>Enter the hall</button>
        </div>
      </div>
    </div>
  );
}
