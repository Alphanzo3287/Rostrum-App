// =====================================================================
// The Rostrum · src/lib/useBroadcastRoom.tsx
// Read-only room connection for the YouTube broadcast page. Unlike
// useRoom, it does NOT authenticate — it connects with a subscribe-only
// token passed in the URL by the egress launcher. Renders everyone's
// video/audio so the composited output shows the whole show.
// =====================================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Room, RoomEvent, Track, ConnectionState,
  type RemoteTrack, type Participant, type TrackPublication, type RemoteParticipant,
} from 'livekit-client';
import { parseBcastControl, type BcastControlMsg } from './livekit';
import type { RoomMember } from './useRoom';

function meta(p: Participant) {
  try { return JSON.parse(p.metadata || '{}'); } catch { return {}; }
}

/** token + livekitUrl from the egress-built URL; onControl fires on host data msgs. */
export function useBroadcastRoom(token: string | null, livekitUrl?: string | null,
  onControl?: (m: BcastControlMsg) => void) {
  const roomRef = useRef<Room | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [state, setState] = useState<ConnectionState>(ConnectionState.Disconnected);
  const ctrlRef = useRef(onControl);
  ctrlRef.current = onControl;

  const url = livekitUrl || (import.meta.env.VITE_LIVEKIT_URL as string | undefined) || null;

  const sync = useCallback((room: Room) => {
    const all: Participant[] = [room.localParticipant, ...room.remoteParticipants.values()];
    setMembers(all
      .filter(p => p.identity && !p.identity.startsWith('egress-') && !p.identity.startsWith('broadcast-'))
      .map((p) => {
        const md = meta(p);
        const cam: TrackPublication | undefined = p.getTrackPublication(Track.Source.Camera);
        const mic: TrackPublication | undefined = p.getTrackPublication(Track.Source.Microphone);
        return {
          identity: p.identity,
          name: p.name || 'Guest',
          handle: md.handle ?? null,
          role: md.role ?? 'audience',
          side: md.side ?? null,
          avatar: md.avatar ?? null,
          isLocal: false,
          isSpeaking: p.isSpeaking,
          micOn: !!mic && !mic.isMuted,
          camOn: !!cam && !cam.isMuted,
          videoTrack: cam?.track ?? undefined,
          audioTrack: mic?.track ?? undefined,
        };
      }));
  }, []);

  useEffect(() => {
    if (!token || !url) return;
    let cancelled = false;
    let room: Room | null = null;

    (async () => {
      room = new Room({ adaptiveStream: true, dynacast: false });
      roomRef.current = room;
      const resync = () => room && sync(room);
      room
        .on(RoomEvent.ConnectionStateChanged, setState)
        .on(RoomEvent.ParticipantConnected, resync)
        .on(RoomEvent.ParticipantDisconnected, resync)
        .on(RoomEvent.TrackSubscribed, (_t: RemoteTrack) => resync())
        .on(RoomEvent.TrackUnsubscribed, resync)
        .on(RoomEvent.TrackMuted, resync)
        .on(RoomEvent.TrackUnmuted, resync)
        .on(RoomEvent.ActiveSpeakersChanged, resync)
        .on(RoomEvent.DataReceived, (payload: Uint8Array, _p?: RemoteParticipant) => {
          const msg = parseBcastControl(payload);
          if (msg) ctrlRef.current?.(msg);
        });

      try {
        await room.connect(url, token);
        if (cancelled) { room.disconnect(); return; }
        sync(room);
      } catch (e) {
        console.error('broadcast room connect failed:', e);
      }
    })();

    return () => { cancelled = true; roomRef.current?.disconnect(); roomRef.current = null; };
  }, [token, url, sync]);

  return { members, state };
}
