// =====================================================================
// The Rostrum · src/screens/InviteScreen.tsx
// What an invited debater / judge / moderator sees when they open an invite
// link. Accept seats them on stage in that role (join_debate), then sends
// them into the chamber; Decline returns them to the lobby.
// =====================================================================
import { useEffect, useState } from 'react';
import { getDebate, joinDebate } from '../lib/api';
import type { Debate, DebateRole, Side } from '../lib/types';
import { C, ui, display, solidGold } from '../lib/theme';
import { ghostBtn } from '../components/ui';

export function InviteScreen({ debateId, role, side, onAccept, onDecline }: {
  debateId: string; role: DebateRole; side: Side | null; onAccept: () => void; onDecline: () => void;
}) {
  const [debate, setDebate] = useState<Debate | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { getDebate(debateId).then(r => setDebate(r.debate)).catch(() => {}); }, [debateId]);

  const roleLabel =
    role === 'debater' ? (side === 'opp' ? 'Opposition debater' : 'Proposition debater')
    : role === 'judge' ? 'Judge'
    : role === 'moderator' ? 'Moderator'
    : 'Guest';
  const accent = role === 'debater' ? (side === 'opp' ? C.garnetHi : C.jadeHi) : C.gold;

  async function accept() {
    setErr(null); setBusy(true);
    try { await joinDebate(debateId, role, side ?? undefined); onAccept(); }
    catch (e: any) { setErr(e?.message ?? 'Could not join'); setBusy(false); }
  }

  return (
    <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center', padding:'40px 20px',
      background:`radial-gradient(120% 80% at 50% -10%, #221a13, ${C.base} 60%)` }}>
      <div style={{ width:'100%', maxWidth:460, textAlign:'center', background:C.panel,
        border:`1px solid ${C.hair}`, borderRadius:14, padding:'34px 30px' }}>
        <div style={{ fontFamily:ui, fontSize:11, fontWeight:700, letterSpacing:2.5, textTransform:'uppercase', color:C.gold }}>
          You're invited to the floor</div>
        <h1 style={{ fontFamily:display, fontSize:30, fontWeight:600, color:C.ink, margin:'12px 0 8px', lineHeight:1.1 }}>
          {debate?.motion ?? 'Loading…'}</h1>
        <p style={{ fontFamily:ui, fontSize:14, color:C.dim, margin:'0 0 22px' }}>
          The host has invited you to join as{' '}
          <span style={{ color:accent, fontWeight:700 }}>{roleLabel}</span>.
          {role !== 'audience' && ' You\u2019ll be on stage with your camera and mic.'}
        </p>

        {err && <p style={{ fontFamily:ui, fontSize:12.5, color:C.garnetHi, margin:'0 0 14px' }}>{err}</p>}

        <div style={{ display:'flex', gap:12, justifyContent:'center' }}>
          <button onClick={onDecline} style={ghostBtn}>Decline</button>
          <button onClick={accept} disabled={busy} style={{ ...solidGold, opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Taking your seat…' : 'Accept & join on stage'}
          </button>
        </div>
      </div>
    </div>
  );
}
