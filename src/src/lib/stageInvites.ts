// =====================================================================
// The Rostrum · src/lib/stageInvites.ts
// Promoting someone onto the stage now requires their consent: the host
// sends a targeted, ephemeral invite over the LiveKit data channel (same
// transport as lib/reactions.ts); the invitee sees an Accept/Decline card
// and responds the same way. The invitee has no server-side permission to
// promote themselves, so on acceptance they send a response back and the
// HOST's own (already-authorized) client performs the actual promotion.
// Removing someone from stage stays instant and needs no round trip.
// =====================================================================
import { useEffect, useRef, useState, useCallback } from 'react';
import { RoomEvent, type Room } from 'livekit-client';

export type StageRole = 'moderator' | 'debater' | 'judge';
export type StageSide = 'prop' | 'opp' | null;

interface StageInviteMsg {
  kind: 'stage_invite';
  inviteId: string;
  toIdentity: string;
  fromIdentity: string;
  fromName: string;
  role: StageRole;
  side: StageSide;
}
interface StageInviteResponseMsg {
  kind: 'stage_invite_response';
  inviteId: string;
  toIdentity: string;      // the host who should act on this
  fromIdentity: string;    // the invitee who responded
  fromName: string;
  role: StageRole;
  side: StageSide;
  accepted: boolean;
}

export interface IncomingStageInvite {
  inviteId: string; fromName: string; fromIdentity: string; role: StageRole; side: StageSide;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

function publish(room: Room | null, msg: StageInviteMsg | StageInviteResponseMsg, toIdentity: string) {
  if (!room) return;
  try {
    room.localParticipant.publishData(enc.encode(JSON.stringify(msg)), {
      reliable: true, destinationIdentities: [toIdentity],
    });
  } catch { /* non-fatal */ }
}

function parse(payload: Uint8Array): StageInviteMsg | StageInviteResponseMsg | null {
  try {
    const obj = JSON.parse(dec.decode(payload));
    if (obj?.kind === 'stage_invite' || obj?.kind === 'stage_invite_response') return obj;
    return null;
  } catch { return null; }
}

/**
 * `onAccepted` fires only for the host's own client, when a target accepts —
 * that's the signal to actually call promoteToRole/promoteFromAudience,
 * since only the host is authorized to make that change.
 */
export function useStageInvites(room: Room | null, identity: string, name: string, isHost: boolean,
  onAccepted?: (fromIdentity: string, fromName: string, role: StageRole, side: StageSide) => void,
) {
  const [incoming, setIncoming] = useState<IncomingStageInvite | null>(null);
  const onAcceptedRef = useRef(onAccepted);
  onAcceptedRef.current = onAccepted;

  useEffect(() => {
    if (!room) return;
    const onData = (payload: Uint8Array) => {
      const msg = parse(payload);
      if (!msg) return;
      if (msg.kind === 'stage_invite' && msg.toIdentity === identity) {
        setIncoming({ inviteId: msg.inviteId, fromName: msg.fromName, fromIdentity: msg.fromIdentity, role: msg.role, side: msg.side });
      } else if (msg.kind === 'stage_invite_response' && isHost && msg.toIdentity === identity) {
        if (msg.accepted) onAcceptedRef.current?.(msg.fromIdentity, msg.fromName, msg.role, msg.side);
      }
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => { room.off(RoomEvent.DataReceived, onData); };
  }, [room, identity, isHost]);

  const sendInvite = useCallback((toIdentity: string, role: StageRole, side: StageSide) => {
    const inviteId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    publish(room, { kind: 'stage_invite', inviteId, toIdentity, fromIdentity: identity, fromName: name, role, side }, toIdentity);
  }, [room, identity, name]);

  const respond = useCallback((accepted: boolean) => {
    if (!incoming) return;
    publish(room, {
      kind: 'stage_invite_response', inviteId: incoming.inviteId, toIdentity: incoming.fromIdentity,
      fromIdentity: identity, fromName: name, role: incoming.role, side: incoming.side, accepted,
    }, incoming.fromIdentity);
    setIncoming(null);
  }, [room, incoming, identity, name]);

  return { incoming, sendInvite, respond };
}
