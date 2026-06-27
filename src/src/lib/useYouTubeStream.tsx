// =====================================================================
// The Rostrum · src/lib/useYouTubeStream.tsx
// Holds the YouTube simulcast state OUTSIDE the dock button, so it
// survives the assembly→live phase change (which remounts the dock).
// Coordinates two steps: push the LiveKit RTMP egress, then transition
// the YouTube broadcast to "live". Surfaces real errors honestly.
// =====================================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { startYouTube, stopEgress } from './livekit';
import { goLiveOnYouTube, endYouTubeBroadcast, getYouTubeBroadcastStatus } from './youtube';

export type StreamPhase = 'idle' | 'connecting' | 'live' | 'error';

export function useYouTubeStream(debateId: string, enabled: boolean) {
  const [phase, setPhase]   = useState<StreamPhase>('idle');
  const [error, setError]   = useState<string | null>(null);
  const egressId            = useRef<string | null>(null);
  const cancelled           = useRef(false);

  // On mount, check whether a broadcast already exists and is live
  // (e.g. the host refreshed the page or the dock remounted).
  useEffect(() => {
    if (!enabled) return;
    let on = true;
    getYouTubeBroadcastStatus(debateId)
      .then(b => { if (on && b?.status === 'live') setPhase('live'); })
      .catch(() => {});
    return () => { on = false; };
  }, [debateId, enabled]);

  const start = useCallback(async () => {
    cancelled.current = false;
    setError(null);
    setPhase('connecting');
    try {
      // 1. Start pushing audio/video to YouTube's RTMP ingestion URL.
      const res = await startYouTube(debateId);
      if (res.skipped) {
        setPhase('error');
        setError('No YouTube broadcast is attached to this debate. Enable YouTube when creating it.');
        return;
      }
      if (res.egressId) egressId.current = res.egressId;

      // The broadcast was created with enableAutoStart, so YouTube goes live
      // automatically once it receives the RTMP feed (~10-20s of ingestion).
      // We still send an explicit go-live nudge a few times in case autostart
      // is slow, but we do NOT block the UI on it — the egress is running.
      (async () => {
        for (let attempt = 0; attempt < 6 && !cancelled.current; attempt++) {
          await new Promise(r => setTimeout(r, 6000));
          try { await goLiveOnYouTube(debateId); break; } catch { /* keep nudging */ }
        }
      })();

      // Give ingestion a moment to spin up, then reflect "live" in the UI.
      await new Promise(r => setTimeout(r, 6000));
      if (!cancelled.current) setPhase('live');
    } catch (e: any) {
      if (!cancelled.current) {
        setPhase('error');
        setError(e?.message ?? 'Could not start the YouTube stream.');
      }
    }
  }, [debateId]);

  const stop = useCallback(async () => {
    cancelled.current = true;
    try {
      if (egressId.current) { await stopEgress(debateId, egressId.current); egressId.current = null; }
      try { await endYouTubeBroadcast(debateId); } catch { /* best effort */ }
    } finally {
      setPhase('idle');
      setError(null);
    }
  }, [debateId]);

  return { phase, error, start, stop };
}
