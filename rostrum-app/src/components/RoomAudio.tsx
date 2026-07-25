// =====================================================================
// The Rostrum · src/components/RoomAudio.tsx
// Room-wide audio. Audio MUST NOT live inside VideoTile: layouts like
// Cinema render zero tiles, which silently dropped all remote audio
// mid-stream. This mounts one <audio> per remote member, once, at the
// screen root — so audio is completely independent of the video layout.
// =====================================================================
import { useEffect, useRef } from 'react';
import { Track } from 'livekit-client';
import type { RoomMember } from '../lib/useRoom';

function MemberAudio({ member }: { member: RoomMember }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const el = ref.current;
    const t = member.audioTrack;
    // Never attach our own mic (echo). Remote only.
    if (el && t && !member.isLocal) { t.attach(el); return () => { t.detach(el); }; }
  }, [member.audioTrack, member.isLocal]);
  return <audio ref={ref} autoPlay />;
}

export function RoomAudio({ members }: { members: RoomMember[] }) {
  return (
    <div aria-hidden style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
      {members.filter(m => !m.isLocal && m.audioTrack).map(m => (
        <MemberAudio key={m.identity} member={m} />
      ))}
    </div>
  );
}
