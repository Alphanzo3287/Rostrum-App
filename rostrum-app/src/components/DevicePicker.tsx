// =====================================================================
// The Rostrum · src/components/DevicePicker.tsx
// Camera + microphone chooser with a LIVE preview and a mic level meter.
// Used in two places:
//   • Pre-join "green room" (GreenRoom.tsx) — before entering the stage
//   • In-room gear (RoleDock) — swap devices mid-session
// Self-contained: opens its own preview stream, tears it down on unmount.
// =====================================================================
import { useEffect, useRef, useState } from 'react';
import { C } from '../lib/theme';
import { useMediaDevices } from '../lib/useMediaDevices';

export function DevicePicker({
  onCameraChange, onMicChange, compact = false,
}: {
  onCameraChange?: (deviceId: string) => void;
  onMicChange?: (deviceId: string) => void;
  compact?: boolean;
}) {
  const dev = useMediaDevices();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [level, setLevel] = useState(0);          // 0..1 mic level
  const rafRef = useRef<number | null>(null);
  const acRef = useRef<AudioContext | null>(null);

  // Ask for permission once so labels populate and preview can start.
  useEffect(() => { if (dev.permission === 'unknown') dev.ensurePermission(); }, [dev.permission]); // eslint-disable-line

  // (Re)open the preview whenever the chosen camera/mic changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      stopPreview();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: dev.cameraId ? { deviceId: { exact: dev.cameraId } } : true,
          audio: dev.micId ? { deviceId: { exact: dev.micId } } : true,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}); }
        startMeter(stream);
      } catch { /* denied or device busy */ }
    })();
    return () => { cancelled = true; stopPreview(); };
  }, [dev.cameraId, dev.micId]); // eslint-disable-line

  function startMeter(stream: MediaStream) {
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      const ac = new AC();
      acRef.current = ac;
      const src = ac.createMediaStreamSource(stream);
      const analyser = ac.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        setLevel(Math.min(1, (sum / data.length) / 90));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch { /* no audio context */ }
  }

  function stopPreview() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    acRef.current?.close().catch(() => {});
    acRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setLevel(0);
  }

  const pick = (id: string, kind: 'cam' | 'mic') => {
    if (kind === 'cam') { dev.setCameraId(id); onCameraChange?.(id); }
    else { dev.setMicId(id); onMicChange?.(id); }
  };

  const selStyle: React.CSSProperties = {
    width: '100%', padding: '9px 11px', borderRadius: 8,
    background: C.panel2, color: C.ink, border: `1px solid ${C.hair}`,
    fontSize: 13, outline: 'none',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11, letterSpacing: '0.4px', textTransform: 'uppercase',
    color: C.faint, marginBottom: 5, display: 'block',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {!compact && (
        <div style={{
          position: 'relative', aspectRatio: '16 / 9', width: '100%',
          borderRadius: 10, overflow: 'hidden', background: '#0A090C',
          border: `1px solid ${C.hair}`,
        }}>
          <video ref={videoRef} muted playsInline
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          {dev.permission === 'denied' && (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
              color: C.faint, fontSize: 13, textAlign: 'center', padding: 20 }}>
              Camera / mic access blocked. Allow it in your browser's address bar, then reopen.
            </div>
          )}
        </div>
      )}

      <div>
        <label style={labelStyle}>Camera</label>
        <select style={selStyle} value={dev.cameraId ?? ''} onChange={e => pick(e.target.value, 'cam')}>
          {dev.cameras.length === 0 && <option value="">Default camera</option>}
          {dev.cameras.map(c => <option key={c.deviceId} value={c.deviceId}>{c.label}</option>)}
        </select>
      </div>

      <div>
        <label style={labelStyle}>Microphone</label>
        <select style={selStyle} value={dev.micId ?? ''} onChange={e => pick(e.target.value, 'mic')}>
          {dev.mics.length === 0 && <option value="">Default microphone</option>}
          {dev.mics.map(m => <option key={m.deviceId} value={m.deviceId}>{m.label}</option>)}
        </select>
        {/* Mic level meter */}
        <div style={{ marginTop: 8, height: 6, borderRadius: 3, background: C.panel2, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${Math.round(level * 100)}%`,
            background: level > 0.02 ? C.jade : C.faint,
            transition: 'width 80ms linear',
          }} />
        </div>
      </div>
    </div>
  );
}
