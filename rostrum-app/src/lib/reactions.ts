// =====================================================================
// The Rostrum · src/lib/reactions.ts
// Batch C4 — Audience Interaction Bar (concept panel 5).
// Reactions (raise hand, agree, disagree, clap, emoji) are ephemeral and
// fly over the LiveKit data channel — the same transport and message
// envelope already used for broadcast control (see lib/livekit.ts). No new
// table, no new realtime channel: this is intentional, matching the
// project's established pattern that live reactions don't need persistence.
// =====================================================================
import { useEffect, useRef, useState, useCallback } from 'react';
import { RoomEvent, type Room } from 'livekit-client';

export type ReactionKind = 'raise_hand' | 'lower_hand' | 'agree' | 'disagree' | 'clap' | 'emoji';

export interface ReactionMsg {
  kind: 'reaction';
  type: ReactionKind;
  identity: string;
  name: string;
  emoji?: string;
}

export interface ReactionToast { id: string; type: ReactionKind; name: string; emoji?: string; }

const enc = new TextEncoder();
const dec = new TextDecoder();

/** Publish a reaction to everyone in the room. Non-fatal on failure. */
export function publishReaction(room: Room | null, type: ReactionKind, identity: string, name: string, emoji?: string) {
  if (!room) return;
  try {
    const msg: ReactionMsg = { kind: 'reaction', type, identity, name, emoji };
    room.localParticipant.publishData(enc.encode(JSON.stringify(msg)), { reliable: true });
  } catch { /* non-fatal: reactions are decorative */ }
}

function parseReaction(payload: Uint8Array): ReactionMsg | null {
  try {
    const obj = JSON.parse(dec.decode(payload));
    return obj?.kind === 'reaction' ? obj as ReactionMsg : null;
  } catch { return null; }
}

/**
 * Subscribes to incoming reactions on `room`. Returns:
 *  - toasts: short-lived burst reactions (clap/agree/disagree/emoji), auto-expire
 *  - raisedHands: identities currently holding their hand up (persists until lowered)
 *  - send: publish a reaction as the local participant
 */
export function useReactions(room: Room | null, identity: string, name: string) {
  const [toasts, setToasts] = useState<ReactionToast[]>([]);
  const [raisedHands, setRaisedHands] = useState<Map<string, string>>(new Map());
  const seq = useRef(0);

  useEffect(() => {
    if (!room) return;
    const onData = (payload: Uint8Array) => {
      const msg = parseReaction(payload);
      if (!msg) return;
      if (msg.type === 'raise_hand') {
        setRaisedHands(prev => { const next = new Map(prev); next.set(msg.identity, msg.name); return next; });
        return;
      }
      if (msg.type === 'lower_hand') {
        setRaisedHands(prev => { const next = new Map(prev); next.delete(msg.identity); return next; });
        return;
      }
      const id = `${Date.now().toString(36)}-${(seq.current++).toString(36)}`;
      setToasts(prev => [...prev.slice(-11), { id, type: msg.type, name: msg.name, emoji: msg.emoji }]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3200);
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => { room.off(RoomEvent.DataReceived, onData); };
  }, [room]);

  // Local participant leaving the room should drop their own raised hand.
  useEffect(() => () => { setRaisedHands(prev => { const n = new Map(prev); n.delete(identity); return n; }); }, [identity]);

  const iRaised = raisedHands.has(identity);

  const send = useCallback((type: ReactionKind, emoji?: string) => {
    publishReaction(room, type, identity, name, emoji);
    // Reflect locally immediately (DataReceived doesn't echo back to sender).
    if (type === 'raise_hand') setRaisedHands(prev => { const n = new Map(prev); n.set(identity, name); return n; });
    else if (type === 'lower_hand') setRaisedHands(prev => { const n = new Map(prev); n.delete(identity); return n; });
    else {
      const id = `local-${Date.now().toString(36)}-${(seq.current++).toString(36)}`;
      setToasts(prev => [...prev.slice(-11), { id, type, name, emoji }]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3200);
    }
  }, [room, identity, name]);

  const toggleHand = useCallback(() => send(iRaised ? 'lower_hand' : 'raise_hand'), [send, iRaised]);

  return { toasts, raisedHands, iRaised, send, toggleHand };
}
