// =====================================================================
// The Rostrum · src/lib/useMediaDevices.tsx
// Enumerates the viewer's camera + microphone inputs and remembers their
// choice across sessions (localStorage). Selected IDs are consumed by
// useRoom so publishing uses the RIGHT device, and by the DevicePicker's
// live preview. No backend — this is all browser-local.
// =====================================================================
import { useCallback, useEffect, useState } from 'react';
import { Room } from 'livekit-client';

export interface DeviceInfo { deviceId: string; label: string; }

const CAM_KEY = 'rostrum.device.camera';
const MIC_KEY = 'rostrum.device.mic';

// Read persisted choices (module-level so useRoom can grab them at connect
// time without re-rendering).
export function savedCameraId(): string | undefined {
  try { return localStorage.getItem(CAM_KEY) || undefined; } catch { return undefined; }
}
export function savedMicId(): string | undefined {
  try { return localStorage.getItem(MIC_KEY) || undefined; } catch { return undefined; }
}

export interface UseMediaDevices {
  cameras: DeviceInfo[];
  mics: DeviceInfo[];
  cameraId?: string;
  micId?: string;
  setCameraId: (id: string) => void;
  setMicId: (id: string) => void;
  refresh: () => Promise<void>;
  permission: 'unknown' | 'granted' | 'denied';
  ensurePermission: () => Promise<boolean>;
}

export function useMediaDevices(): UseMediaDevices {
  const [cameras, setCameras] = useState<DeviceInfo[]>([]);
  const [mics, setMics] = useState<DeviceInfo[]>([]);
  const [cameraId, setCameraIdState] = useState<string | undefined>(savedCameraId());
  const [micId, setMicIdState] = useState<string | undefined>(savedMicId());
  const [permission, setPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');

  const refresh = useCallback(async () => {
    try {
      // Labels are only populated after permission is granted at least once.
      const cams = await Room.getLocalDevices('videoinput');
      const mikes = await Room.getLocalDevices('audioinput');
      setCameras(cams.map(d => ({ deviceId: d.deviceId, label: d.label || 'Camera' })));
      setMics(mikes.map(d => ({ deviceId: d.deviceId, label: d.label || 'Microphone' })));
      if (cams.some(d => d.label)) setPermission('granted');
    } catch {
      /* enumeration can fail before permission; ignore */
    }
  }, []);

  const ensurePermission = useCallback(async () => {
    try {
      // Prompt once to unlock device labels; immediately release the tracks.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      stream.getTracks().forEach(t => t.stop());
      setPermission('granted');
      await refresh();
      return true;
    } catch {
      setPermission('denied');
      return false;
    }
  }, [refresh]);

  const setCameraId = useCallback((id: string) => {
    setCameraIdState(id);
    try { localStorage.setItem(CAM_KEY, id); } catch { /* private mode */ }
  }, []);
  const setMicId = useCallback((id: string) => {
    setMicIdState(id);
    try { localStorage.setItem(MIC_KEY, id); } catch { /* private mode */ }
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    navigator.mediaDevices?.addEventListener?.('devicechange', onChange);
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', onChange);
  }, [refresh]);

  return {
    cameras, mics, cameraId, micId,
    setCameraId, setMicId, refresh, permission, ensurePermission,
  };
}
