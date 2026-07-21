// =====================================================================
// The Rostrum · src/components/BracketView.tsx
// Classic single-elimination bracket: rounds as columns, matches as
// boxes, winners highlighted. Horizontally scrollable.
// =====================================================================
import type { BracketMatch } from '../lib/tournaments';
import { C, ui, mono, a } from '../lib/theme';

function roundLabel(round: number, totalRounds: number): string {
  const fromFinal = totalRounds - round;
  if (fromFinal === 0) return 'Final';
  if (fromFinal === 1) return 'Semifinals';
  if (fromFinal === 2) return 'Quarterfinals';
  return `Round ${round}`;
}

export function BracketView({ rounds, matches, canManage, onStart, onWatch }: {
  rounds: number; matches: BracketMatch[];
  canManage?: boolean; onStart?: (matchId: string) => void; onWatch?: (debateId: string) => void;
}) {
  const byRound: BracketMatch[][] = [];
  for (let r = 1; r <= rounds; r++) byRound[r] = matches.filter(m => m.round === r).sort((x, y) => x.slot - y.slot);

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 10 }}>
      <div style={{ display: 'flex', gap: 26, minWidth: 'min-content' }}>
        {Array.from({ length: rounds }, (_, i) => i + 1).map(r => (
          <div key={r} style={{ display: 'flex', flexDirection: 'column', minWidth: 200 }}>
            <div style={{ fontFamily: ui, fontSize: 11, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase',
              color: C.faint, marginBottom: 14, textAlign: 'center' }}>{roundLabel(r, rounds)}</div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-around', gap: 14 }}>
              {byRound[r].map(m => <MatchBox key={m.id} m={m} canManage={canManage} onStart={onStart} onWatch={onWatch} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MatchBox({ m, canManage, onStart, onWatch }: {
  m: BracketMatch; canManage?: boolean; onStart?: (id: string) => void; onWatch?: (debateId: string) => void;
}) {
  const done = m.status === 'done';
  const live = m.status === 'live';
  const ready = m.status === 'ready';
  return (
    <div>
      <div style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${live ? a(C.garnet, '66') : C.hair}`,
        background: C.panel, boxShadow: live ? `0 0 0 2px ${a(C.garnet, '2E')}` : 'none' }}>
        <Slot slot={m.a} isWinner={done && m.winner_entrant === m.entrant_a} pending={m.status === 'pending'} />
        <div style={{ height: 1, background: C.hair }} />
        <Slot slot={m.b} isWinner={done && m.winner_entrant === m.entrant_b} pending={m.status === 'pending'} />
      </div>
      {/* per-match action */}
      {live && m.debate_id && onWatch && (
        <button onClick={() => onWatch(m.debate_id!)} style={{ ...actionBtn, color: C.garnetHi, borderColor: a(C.garnet, '55') }}>● Watch live</button>
      )}
      {ready && canManage && onStart && (
        <button onClick={() => onStart(m.id)} style={{ ...actionBtn, color: C.gold, borderColor: a(C.gold, '55') }}>▶ Start match</button>
      )}
    </div>
  );
}

const actionBtn: React.CSSProperties = {
  width: '100%', marginTop: 5, padding: '5px', borderRadius: 7, cursor: 'pointer',
  background: 'transparent', border: '1px solid', fontFamily: ui, fontSize: 11, fontWeight: 700,
};

function Slot({ slot, isWinner, pending }: { slot: { name: string; seed: number | null } | null; isWinner: boolean; pending: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px',
      background: isWinner ? a(C.gold, '14') : 'transparent' }}>
      {slot?.seed != null && (
        <span style={{ fontFamily: mono, fontSize: 10, color: C.faint, width: 14, flexShrink: 0 }}>{slot.seed}</span>
      )}
      <span style={{ fontFamily: ui, fontSize: 13, fontWeight: isWinner ? 700 : 500,
        color: slot ? (isWinner ? C.gold : C.ink) : C.faint,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {slot ? slot.name : pending ? 'TBD' : '—'}
      </span>
      {isWinner && <span style={{ marginLeft: 'auto', fontSize: 11 }}>🏆</span>}
    </div>
  );
}
