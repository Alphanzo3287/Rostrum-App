// =====================================================================
// The Rostrum · src/lib/useDebate.tsx
// Orchestrates a debate room: loads it, keeps status/segment/clock synced
// in real time, and exposes the host actions (go live, next segment, pause,
// end). Mic gating rides along with each segment change.
// =====================================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getDebate, setDebateStatus, setSegment, pauseTimer, resumeTimer,
  finalizeDebate, cancelDebate, subscribeDebate, setRemaining as apiSetRemaining,
} from './api';
import { startRecording, stopEgress, applySegmentMics } from './livekit';
import { endYouTubeBroadcast } from './youtube';
import type { Debate, Segment, Side } from './types';

export type Phase = 'assembly' | 'live' | 'ended';
type Mover = { identity: string; role: string; side: Side | null };

export function useDebate(debateId: string) {
  const [debate, setDebate] = useState<Debate | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [remaining, setRemaining] = useState(0);
  const egress = useRef<{ rec?: string; yt?: string }>({});

  useEffect(() => {
    getDebate(debateId).then(({ debate, segments }) => { setDebate(debate); setSegments(segments); });
    const off = subscribeDebate(debateId, (patch) => setDebate(prev => (prev ? { ...prev, ...patch } : prev)));
    return off;
  }, [debateId]);

  // local 2Hz tick that resolves the authoritative clock fields into seconds
  useEffect(() => {
    const compute = () => {
      if (!debate) return;
      if (debate.segment_ends_at) {
        setRemaining(Math.max(0, Math.round((new Date(debate.segment_ends_at).getTime() - Date.now()) / 1000)));
      } else if (debate.segment_paused_secs != null) {
        setRemaining(debate.segment_paused_secs);
      } else {
        const idx = debate.current_segment ?? 0;
        setRemaining(segments[idx]?.duration_secs ?? 0);
      }
    };
    compute();
    const t = setInterval(compute, 500);
    return () => clearInterval(t);
  }, [debate, segments]);

  const phase: Phase = debate?.status === 'live' ? 'live' : debate?.status === 'ended' ? 'ended' : 'assembly';
  const segIdx = debate?.current_segment ?? 0;
  const seg = segments[segIdx];
  const running = !!debate?.segment_ends_at;
  const isHost = (uid?: string) => !!debate && !!uid && debate.host_id === uid;

  const debaters = (members: Mover[]) =>
    members.filter(m => m.role === 'debater').map(m => ({ identity: m.identity, side: m.side }));

  // host: open the doors → go live, start segment 0, gate mics, roll tape
  const goLive = useCallback(async (members: Mover[]) => {
    await setDebateStatus(debateId, 'live');
    await setSegment(debateId, 0);
    await applySegmentMics(debateId, debaters(members), segments[0]?.side ?? null);
    try { egress.current.rec = (await startRecording(debateId)).egressId; } catch { /* recording optional */ }
    // YouTube streaming is controlled manually via the dock's stream button
    // (so the host can start it during assembly, before the debate begins).
  }, [debateId, segments]);

  // host: advance the run of show + flip mics to the new speaking side
  const nextSegment = useCallback(async (members: Mover[]) => {
    const next = Math.min(segments.length - 1, segIdx + 1);
    await setSegment(debateId, next);
    await applySegmentMics(debateId, debaters(members), segments[next]?.side ?? null);
  }, [debateId, segIdx, segments]);

  // host: jump straight to a chosen segment + re-gate mics to its side
  const goToSegment = useCallback(async (members: Mover[], idx: number) => {
    const i = Math.max(0, Math.min(segments.length - 1, idx));
    await setSegment(debateId, i);
    await applySegmentMics(debateId, debaters(members), segments[i]?.side ?? null);
  }, [debateId, segments]);

  const toggleTimer = useCallback(async () => {
    if (running) await pauseTimer(debateId); else await resumeTimer(debateId);
  }, [running, debateId]);

  // host: edit the clock to an exact number of seconds
  const setClock = useCallback(async (secs: number) => {
    await apiSetRemaining(debateId, secs);
  }, [debateId]);

  // host: stop tape, decide the winner, mark ended (status flips via finalize)
  const endDebate = useCallback(async () => {
    if (egress.current.rec) { try { await stopEgress(debateId, egress.current.rec); } catch {} }
    if (egress.current.yt)  { try { await stopEgress(debateId, egress.current.yt); } catch {} }
    try { await endYouTubeBroadcast(debateId); } catch { /* optional */ }
    await finalizeDebate(debateId);
  }, [debateId]);

  const cancelEvent = useCallback(async () => {
    await cancelDebate(debateId);
  }, [debateId]);

  return { debate, segments, seg, segIdx, remaining, running, phase, isHost,
           goLive, nextSegment, toggleTimer, endDebate, cancelEvent, goToSegment, setClock };
}
