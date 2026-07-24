// =====================================================================
// The Rostrum · src/lib/transcript.ts
// A free, browser-based live transcript. Each SPEAKER's own browser
// transcribes their speech via the Web Speech API and broadcasts final
// segments over the LiveKit data channel (same plumbing as reactions);
// everyone accumulates a shared rolling transcript. Feeds Gavel's
// auto-extract. Works best in Chrome/Edge (Web Speech API support).
// =====================================================================
import { useEffect, useRef, useState } from 'react';
import { RoomEvent, type Room } from 'livekit-client';

const enc = new TextEncoder();
const dec = new TextDecoder();
const MAX_SEGMENTS = 140;

export interface TranscriptSegment { speaker: string; text: string; ts: number }

export function useLiveTranscript(room: Room | null, name: string, canSpeak: boolean) {
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);

  const append = (seg: TranscriptSegment) =>
    setSegments(prev => (prev.some(s => s.ts === seg.ts && s.text === seg.text)
      ? prev : [...prev, seg].slice(-MAX_SEGMENTS)));

  // Transcribe the local speaker and broadcast final segments.
  useEffect(() => {
    if (!room || !canSpeak) return;
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }
    let stopped = false;
    const rec = new SR();
    rec.continuous = true; rec.interimResults = false; rec.lang = 'en-US';
    rec.onstart = () => setListening(true);
    rec.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          const text = String(e.results[i][0].transcript || '').trim();
          if (!text) continue;
          const seg: TranscriptSegment = { speaker: name, text, ts: Date.now() };
          append(seg);
          try { room.localParticipant.publishData(enc.encode(JSON.stringify({ t: 'transcript', ...seg })), { reliable: true }); } catch { /* ignore */ }
        }
      }
    };
    rec.onend = () => { setListening(false); if (!stopped) { try { rec.start(); } catch { /* ignore */ } } };
    rec.onerror = () => { /* transient; onend will restart */ };
    try { rec.start(); } catch { /* ignore */ }
    return () => { stopped = true; try { rec.onend = null; rec.stop(); } catch { /* ignore */ } };
  }, [room, canSpeak, name]);

  // Receive other speakers' segments.
  useEffect(() => {
    if (!room) return;
    const onData = (payload: Uint8Array) => {
      try { const o = JSON.parse(dec.decode(payload)); if (o?.t === 'transcript' && o.text) append({ speaker: o.speaker || 'Speaker', text: o.text, ts: o.ts || Date.now() }); }
      catch { /* not ours */ }
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => { room.off(RoomEvent.DataReceived, onData); };
  }, [room]);

  const transcript = segments.map(s => `${s.speaker}: ${s.text}`).join('\n');
  const ref = useRef(transcript);
  ref.current = transcript;

  return { segments, transcript, transcriptRef: ref, supported, listening };
}
