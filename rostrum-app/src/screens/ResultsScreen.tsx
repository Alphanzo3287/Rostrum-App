// =====================================================================
// The Rostrum · src/screens/ResultsScreen.tsx
// Batch C3 — Post-Debate Results (concept panel 7).
// Reads the finalized result + debate summary aggregate + the debate (for
// the recording), shows the verdict, competitor scorecards, judges
// decision, and a real debate-summary strip — then offers Download MP4 +
// share links exactly as before. Every number here traces to a real RPC.
// =====================================================================
import { useEffect, useState } from 'react';
import { getResults, getDebate, listParticipants, getDebateSummary, type DebateSummary } from '../lib/api';
import type { Debate, DebateResult, Participant, Profile, Side } from '../lib/types';
import { C, ui, display, mono, solidGold } from '../lib/theme';
import { ResultCompetitorCard, JudgesDecisionCard, DebateSummaryPanel } from '../components/hall';

type PartWithProfile = Participant & { profile: Profile };

export function ResultsScreen({ debateId, onBackToLobby }: {
  debateId: string; onBackToLobby: () => void;
}) {
  const [result, setResult] = useState<DebateResult | null>(null);
  const [debate, setDebate] = useState<Debate | null>(null);
  const [parts, setParts] = useState<PartWithProfile[]>([]);
  const [summary, setSummary] = useState<DebateSummary | null>(null);

  useEffect(() => {
    getResults(debateId).then(setResult).catch(() => {});
    getDebate(debateId).then(r => setDebate(r.debate)).catch(() => {});
    listParticipants(debateId).then(setParts).catch(() => {});
    getDebateSummary(debateId).then(setSummary).catch(() => {});
  }, [debateId]);

  const propScore = (result?.prop_judge_total ?? 0) + (result?.prop_audience ?? 0);
  const oppScore  = (result?.opp_judge_total ?? 0) + (result?.opp_audience ?? 0);
  const winner = result?.winner_side ?? null;
  const winColor = winner === 'prop' ? C.jade : winner === 'opp' ? C.garnet : C.gold;
  const debaters = (side: Side) => parts.filter(p => p.role === 'debater' && p.side === side);
  const propDebater = debaters('prop')[0];
  const oppDebater = debaters('opp')[0];

  return (
    <div style={{ position:'absolute', inset:0, overflowY:'auto', background:C.base }}>
      <div style={{ maxWidth:1000, margin:'0 auto', padding:'40px 24px 80px' }}>

        {(debate?.format === 'legacy' || debate?.format === 'lecture') ? (
          <div style={{ textAlign:'center', padding:'40px 20px', borderRadius:14, marginBottom:26,
            border:`1px solid ${C.hair}`, background:C.panel }}>
            <h1 style={{ fontFamily:display, fontSize:32, fontWeight:600, color:C.ink, margin:'0 0 8px' }}>
              Thanks for joining our event</h1>
            <p style={{ fontFamily:ui, fontSize:14, color:C.dim, margin:0 }}>{debate?.motion}</p>
          </div>
        ) : (
          <>
            {/* verdict banner */}
            <div style={{ textAlign:'center', padding:'34px 20px', borderRadius:14, marginBottom:26,
              border:`1px solid ${winColor}55`, background:`radial-gradient(90% 140% at 50% -30%, ${winColor}22, transparent 60%)` }}>
              <div style={{ fontFamily:ui, fontSize:11, fontWeight:700, letterSpacing:2.5, textTransform:'uppercase', color:C.gold }}>
                The house has decided</div>
              <h1 style={{ fontFamily:display, fontSize:44, fontWeight:600, color:C.ink, margin:'10px 0 6px' }}>
                {winner === 'prop' ? 'Proposition' : winner === 'opp' ? 'Opposition' : 'A tie'}</h1>
              <p style={{ fontFamily:ui, fontSize:14, color:C.dim, margin:0 }}>{debate?.motion}</p>
            </div>

            {/* scorecards + judges decision */}
            <div style={{ display:'grid', gap:14, marginBottom:18,
              gridTemplateColumns:'1fr minmax(180px,220px) 1fr' }}>
              <ResultCompetitorCard side="prop" name={propDebater?.profile?.display_name ?? 'Proposition'}
                avatarUrl={propDebater?.profile?.avatar_url} score={propScore} isWinner={winner === 'prop'} />
              <JudgesDecisionCard propWins={summary?.judge_prop_wins ?? 0} oppWins={summary?.judge_opp_wins ?? 0}
                judgeCount={summary?.judge_count ?? 0} />
              <ResultCompetitorCard side="opp" name={oppDebater?.profile?.display_name ?? 'Opposition'}
                avatarUrl={oppDebater?.profile?.avatar_url} score={oppScore} isWinner={winner === 'opp'} />
            </div>
          </>
        )}

        {/* debate summary */}
        {debate?.format !== 'legacy' && debate?.format !== 'lecture' && (
          <div style={{ marginBottom:26 }}>
            <DebateSummaryPanel summary={summary ?? { total_time_secs:0, evidence_count:0, audience_votes:0, chat_count:0 }} />
          </div>
        )}

        {/* recording + share */}
        <div style={{ background:C.panel, border:`1px solid ${C.hair}`, borderRadius:12, padding:'18px 20px' }}>
          <div style={{ fontFamily:display, fontSize:20, color:C.ink, fontWeight:600, marginBottom:14 }}>Take it with you</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:12, alignItems:'center' }}>
            {debate?.recording_url
              ? <a href={debate.recording_url} download style={{ ...solidGold, textDecoration:'none' }}>▶ Watch Replay</a>
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

function Share({ label, href }: { label: string; href: string }) {
  return <a href={href} target="_blank" rel="noreferrer" style={{ fontFamily:ui, fontSize:13, fontWeight:600, color:C.dim,
    textDecoration:'none', padding:'10px 14px', borderRadius:5, border:`1px solid ${C.hair}` }}>{label}</a>;
}
function shareUrl(_net: 'x', debate: Debate | null) {
  const text = encodeURIComponent(`I just debated "${debate?.motion ?? ''}" on The Rostrum`);
  return `https://twitter.com/intent/tweet?text=${text}`;
}
