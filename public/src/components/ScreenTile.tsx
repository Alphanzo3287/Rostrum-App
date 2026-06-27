// =====================================================================
// The Rostrum · src/components/ScreenTile.tsx
// Attaches an arbitrary LiveKit video track (camera or screen share) and
// renders it with object-fit: contain — correct for slides / shared
// screens where you don't want to crop the content.
// =====================================================================
import { useEffect, useRef } from 'react';
import type { Track } from 'livekit-client';

export function ScreenTile({ track, fit = 'contain' }: { track?: Track; fit?: 'contain' | 'cover' }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && track) { track.attach(el); return () => { track.detach(el); }; }
  }, [track]);
  return (
    <video ref={ref} autoPlay playsInline muted
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: fit, background: '#000' }} />
  );
}
