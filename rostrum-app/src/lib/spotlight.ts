// =====================================================================
// The Rostrum · src/lib/spotlight.ts
// Speakers' Corner: "highlight a speaker" needs to be a shared state that
// everyone in the room sees the same way — host or debater, whoever sets
// it, everyone's screen updates. This is intentionally NOT the same as
// lib/reactions.ts's ephemeral toasts: it's a single shared value, kept in
// sync the same way stage invites are (LiveKit data channel, broadcast to
// the whole room rather than one target), not persisted in the database
// since it's just a live-room viewing aid, not something that needs to
// survive a reconnect.
// =====================================================================
import { useEffect, useState, useCallback } from 'react';
import { RoomEvent, type Room } from 'livekit-client';

interface SpotlightMsg { kind: 'spotlight'; identity: string | null; }

const enc = new TextEncoder();
const dec = new TextDecoder();

export function useSpotlight(room: Room | null) {
  const [spotlightId, setSpotlightId] = useState<string | null>(null);

  useEffect(() => {
    if (!room) return;
    const onData = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(dec.decode(payload));
        if (msg?.kind === 'spotlight') setSpotlightId(msg.identity ?? null);
      } catch { /* ignore malformed */ }
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => { room.off(RoomEvent.DataReceived, onData); };
  }, [room]);

  const setSpotlight = useCallback((identity: string | null) => {
    setSpotlightId(identity); // reflect locally immediately — DataReceived doesn't echo to the sender
    if (!room) return;
    try {
      const msg: SpotlightMsg = { kind: 'spotlight', identity };
      room.localParticipant.publishData(enc.encode(JSON.stringify(msg)), { reliable: true });
    } catch { /* non-fatal */ }
  }, [room]);

  return { spotlightId, setSpotlight };
}
