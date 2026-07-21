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
import { savedCameraId, savedMicId } from './useMediaDevices';

export interface RoomMember {
  identity: string;
  name: string;
  handle: string | null;
  role: string;            // host | moderator | debater | judge | audience
  side: 'prop' | 'opp' | null;
  avatar: string | null;
  pro?: boolean;           // Rostrum Pro member (from token metadata)
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
  switchCamera: (deviceId: string) => Promise<void>;
  switchMic: (deviceId: string) => Promise<void>;
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
    // Belt-and-braces: explicitly subscribe to every remote camera/mic
    // publication. autoSubscribe should do this, but a publication that
    // slipped through (e.g. published before permissions settled) stays
    // unsubscribed forever — the spotlighted host renders black for viewers.
    for (const p of room.remoteParticipants.values()) {
      for (const pub of p.trackPublications.values()) {
        try { if (!pub.isSubscribed && (pub as any).setSubscribed) (pub as any).setSubscribed(true); } catch { /* noop */ }
      }
    }
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
        pro: !!md.pro,
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
      // camera when you're testing alone. adaptiveStream pauses a remote track
      // when it isn't attached to a visible element, so a participant who
      // wasn't on-screen (e.g. the host in Oxford) has paused video that fails
      // to resume when spotlighted — viewers see black. Disable both so any
      // subscribed track always delivers frames.
      room = new Room({ adaptiveStream: false, dynacast: false });
      roomRef.current = room;

      const resync = () => room && sync(room);
      room
        .on(RoomEvent.ConnectionStateChanged, setState)
        .on(RoomEvent.ParticipantConnected, resync)
        .on(RoomEvent.ParticipantDisconnected, resync)
        .on(RoomEvent.TrackSubscribed, (_t: RemoteTrack) => resync())
        .on(RoomEvent.TrackUnsubscribed, resync)
        .on(RoomEvent.TrackPublished, resync)
        .on(RoomEvent.TrackUnpublished, resync)
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
    // Honour the participant's saved microphone choice when turning it on.
    const mic = savedMicId();
    await room.localParticipant.setMicrophoneEnabled(
      next, mic ? { deviceId: mic } : undefined);
    setMicOn(next);
  }, [micOn]);

  const toggleCam = useCallback(async () => {
    const room = roomRef.current;
    if (!room || !room.localParticipant.permissions?.canPublish) return;
    const next = !camOn;
    const cam = savedCameraId();
    await room.localParticipant.setCameraEnabled(
      next, cam ? { deviceId: cam } : undefined);
    setCamOn(next);
  }, [camOn]);

  // Live device switching — used by the in-room gear. LiveKit republishes the
  // track on the new device without dropping the connection.
  const switchCamera = useCallback(async (deviceId: string) => {
    const room = roomRef.current;
    if (!room) return;
    try { await room.switchActiveDevice('videoinput', deviceId); } catch { /* device gone */ }
  }, []);
  const switchMic = useCallback(async (deviceId: string) => {
    const room = roomRef.current;
    if (!room) return;
    try { await room.switchActiveDevice('audioinput', deviceId); } catch { /* device gone */ }
  }, []);

  const setScreenShare = useCallback(async (on: boolean) => {
    const room = roomRef.current;
    if (!room || !room.localParticipant.permissions?.canPublish) return false;
    try { await room.localParticipant.setScreenShareEnabled(on); return true; }
    catch { return false; }
  }, []);

  return { members, state, canPublish, micOn, camOn, toggleMic, toggleCam, setScreenShare, switchCamera, switchMic, room: roomRef.current };
}
