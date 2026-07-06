// =====================================================================
// The Rostrum · src/components/VideoTile.tsx
// Drop-in replacement for the prototype's FilmTile / SpeakerTile: same look,
// but it attaches a real LiveKit video track (and shows an avatar when the
// camera is off). This is the bridge from mock tiles to live cameras.
// =====================================================================
import { useEffect, useRef } from 'react';
import { Track } from 'livekit-client';
import { C } from '../lib/theme';
import type { RoomMember } from '../lib/useRoom';

const SIDE = {
  prop: { c: '#2E9E86', hi: '#4FC2A7', label: 'PROP' },
  opp:  { c: '#B23A55', hi: '#DA5F7C', label: 'OPP'  },
  none: { c: '#D9B45C', hi: '#F1D58A', label: '' },
} as const;

const ROLE_LABEL: Record<string, string> = {
  host: 'HOST', moderator: 'MOD', debater: '', judge: 'JUDGE', audience: '',
};

export function VideoTile({ member, active, size = 'tile' }: {
  member: RoomMember; active?: boolean; size?: 'tile' | 'stage';
}) {
  const vref = useRef<HTMLVideoElement>(null);
  const aref = useRef<HTMLAudioElement>(null);

  // attach / detach the camera track. Must depend on camOn too: the <video>
  // element only exists while camOn is true, so if the camera turns on AFTER
  // the track is already known (e.g. a host who wasn't on stage, then gets
  // spotlighted), the element mounts and we need to re-run to attach to it.
  useEffect(() => {
    const el = vref.current;
    const t = member.videoTrack;
    if (el && t) { t.attach(el); return () => { t.detach(el); }; }
  }, [member.videoTrack, member.camOn]);

  // attach remote audio (skip our own to avoid echo)
  useEffect(() => {
    const el = aref.current;
    const t = member.audioTrack;
    if (el && t && !member.isLocal) { t.attach(el); return () => { t.detach(el); }; }
  }, [member.audioTrack, member.isLocal]);

  const tone = SIDE[member.side ?? 'none'];
  const tag = ROLE_LABEL[member.role] || tone.label;
  const ring = active ? tone.hi : 'rgba(255,255,255,0.10)';

  return (
    <div style={{
      position: 'relative', aspectRatio: '4 / 3', borderRadius: 6, overflow: 'hidden',
      border: `1px solid ${active ? tone.c : 'rgba(255,255,255,0.08)'}`,
      boxShadow: active ? `0 0 0 2px ${tone.c}55` : 'none',
      background: '#0A090C',
    }}>
      {active && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: tone.hi, zIndex: 2 }} />}

      {member.camOn
        ? <video ref={vref} autoPlay playsInline muted={member.isLocal}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%' }} />
        : <Avatar name={member.name} avatar={member.avatar} big={size === 'stage'} />}

      <audio ref={aref} autoPlay />

      {tag && <span style={{ position: 'absolute', top: 5, left: 6, fontSize: 8.5, fontWeight: 700,
        letterSpacing: 1, color: tone.hi, background: 'rgba(0,0,0,0.5)', padding: '1px 5px', borderRadius: 3 }}>{tag}</span>}

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 7px 5px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'linear-gradient(transparent, rgba(0,0,0,0.82))' }}>
        <span style={{ fontSize: size === 'stage' ? 13 : 11, color: '#fff', fontWeight: 600,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {member.name.split(' ')[0]}
        </span>
        <MicGlyph on={member.micOn} color={tone.hi} />
      </div>
    </div>
  );
}

function Avatar({ name, avatar, big }: { name: string; avatar: string | null; big?: boolean }) {
  if (avatar) return <img src={avatar} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.9 }} />;
  const init = name.split(' ').map(w => w[0]).slice(0, 2).join('');
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
      background: 'radial-gradient(120% 120% at 30% 20%, #2a2530, #0A090C)' }}>
      <div style={{ width: big ? 78 : 40, height: big ? 78 : 40, borderRadius: '50%',
        display: 'grid', placeItems: 'center', fontWeight: 700, color: C.base, fontSize: big ? 26 : 15,
        background: 'linear-gradient(145deg,#cdb06a,#8a7038)' }}>{init}</div>
    </div>
  );
}

function MicGlyph({ on, color }: { on: boolean; color: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke={on ? color : '#665F55'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0M12 17v4" />
      {!on && <line x1="3" y1="3" x2="21" y2="21" stroke="#665F55" />}
    </svg>
  );
}
