// =====================================================================
// The Rostrum · src/components/hall.tsx
// Batch C2 — Live Debate Hall (concept panel 1).
// Pure presentational pieces composed by ChamberScreen during the live
// phase: glass competitor cards (prop left / opp right), the center floor
// stage with the amphitheater backdrop, and the gallery / audience-vote /
// judges row + "The Floor" stat strip beneath.
//
// Data only — no fake numbers. Everything maps to real RPCs:
//   profiles            -> win rate / followers / reputation
//   floor_stats         -> speaking seconds, evidence count, next up
//   audience_tally/votes-> the prop vs opp bar
//   debate_segments     -> round label + "has the floor"
// =====================================================================
import React from 'react';
import { C, ui, mono, display, a } from '../lib/theme';
import { VideoTile } from './VideoTile';
import type { RoomMember } from '../lib/useRoom';
import type { Profile, Side } from '../lib/types';
import type { FloorStats } from '../lib/api';

const STAGE_BACKDROP = '/stage-backdrop.jpg';

/* side palette → emerald for Proposition, coral for Opposition (concept). */
function sideTone(side: Side) {
  return side === 'prop'
    ? { base: C.jade, hi: C.jadeHi, label: 'Proposition' }
    : { base: C.garnet, hi: C.garnetHi, label: 'Opposition' };
}

