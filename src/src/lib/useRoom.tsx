// =====================================================================
// The Rostrum · src/lib/useRoom.tsx
// Connects the chamber to a live LiveKit room and exposes the participants
// (with their tracks + roles) so the camera tiles render real video/audio.
// =====================================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Room, RoomEvent, Track, ConnectionState,
  type RemoteTrack, type Participant, type TrackPublication,
} from 'livekit-client';
import { getRoomToken } from './livekit';

export interface RoomMember {
  identity: string;
  name: string;
  handle: string | null;
  role: string;            // host | moderator | debater | judge | audience
  side: 'prop' | 'opp' | null;
  avatar: string | null;
  isLocal: boolean;
  isSpeaking: boolean;
  micOn: boolean;
  camOn: boolean;
  videoTrack?: Track;
  audioTrack?: Track;
  screenTrack?: Track;
}

interface UseRoom {
  members: RoomMember[];
  state: ConnectionState;
  canPublish: boolean;
  micOn: boolean;
  camOn: boolean;
  toggleMic: () => Promise<void>;
  toggleCam: () => Promise<void>;
  setScreenShare: (on: boolean) => Promise<boolean>;
  room: Room | null;
}

function meta(p: Participant) {
  try { return JSON.parse(p.metadata || '{}'); } catch { return {}; }
}

export function useRoom(debateId: string | null): UseRoom {
  const roomRef = useRef<Room | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [state, setState] = useState<ConnectionState>(ConnectionState.Disconnected);
  const [canPublish, setCanPublish] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);

  const sync = useCallback((room: Room) => {
    const all: Participant[] = [room.localParticipant, ...room.remoteParticipants.values()];
    setMembers(all.map((p) => {
      const md = meta(p);
      const cam: TrackPublication | undefined = p.getTrackPublication(Track.Source.Camera);
      const mic: TrackPublication | undefined = p.getTrackPublication(Track.Source.Microphone);
      const scr: TrackPublication | undefined = p.getTrackPublication(Track.Source.ScreenShare);
      return {
        identity: p.identity,
        name: p.name || 'Guest',
        handle: md.handle ?? null,
        role: md.role ?? 'audience',
        side: md.side ?? null,
        avatar: md.avatar ?? null,
        isLocal: p === room.localParticipant,
        isSpeaking: p.isSpeaking,
        micOn: !!mic && !mic.isMuted,
        camOn: !!cam && !cam.isMuted,
        videoTrack: cam?.track ?? undefined,
        audioTrack: mic?.track ?? undefined,
        screenTrack: scr?.track ?? undefined,
      };
    }));
  }, []);

  useEffect(() => {
    if (!debateId) return;
    let cancelled = false;
    let room: Room | null = null;

    (async () => {
      const { url, token, canPublish: cp } = await getRoomToken(debateId);
      if (cancelled) return;
      setCanPublish(cp);

      // dynacast pauses a track when it has no subscribers — which kills the
      // camera when you're testing alone. Keep tracks publishing.
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
        .on(RoomEvent.LocalTrackPublished, resync)
        .on(RoomEvent.LocalTrackUnpublished, resync)
        .on(RoomEvent.ActiveSpeakersChanged, resync)
        .on(RoomEvent.ParticipantMetadataChanged, resync)
        // host may flip our publish permission mid-session (segment gating)
        .on(RoomEvent.ParticipantPermissionsChanged, () => {
          if (room) setCanPublish(room.localParticipant.permissions?.canPublish ?? false);
        });

      await room.connect(url, token);
      if (cancelled) { room.disconnect(); return; }
      sync(room);
    })();

    return () => {
      cancelled = true;
      roomRef.current?.disconnect();
      roomRef.current = null;
    };
  }, [debateId, sync]);

  const toggleMic = useCallback(async () => {
    const room = roomRef.current;
    if (!room || !room.localParticipant.permissions?.canPublish) return; // audience can't
    const next = !micOn;
    await room.localParticipant.setMicrophoneEnabled(next);
    setMicOn(next);
  }, [micOn]);

  const toggleCam = useCallback(async () => {
    const room = roomRef.current;
    if (!room || !room.localParticipant.permissions?.canPublish) return;
    const next = !camOn;
    await room.localParticipant.setCameraEnabled(next);
    setCamOn(next);
  }, [camOn]);

  const setScreenShare = useCallback(async (on: boolean) => {
    const room = roomRef.current;
    if (!room || !room.localParticipant.permissions?.canPublish) return false;
    try { await room.localParticipant.setScreenShareEnabled(on); return true; }
    catch { return false; }
  }, []);

  return { members, state, canPublish, micOn, camOn, toggleMic, toggleCam, setScreenShare, room: roomRef.current };
}
