// =====================================================================
// The Rostrum · src/screens/ResultsScreen.tsx
// Post-debate. Reads the finalized result + the debate (for the recording),
// shows the verdict and tallies, and offers Download MP4 + share links.
// =====================================================================
import { useEffect, useState } from 'react';
import { getResults, getDebate, listParticipants } from '../lib/api';
import type { Debate, DebateResult, Participant, Profile, Side } from '../lib/types';
import { C, ui, display, mono, solidGold } from '../lib/theme';

type PartWithProfile = Participant & { profile: Profile };

export function ResultsScreen({ debateId, onBackToLobby }: {
  debateId: string; onBackToLobby: () => void;
}) {
  const [result, setResult] = useState<DebateResult | null>(null);
  const [debate, setDebate] = useState<Debate | null>(null);
  const [parts, setParts] = useState<PartWithProfile[]>([]);

  useEffect(() => {
    getResults(debateId).then(setResult).catch(() => {});
    getDebate(debateId).then(r => setDebate(r.debate)).catch(() => {});
    listParticipants(debateId).then(setParts).catch(() => {});
  }, [debateId]);

  const propScore = (result?.prop_judge_total ?? 0) + (result?.prop_audience ?? 0);
  const oppScore  = (result?.opp_judge_total ?? 0) + (result?.opp_audience ?? 0);
  const winner = result?.winner_side ?? null;
  const winColor = winner === 'prop' ? C.jade : winner === 'opp' ? C.garnet : C.gold;
  const debaters = (side: Side) => parts.filter(p => p.role === 'debater' && p.side === side);

  return (
    <div style={{ position:'absolute', inset:0, overflowY:'auto', background:C.base }}>
      <div style={{ maxWidth:880, margin:'0 auto', padding:'40px 24px 80px' }}>

        {/* verdict banner */}
        <div style={{ textAlign:'center', padding:'34px 20px', borderRadius:14, marginBottom:26,
          border:`1px solid ${winColor}55`, background:`radial-gradient(90% 140% at 50% -30%, ${winColor}22, transparent 60%)` }}>
          <div style={{ fontFamily:ui, fontSize:11, fontWeight:700, letterSpacing:2.5, textTransform:'uppercase', color:C.gold }}>
            The house has decided</div>
          <h1 style={{ fontFamily:display, fontSize:44, fontWeight:600, color:C.ink, margin:'10px 0 6px' }}>
            {winner === 'prop' ? 'Proposition' : winner === 'opp' ? 'Opposition' : 'A tie'}</h1>
          <p style={{ fontFamily:ui, fontSize:14, color:C.dim, margin:0 }}>{debate?.motion}</p>
        </div>

        {/* tallies */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:26 }}>
          <SideCard label="Proposition" color={C.jade} hi={C.jadeHi} win={winner === 'prop'}
            total={propScore} judge={result?.prop_judge_total ?? 0} audience={result?.prop_audience ?? 0}
            people={debaters('prop')} />
          <SideCard label="Opposition" color={C.garnet} hi={C.garnetHi} win={winner === 'opp'}
            total={oppScore} judge={result?.opp_judge_total ?? 0} audience={result?.opp_audience ?? 0}
            people={debaters('opp')} />
        </div>

        {/* recording + share */}
        <div style={{ background:C.panel, border:`1px solid ${C.hair}`, borderRadius:12, padding:'18px 20px' }}>
          <div style={{ fontFamily:display, fontSize:20, color:C.ink, fontWeight:600, marginBottom:14 }}>Take it with you</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:12, alignItems:'center' }}>
            {debate?.recording_url
              ? <a href={debate.recording_url} download style={{ ...solidGold, textDecoration:'none' }}>⬇ Download MP4</a>
              : <span style={{ fontFamily:ui, fontSize:13, color:C.faint }}>Recording is processing — check back shortly.</span>}
            <Share label="Share on X" href={shareUrl('x', debate)} />
            <Share label="YouTube" href="https://studio.youtube.com" />
            <Share label="Instagram" href="https://www.instagram.com" />
          </div>
        </div>

        <div style={{ textAlign:'center', marginTop:30 }}>
          <button onClick={onBackToLobby} style={{ ...solidGold }}>Back to the lobby</button>
        </div>
      </div>
    </div>
  );
}

function SideCard({ label, color, hi, win, total, judge, audience, people }: {
  label: string; color: string; hi: string; win: boolean; total: number; judge: number; audience: number; people: PartWithProfile[];
}) {
  return (
    <div style={{ padding:'18px 18px', borderRadius:12, border:`1px solid ${win ? color : C.hair}`,
      background: win ? `${color}12` : C.panel }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span style={{ fontFamily:ui, fontSize:11, fontWeight:700, letterSpacing:1.2, textTransform:'uppercase', color:hi }}>{label}</span>
        {win && <span style={{ fontFamily:ui, fontSize:10.5, fontWeight:700, color:C.base, background:hi, padding:'2px 8px', borderRadius:3 }}>WINNER</span>}
      </div>
      <div style={{ fontFamily:mono, fontSize:38, color:C.ink, fontWeight:700, margin:'8px 0 2px' }}>{total}</div>
      <div style={{ fontFamily:mono, fontSize:12, color:C.dim }}>judges {judge} · audience {audience}</div>
      <div style={{ marginTop:14, display:'flex', flexDirection:'column', gap:6 }}>
        {people.map(p => (
          <span key={p.user_id} style={{ fontFamily:ui, fontSize:13, color:C.ink }}>{p.profile?.display_name ?? '—'}</span>
        ))}
      </div>
    </div>
  );
}

function Share({ label, href }: { label: string; href: string }) {
  return <a href={href} target="_blank" rel="noreferrer" style={{ fontFamily:ui, fontSize:13, fontWeight:600, color:C.dim,
    textDecoration:'none', padding:'10px 14px', borderRadius:5, border:`1px solid ${C.hair}` }}>{label}</a>;
}
function shareUrl(_net: 'x', debate: Debate | null) {
  const text = encodeURIComponent(`I just debated “${debate?.motion ?? ''}” on The Rostrum`);
  return `https://twitter.com/intent/tweet?text=${text}`;
}