const fmtN = (n: number) => (n ?? 0).toLocaleString();
const fmtK = (n: number) => {
  n = n ?? 0;
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
};
const clock = (secs: number) => {
  secs = Math.max(0, Math.floor(secs ?? 0));
  return `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
};
function hueOf(s: string) { let h = 0; for (let i = 0; i < (s || '').length; i++) h = s.charCodeAt(i) + ((h << 5) - h); return Math.abs(h) % 360; }

/* ---- small initials avatar (members carry no avatar_url) ---- */
export function Initials({ name, size = 30, url }: { name: string; size?: number; url?: string | null }) {
  if (url) return (
    <img src={url} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  );
  const h = hueOf(name || '?');
  const init = (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center',
      fontFamily: ui, fontWeight: 700, fontSize: size * 0.38, color: '#0A0E16',
      background: `linear-gradient(145deg, hsl(${h} 45% 62%), hsl(${(h + 38) % 360} 40% 42%))` }}>{init}</div>
  );
}

/* ============================ COMPETITOR CARD ============================ */
export function CompetitorCard({ side, member, profile, hasFloor, speakingSecs, segTotal, onProfile }: {
  side: Side;
  member?: RoomMember;
  profile?: Profile;
  hasFloor: boolean;
  speakingSecs: number;
  segTotal: number;
  onProfile?: (handle?: string | null) => void;
}) {
  const t = sideTone(side);
  const name = profile?.display_name || member?.name || t.label;
  const handle = profile?.handle ?? member?.handle ?? null;
  const rank = profile?.rank || 'Debater';
  const pts = profile?.points ?? 0;
  const wins = profile?.wins ?? 0, losses = profile?.losses ?? 0;
  const winRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : null;
  const followers = profile?.follower_count ?? 0;
  const fill = segTotal > 0 ? Math.min(1, speakingSecs / segTotal) : 0;
  const clickable = !!(onProfile && handle);

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', borderRadius: 20, overflow: 'hidden',
      background: `linear-gradient(180deg, ${a(t.base, '14')}, ${a(C.panel, 'CC')} 42%)`,
      border: `1px solid ${a(t.base, hasFloor ? '66' : '33')}`,
      boxShadow: hasFloor ? `0 0 0 1px ${a(t.base, '40')}, 0 18px 50px ${a(t.base, '24')}` : `0 14px 40px ${a('#000000', '40')}` }}>

      {/* side eyebrow */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px 8px' }}>
        <span style={{ fontFamily: ui, fontWeight: 800, fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', color: t.hi }}>
          {t.label}
        </span>
        {member
          ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999,
              background: a(C.garnet, '1F'), border: `1px solid ${a(C.garnet, '55')}` }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.garnet, animation: 'pulse 1.5s infinite' }} />
              <span style={{ fontFamily: ui, fontWeight: 800, fontSize: 9.5, letterSpacing: '.1em', color: C.garnetHi }}>LIVE</span>
            </span>
          : <span style={{ fontFamily: ui, fontSize: 10, color: C.faint, letterSpacing: '.04em' }}>Waiting</span>}
      </div>

      {/* video / waiting podium */}
      <div style={{ position: 'relative', margin: '0 12px', borderRadius: 14, overflow: 'hidden',
        aspectRatio: '4 / 3', background: C.base2, border: `1px solid ${C.hair}` }}>
        {member
          ? <div style={{ position: 'absolute', inset: 0 }}><VideoTile member={member} active={hasFloor} size="stage" /></div>
          : <WaitingPodium tone={t} />}
      </div>

      {/* identity */}
      <div style={{ padding: '12px 14px 4px', cursor: clickable ? 'pointer' : 'default' }}
        onClick={clickable ? () => onProfile!(handle) : undefined} title={clickable ? `View ${name}'s profile` : undefined}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontFamily: ui, fontWeight: 700, fontSize: 17, color: C.ink, whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
          <span title="Verified debater" style={{ width: 15, height: 15, flexShrink: 0, borderRadius: '50%',
            background: C.gold, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 9, fontWeight: 900 }}>✓</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 3, fontFamily: ui, fontSize: 12, color: C.dim }}>
          <span>{rank}</span>
          <span style={{ color: C.warning }}>🏆 {fmtN(pts)}</span>
        </div>
      </div>

      {/* stat chips */}
      <div style={{ display: 'flex', gap: 8, padding: '8px 14px 0' }}>
        <StatChip label="Win Rate" value={winRate == null ? '—' : `${winRate}%`} />
        <StatChip label="Followers" value={fmtK(followers)} />
      </div>

      {/* speaking bar */}
      <div style={{ padding: '12px 14px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <span style={{ fontFamily: ui, fontSize: 12, fontWeight: 600, color: hasFloor ? t.hi : C.faint }}>
            {hasFloor ? 'Speaking' : member ? 'On the bench' : 'Waiting'}
          </span>
          <span style={{ fontFamily: mono, fontSize: 12, color: hasFloor ? C.ink : C.faint }}>{clock(speakingSecs)}</span>
        </div>
        <div style={{ height: 7, borderRadius: 999, background: a(C.faint, '24'), overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.round(fill * 100)}%`,
            background: `linear-gradient(90deg, ${t.base}, ${t.hi})`,
            boxShadow: hasFloor ? `0 0 12px ${a(t.base, '99')}` : 'none', transition: 'width .8s ease' }} />
        </div>
      </div>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1, padding: '7px 10px', borderRadius: 10, background: C.glass, border: `1px solid ${C.hair}` }}>
      <div style={{ fontFamily: ui, fontSize: 9.5, letterSpacing: '.04em', textTransform: 'uppercase', color: C.faint }}>{label}</div>
      <div style={{ fontFamily: ui, fontSize: 14, fontWeight: 700, color: C.ink, marginTop: 1 }}>{value}</div>
    </div>
  );
}

function WaitingPodium({ tone }: { tone: { base: string; hi: string } }) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
      background: `radial-gradient(120% 90% at 50% 25%, ${a(tone.base, '1F')}, transparent 70%)` }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 56, height: 40, margin: '0 auto', borderRadius: '6px 6px 3px 3px',
          background: `linear-gradient(180deg, ${C.panel2}, ${C.base})`, border: `1px solid ${a(tone.base, '55')}`,
          boxShadow: `0 0 26px ${a(tone.base, '40')}`, position: 'relative' }}>
          <span style={{ position: 'absolute', top: -7, left: '50%', transform: 'translateX(-50%)',
            width: 22, height: 7, background: tone.hi, borderRadius: 3, opacity: .85 }} />
        </div>
        <div style={{ fontFamily: ui, fontSize: 11.5, color: C.faint, marginTop: 10 }}>Waiting for speaker</div>
      </div>
    </div>
  );
}

/* ============================== FLOOR STAGE ============================== */
export function FloorStage({ roundLabel, countdown, hasFloorSide, assembling, children }: {
  roundLabel: string;
  countdown: string;
  hasFloorSide: Side | null;
  assembling?: boolean;
  children?: React.ReactNode;   // WinnerOverlay / voting indicator overlays
}) {
  const tone = hasFloorSide ? sideTone(hasFloorSide) : null;
  return (
    <div style={{ position: 'relative', borderRadius: 18, overflow: 'hidden', minHeight: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      border: `1px solid ${C.hair}`, background: C.base2 }}>
      {/* amphitheater backdrop — stage only */}
      <div aria-hidden style={{ position: 'absolute', inset: 0,
        backgroundImage: `url(${STAGE_BACKDROP})`, backgroundSize: 'cover', backgroundPosition: 'center 38%' }} />
      <div aria-hidden style={{ position: 'absolute', inset: 0,
        background: `radial-gradient(90% 70% at 50% 30%, ${a(C.base, '40')}, ${a(C.base, 'D9')} 78%)` }} />
      {tone && <div aria-hidden style={{ position: 'absolute', inset: 0,
        background: `radial-gradient(70% 50% at 50% 50%, ${a(tone.base, '1F')}, transparent 70%)` }} />}

      {/* content */}
      <div style={{ position: 'relative', textAlign: 'center', padding: '22px 16px' }}>
        <span style={{ display: 'inline-block', padding: '5px 14px', borderRadius: 999, marginBottom: 16,
          fontFamily: ui, fontWeight: 700, fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase',
          color: C.ink, background: a(C.base, 'B3'), border: `1px solid ${C.hairHi}`, backdropFilter: 'blur(6px)' }}>
          {roundLabel}
        </span>

        <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 'clamp(40px, 7vw, 64px)', lineHeight: 1,
          color: C.ink, letterSpacing: '-.02em', textShadow: `0 6px 30px ${a('#000000', '80')}` }}>
          {countdown}
        </div>
        <div style={{ fontFamily: ui, fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase',
          color: C.dim, marginTop: 8 }}>{assembling ? 'Debate begins soon' : 'Time Remaining'}</div>

        <div style={{ marginTop: 18, fontFamily: ui, fontWeight: 800, fontSize: 12.5, letterSpacing: '.14em',
          textTransform: 'uppercase', color: tone ? tone.hi : C.warning }}>
          {hasFloorSide ? `${sideTone(hasFloorSide).label} has the floor` : assembling ? 'The hall is filling' : 'The floor is open'}
        </div>

        {/* gold floor emblem */}
        <div style={{ marginTop: 18, display: 'flex', justifyContent: 'center' }}>
          <svg width="62" height="34" viewBox="0 0 62 34" fill="none" aria-hidden>
            <path d="M31 2L58 12H4L31 2Z" fill={C.warning} opacity="0.92" />
            <rect x="10" y="14" width="6" height="14" fill={C.warning} opacity="0.85" />
            <rect x="22" y="14" width="6" height="14" fill={C.warning} opacity="0.85" />
            <rect x="34" y="14" width="6" height="14" fill={C.warning} opacity="0.85" />
            <rect x="46" y="14" width="6" height="14" fill={C.warning} opacity="0.85" />
            <rect x="4" y="30" width="54" height="3" rx="1.5" fill={C.warning} opacity="0.92" />
          </svg>
        </div>
      </div>

      {children}
    </div>
  );
}

/* =========================== HOST / MOD / JUDGE TOP ROW =========================== */
export function HostTopRow({ host, mod, judgeCount, onProfile, right }: {
  host?: RoomMember; mod?: RoomMember; judgeCount: number;
  onProfile?: (handle?: string | null) => void; right?: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, padding: '4px 0 12px', flexWrap: 'wrap' }}>
      <SeatPill member={host} label="Host" tone={C.warning} glow onProfile={onProfile} />
      <SeatPill member={mod} label="Moderator" tone={C.gold} onProfile={onProfile} />
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 12,
        background: C.glass, border: `1px solid ${C.hair}` }}>
        <span style={{ width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center',
          border: `1.5px dashed ${C.hairHi}`, color: C.faint, fontSize: 13 }}>⚖</span>
        <span style={{ fontFamily: ui, fontSize: 11.5, color: C.dim }}>
          {judgeCount > 0 ? `${judgeCount} ${judgeCount === 1 ? 'Judge' : 'Judges'}` : 'Open Judge'}
        </span>
      </span>
      {right && <div style={{ marginLeft: 6 }}>{right}</div>}
    </div>
  );
}

function SeatPill({ member, label, tone, glow, onProfile }: {
  member?: RoomMember; label: string; tone: string; glow?: boolean; onProfile?: (h?: string | null) => void;
}) {
  const clickable = !!(member && onProfile && member.handle);
  return (
    <span onClick={clickable ? () => onProfile!(member!.handle) : undefined}
      title={member ? member.name : `Open ${label}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '6px 12px 6px 6px', borderRadius: 999,
        background: member ? a(tone, '14') : C.glass, border: `1px solid ${member ? a(tone, '55') : C.hair}`,
        cursor: clickable ? 'pointer' : 'default' }}>
      {member
        ? <span style={{ borderRadius: '50%', boxShadow: glow ? `0 0 0 2px ${C.base}, 0 0 14px ${a(tone, '99')}` : 'none' }}>
            <Initials name={member.name} size={28} />
          </span>
        : <span style={{ width: 28, height: 28, borderRadius: '50%', border: `1.5px dashed ${C.hairHi}`,
            display: 'grid', placeItems: 'center', color: C.faint, fontSize: 16, lineHeight: 1 }}>+</span>}
      <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
        <span style={{ fontFamily: ui, fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: tone }}>{label}</span>
        <span style={{ fontFamily: ui, fontSize: 12.5, fontWeight: 600, color: member ? C.ink : C.faint, maxWidth: 120,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {member ? member.name.split(' ')[0] : 'Open seat'}</span>
      </span>
    </span>
  );
}

/* ============================== BOTTOM ROW ============================== */
export function GalleryStrip({ audience, onProfile }: {
  audience: RoomMember[]; onProfile?: (h?: string | null) => void;
}) {
  const GAL = 9;
  return (
    <Panel title={`Gallery · ${audience.length} watching`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {audience.length === 0
          ? <span style={{ fontFamily: ui, fontSize: 12, color: C.faint }}>Empty for now.</span>
          : audience.slice(0, GAL).map(m => {
              const clickable = !!(onProfile && m.handle);
              return (
                <span key={m.identity} onClick={clickable ? () => onProfile!(m.handle) : undefined}
                  title={m.name} style={{ cursor: clickable ? 'pointer' : 'default' }}>
                  <Initials name={m.name} size={28} />
                </span>
              );
            })}
        {audience.length > GAL &&
          <span style={{ width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center',
            background: C.panel2, color: C.dim, fontFamily: mono, fontSize: 10.5 }}>+{audience.length - GAL}</span>}
      </div>
    </Panel>
  );
}

export function AudienceVoteStrip({ tally, myVote, canVote, onVote }: {
  tally: { prop: number; opp: number }; myVote: Side | null; canVote: boolean;
  onVote: (side: Side) => void;
}) {
  const total = tally.prop + tally.opp;
  const pp = total > 0 ? Math.round((tally.prop / total) * 100) : 50;
  const op = 100 - pp;
  const Btn = ({ side, pct }: { side: Side; pct: number }) => {
    const t = sideTone(side);
    const mine = myVote === side;
    return (
      <button disabled={!canVote} onClick={() => canVote && onVote(side)}
        style={{ background: 'none', border: 'none', padding: 0, textAlign: side === 'prop' ? 'left' : 'right',
          cursor: canVote ? 'pointer' : 'default', flex: 1 }}>
        <span style={{ fontFamily: ui, fontSize: 11, fontWeight: 600, color: t.hi }}>
          {mine ? '✓ ' : ''}{t.label}</span>
        <div style={{ fontFamily: ui, fontWeight: 800, fontSize: 18, color: C.ink }}>{pct}%</div>
      </button>
    );
  };
  return (
    <Panel title="Audience Vote">
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
        <Btn side="prop" pct={pp} />
        <span style={{ fontFamily: ui, fontSize: 11, color: C.faint, paddingBottom: 4 }}>vs</span>
        <Btn side="opp" pct={op} />
      </div>
      <div style={{ display: 'flex', height: 9, borderRadius: 999, overflow: 'hidden', margin: '8px 0 6px', gap: 2 }}>
        <div style={{ width: `${pp}%`, background: `linear-gradient(90deg, ${C.jade}, ${C.jadeHi})`, transition: 'width .8s ease' }} />
        <div style={{ width: `${op}%`, background: `linear-gradient(90deg, ${C.garnetHi}, ${C.garnet})`, transition: 'width .8s ease' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: ui, fontSize: 10.5, color: C.faint }}>
        <span>{fmtN(total)} votes</span>
        <span>{myVote ? `You voted ${sideTone(myVote).label}` : canVote ? 'Tap a side to vote' : 'Voting closed'}</span>
      </div>
    </Panel>
  );
}

export function JudgesStrip({ judges, onProfile }: { judges: RoomMember[]; onProfile?: (h?: string | null) => void }) {
  return (
    <Panel title={`Judges · ${judges.length}`}>
      <div style={{ display: 'flex', gap: 10 }}>
        {judges.length === 0
          ? <span style={{ fontFamily: ui, fontSize: 12, color: C.faint }}>No judges seated.</span>
          : judges.slice(0, 5).map((j, i) => {
              const clickable = !!(onProfile && j.handle);
              return (
                <div key={j.identity} onClick={clickable ? () => onProfile!(j.handle) : undefined}
                  title={j.name} style={{ textAlign: 'center', cursor: clickable ? 'pointer' : 'default' }}>
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <Initials name={j.name} size={34} />
                    <span style={{ position: 'absolute', bottom: -2, right: -2, width: 15, height: 15, borderRadius: '50%',
                      background: C.panel2, border: `2px solid ${C.base}`, color: C.warning, fontSize: 7.5, fontWeight: 800,
                      display: 'grid', placeItems: 'center' }}>J{i + 1}</span>
                  </div>
                </div>
              );
            })}
      </div>
    </Panel>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: 16, background: C.panel, border: `1px solid ${C.hair}`,
      minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontFamily: ui, fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase',
        color: C.faint, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

/* ============================ THE FLOOR STAT STRIP ============================ */
export function FloorStatStrip({ floor, hasFloorSide, phaseLabel, segTotal }: {
  floor: FloorStats | null; hasFloorSide: Side | null; phaseLabel: string; segTotal: number;
}) {
  const tone = hasFloorSide ? sideTone(hasFloorSide) : null;
  const speaking = !floor ? 0 : hasFloorSide === 'opp' ? floor.opp_speaking : floor.prop_speaking;
  const cell = (label: string, value: React.ReactNode) => (
    <div style={{ padding: '0 18px', borderLeft: `1px solid ${C.hair}` }}>
      <div style={{ fontFamily: ui, fontSize: 9.5, letterSpacing: '.08em', textTransform: 'uppercase', color: C.faint }}>{label}</div>
      <div style={{ fontFamily: ui, fontSize: 15, fontWeight: 700, color: C.ink, marginTop: 3 }}>{value}</div>
    </div>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '14px 16px', borderRadius: 16,
      background: `linear-gradient(100deg, ${a(tone ? tone.base : C.gold, '14')}, ${a(C.panel, 'CC')} 40%)`,
      border: `1px solid ${C.hair}`, overflowX: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, paddingRight: 18, minWidth: 200 }}>
        <span style={{ width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0,
          background: a(tone ? tone.base : C.gold, '24'), color: tone ? tone.hi : C.gold, fontSize: 14 }}>🎙</span>
        <div>
          <div style={{ fontFamily: ui, fontSize: 13, fontWeight: 700, color: tone ? tone.hi : C.ink }}>
            {hasFloorSide ? `${sideTone(hasFloorSide).label} has the floor` : 'The floor is open'}</div>
          <div style={{ fontFamily: ui, fontSize: 11, color: C.faint }}>{phaseLabel}</div>
        </div>
      </div>
      {cell('Speaking Time', <span style={{ fontFamily: mono }}>{clock(speaking)}<span style={{ color: C.faint, fontSize: 11 }}> / {clock(segTotal)}</span></span>)}
      {cell('Evidence Used', floor?.evidence_count ?? 0)}
      {cell('Next Up', floor?.next_up
        ? <span style={{ color: floor.next_up.side ? sideTone(floor.next_up.side).hi : C.ink }}>{floor.next_up.label}</span>
        : <span style={{ color: C.faint }}>—</span>)}
    </div>
  );
}
