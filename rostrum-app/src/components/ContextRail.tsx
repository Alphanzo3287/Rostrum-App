// =====================================================================
// The Rostrum · src/components/ContextRail.tsx
// The side panel, wired. Vote → castVote/subscribeTally, Q&A →
// askQuestion/subscribeQuestions/setQuestionStatus, Score → submitBallot.
// =====================================================================
import { useEffect, useState } from 'react';
import {
  castVote, getTally, subscribeTally,
  askQuestion, setQuestionStatus, subscribeQuestions,
  submitBallot,
} from '../lib/api';
import type { Side, Question, Segment } from '../lib/types';
import { C, ui, display, mono, solidGold, field } from '../lib/theme';
import { supabase } from '../lib/supabaseClient';
import { ShareButton } from './ShareSheet';

type Role = 'host' | 'moderator' | 'debater' | 'judge' | 'audience';

export type RosData = {
  segments: Segment[]; segIdx: number; remaining: number; running: boolean;
  phase: 'assembly' | 'live' | 'ended';
  onJump: (i: number) => void; onToggle: () => void; onNext: () => void; onSetRemaining: (s: number) => void;
};

export function ContextRail({ debateId, role, tab, setTab, ros }: {
  debateId: string; role: Role; tab: string; setTab: (t: string) => void; ros?: RosData;
}) {
  const tabs = role === 'host'  ? [['invite','Invite'],['ros','Run'],['qa','Q&A'],['poll','Poll']]
            : role === 'judge'  ? [['score','Score'],['qa','Q&A'],['poll','Poll']]
            :                     [['vote','Vote'],['qa','Ask'],['poll','Poll']];
  return (
    <aside style={{ borderLeft:`1px solid ${C.hair}`, background:'rgba(20,18,22,0.92)', display:'flex', flexDirection:'column', minHeight:0 }}>
      <div style={{ display:'flex', padding:8, gap:6, borderBottom:`1px solid ${C.hair}` }}>
        {tabs.map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ flex:1, padding:'8px 0', borderRadius:4, border:'none',
            cursor:'pointer', fontFamily:ui, fontSize:11.5, fontWeight:600,
            color: tab===k ? C.base : C.dim, background: tab===k ? C.gold : 'transparent' }}>{l}</button>
        ))}
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:16 }}>
        {tab==='invite' && <InvitePanel debateId={debateId} />}
        {tab==='ros' && (ros ? <RosPanel ros={ros} /> : <p style={{ fontFamily:ui, fontSize:12.5, color:C.faint }}>Run of show is unavailable.</p>)}
        {(tab==='vote'||tab==='poll') && <PollPanel debateId={debateId} canVote={role==='audience'} />}
        {tab==='qa' && <QAPanel debateId={debateId} canModerate={role==='host'||role==='moderator'} />}
        {tab==='score' && <ScorePanel debateId={debateId} />}
      </div>
    </aside>
  );
}

/* ----- run of show (host) ----- */
const SIDE_CHIP: Record<string, { label: string; c: string }> = {
  prop: { label: 'PROP', c: C.jadeHi }, opp: { label: 'OPP', c: C.garnetHi },
};
function RosPanel({ ros }: { ros: RosData }) {
  const { segments, segIdx, remaining, running, phase, onJump, onToggle, onNext, onSetRemaining } = ros;
  const live = phase === 'live';
  const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  function openEdit() { setDraft(mmss(remaining)); setEditing(true); }
  function applyEdit() {
    const t = draft.trim();
    const m = t.match(/^(\d+):([0-5]?\d)$/);
    const secs = m ? (+m[1]) * 60 + (+m[2]) : /^\d+$/.test(t) ? (+t) * 60 : NaN;
    if (!Number.isNaN(secs)) onSetRemaining(secs);
    setEditing(false);
  }
  const bump = (d: number) => onSetRemaining(Math.max(0, remaining + d));

  return (
    <>
      <h3 style={{ fontFamily:display, fontSize:21, color:C.ink, margin:'0 0 4px' }}>Run of show</h3>
      <p style={{ fontFamily:ui, fontSize:12, color:C.faint, margin:'0 0 14px', lineHeight:1.45 }}>
        Tap a segment to move the floor to it. The clock starts only when you press Start.</p>

      {live && (
        <div style={{ border:`1px solid ${C.hair}`, borderRadius:9, padding:'13px 13px 15px', background:C.panel, marginBottom:16 }}>
          {!editing ? (
            <button onClick={openEdit} title="Tap to edit the time"
              style={{ display:'block', width:'100%', textAlign:'center', fontFamily:mono, fontWeight:700, fontSize:34,
                letterSpacing:1, color: remaining<=30 ? C.ember : C.ink, background:'none', border:'none', cursor:'pointer', padding:'2px 0 8px' }}>
              {mmss(remaining)}
            </button>
          ) : (
            <div style={{ display:'flex', gap:7, marginBottom:10 }}>
              <input autoFocus value={draft} onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key==='Enter') applyEdit(); if (e.key==='Escape') setEditing(false); }}
                placeholder="mm:ss" style={{ ...field, flex:1, fontFamily:mono, textAlign:'center', fontSize:16 }} />
              <button onClick={applyEdit} style={{ ...solidGold, padding:'0 14px' }}>Set</button>
            </div>
          )}
          <div style={{ display:'flex', gap:6, justifyContent:'center', marginBottom:11 }}>
            {[-60,-30,30,60].map(d => (
              <button key={d} onClick={() => bump(d)} style={miniBtn}>
                {d>0?'+':'−'}{Math.abs(d)>=60?`${Math.abs(d)/60}m`:`${Math.abs(d)}s`}</button>
            ))}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={onToggle} style={{ ...solidGold, flex:1, background: running ? 'transparent' : undefined,
              color: running ? C.ink : C.base, border: running ? `1px solid ${C.hairHi}` : 'none' }}>
              {running ? 'Pause clock' : 'Start clock'}</button>
            <button onClick={onNext} style={{ ...ghostRail, flex:1 }}>Next segment</button>
          </div>
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
        {segments.map((s, i) => {
          const cur = i === segIdx;
          const chip = s.side ? SIDE_CHIP[s.side] : null;
          const clickable = live;
          return (
            <button key={s.id} onClick={clickable ? () => onJump(i) : undefined}
              style={{ display:'flex', alignItems:'center', gap:10, textAlign:'left', width:'100%',
                padding:'10px 12px', borderRadius:7, cursor: clickable ? 'pointer' : 'default',
                border:`1px solid ${cur ? C.gold : C.hair}`, background: cur ? 'rgba(217,180,92,0.10)' : C.panel }}>
              <span style={{ fontFamily:mono, fontSize:11, color: cur ? C.gold : C.faint, width:20 }}>{String(i+1).padStart(2,'0')}</span>
              <span style={{ flex:1, fontFamily:ui, fontSize:13, fontWeight:600, color: cur ? C.ink : C.dim,
                whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{s.label}</span>
              {chip && <span style={{ fontFamily:ui, fontSize:9, fontWeight:700, letterSpacing:'.5px', color:chip.c,
                border:`1px solid ${chip.c}55`, borderRadius:3, padding:'2px 5px' }}>{chip.label}</span>}
              <span style={{ fontFamily:mono, fontSize:11.5, color:C.faint, width:34, textAlign:'right' }}>{Math.round(s.duration_secs/60)}m</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
const miniBtn: React.CSSProperties = { fontFamily:ui, fontSize:11, fontWeight:700, color:C.dim,
  background:C.base, border:`1px solid ${C.hair}`, borderRadius:5, padding:'5px 9px', cursor:'pointer' };
const ghostRail: React.CSSProperties = { fontFamily:ui, fontSize:12.5, fontWeight:700, color:C.ink,
  background:'transparent', border:`1px solid ${C.hairHi}`, borderRadius:6, padding:'10px 0', cursor:'pointer' };

/* ----- invite (host) ----- */
function InvitePanel({ debateId }: { debateId: string }) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const seats: { label: string; q: string; color: string }[] = [
    { label: 'Proposition debater', q: 'role=debater&side=prop', color: C.jadeHi },
    { label: 'Opposition debater',  q: 'role=debater&side=opp',  color: C.garnetHi },
    { label: 'Moderator',           q: 'role=moderator',          color: C.gold },
    { label: 'Judge',               q: 'role=judge',              color: C.dim },
  ];
  const [copied, setCopied] = useState<string | null>(null);
  const link = (q: string) => `${origin}/debate/${debateId}/join?${q}`;
  async function copy(q: string) {
    try { await navigator.clipboard.writeText(link(q)); setCopied(q); setTimeout(() => setCopied(null), 1600); }
    catch { /* clipboard blocked — the field is selectable as a fallback */ }
  }
  return (
    <>
      <h3 style={{ fontFamily:display, fontSize:21, color:C.ink, margin:'0 0 6px' }}>Invite to the floor</h3>
      <p style={{ fontFamily:ui, fontSize:12.5, color:C.faint, margin:'0 0 16px', lineHeight:1.45 }}>
        Copy a seat's link and send it however you like. When they open it, they can accept to join on stage in that role.</p>

      <div style={{ border:`1px solid ${C.hairHi}`, borderRadius:9, padding:'12px 13px', background:C.panel2,
        marginBottom:16, display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
        <div style={{ minWidth:0 }}>
          <div style={{ fontFamily:ui, fontSize:12.5, fontWeight:700, color:C.ink }}>Public watch link</div>
          <div style={{ fontFamily:ui, fontSize:11.5, color:C.faint, marginTop:2 }}>Anyone can watch — share it anywhere.</div>
        </div>
        <ShareButton url={`${origin}/debate/${debateId}`} title="A debate on The Rostrum"
          text="Watch this debate live on The Rostrum" />
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {seats.map(s => (
          <div key={s.q} style={{ border:`1px solid ${C.hair}`, borderRadius:8, padding:'11px 12px', background:C.panel }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
              <span style={{ fontFamily:ui, fontSize:12.5, fontWeight:700, color:s.color }}>{s.label}</span>
              <button onClick={() => copy(s.q)} style={{ fontFamily:ui, fontSize:11, fontWeight:600, color:C.base,
                background:C.gold, border:'none', borderRadius:4, padding:'5px 11px', cursor:'pointer' }}>
                {copied===s.q ? 'Copied ✓' : 'Copy link'}</button>
            </div>
            <input readOnly value={link(s.q)} onFocus={e => e.currentTarget.select()}
              style={{ width:'100%', fontFamily:mono, fontSize:10.5, color:C.dim, background:C.base,
                border:`1px solid ${C.hair}`, borderRadius:4, padding:'6px 8px' }} />
          </div>
        ))}
      </div>
    </>
  );
}

/* ----- poll ----- */
function PollPanel({ debateId, canVote }: { debateId: string; canVote: boolean }) {
  const [t, setT] = useState({ prop: 0, opp: 0 });
  const [voted, setVoted] = useState<Side | null>(null);
  useEffect(() => {
    getTally(debateId).then(setT);
    return subscribeTally(debateId, setT);
  }, [debateId]);
  const total = t.prop + t.opp || 1;

  async function vote(side: Side) {
    if (voted) return;
    setVoted(side);
    try { setT(await castVote(debateId, side)); } catch { setVoted(null); }
  }
  const Bar = ({ k, label, c }: { k: Side; label: string; c: string }) => {
    const pct = Math.round((t[k] / total) * 100);
    return (
      <div style={{ marginBottom: 14 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6, fontFamily:ui, fontSize:13, color:C.ink }}>
          <span>{label}</span><span style={{ fontFamily:mono, color:C.dim }}>{pct}% · {t[k]}</span>
        </div>
        <div style={{ height:11, borderRadius:6, background:C.base, border:`1px solid ${C.hair}`, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${pct}%`, background:c, transition:'width .5s' }} />
        </div>
      </div>
    );
  };

  return (
    <>
      <h3 style={{ fontFamily:display, fontSize:21, color:C.ink, margin:'0 0 14px' }}>Audience verdict</h3>
      <Bar k="prop" label="Proposition" c={C.jade} />
      <Bar k="opp" label="Opposition" c={C.garnet} />
      {canVote && (
        <div style={{ marginTop:16, paddingTop:14, borderTop:`1px solid ${C.hair}` }}>
          {!voted && <div style={{ fontFamily:ui, fontSize:11, fontWeight:700, letterSpacing:1, textTransform:'uppercase', color:C.dim, marginBottom:10 }}>Cast your vote</div>}
          <div style={{ display:'flex', gap:10 }}>
            <VoteBtn label="Proposition" side="prop" c={C.jade} hi={C.jadeHi} voted={voted} onClick={() => vote('prop')} />
            <VoteBtn label="Opposition" side="opp" c={C.garnet} hi={C.garnetHi} voted={voted} onClick={() => vote('opp')} />
          </div>
        </div>
      )}
    </>
  );
}
function VoteBtn({ label, side, c, hi, voted, onClick }: any) {
  const chosen = voted === side;
  return (
    <button onClick={onClick} disabled={!!voted} style={{ flex:1, padding:'12px 8px', borderRadius:7,
      cursor: voted ? 'default' : 'pointer', fontFamily:ui, fontWeight:700, fontSize:13,
      border:`1px solid ${chosen ? hi : voted ? C.hair : c}`,
      background: voted ? (chosen ? `${c}22` : 'transparent') : `linear-gradient(180deg,${hi},${c})`,
      color: voted ? (chosen ? hi : C.faint) : C.base, opacity: voted && !chosen ? 0.5 : 1 }}>
      {chosen ? `Voted ${label}` : label}
    </button>
  );
}

/* ----- Q&A ----- */
function QAPanel({ debateId, canModerate }: { debateId: string; canModerate: boolean }) {
  const [items, setItems] = useState<Question[]>([]);
  const [input, setInput] = useState('');

  async function load() {
    const { data } = await supabase.from('questions').select('*')
      .eq('debate_id', debateId).order('created_at', { ascending: true });
    setItems((data ?? []) as Question[]);
  }
  useEffect(() => { load(); return subscribeQuestions(debateId, load); }, [debateId]);

  async function send() {
    if (!input.trim()) return;
    const body = input.trim(); setInput('');
    try { await askQuestion(debateId, body); } catch { setInput(body); }
  }

  return (
    <>
      <h3 style={{ fontFamily:display, fontSize:21, color:C.ink, margin:'0 0 14px' }}>Questions to the floor</h3>
      <div style={{ display:'flex', flexDirection:'column', gap:9, marginBottom:14 }}>
        {items.filter(q => canModerate || q.status !== 'dismissed').map(q => (
          <div key={q.id} style={{ background:C.panel, border:`1px solid ${C.hair}`, borderRadius:6, padding:'10px 12px' }}>
            <p style={{ fontFamily:ui, fontSize:13, color:C.ink, margin:0, lineHeight:1.4 }}>{q.body}</p>
            {canModerate && q.status === 'queued' && (
              <div style={{ display:'flex', gap:8, marginTop:8 }}>
                <button onClick={() => setQuestionStatus(q.id, 'approved')} style={mini(C.jade)}>Approve</button>
                <button onClick={() => setQuestionStatus(q.id, 'dismissed')} style={mini(C.faint)}>Dismiss</button>
              </div>
            )}
            {q.status === 'approved' && <span style={{ fontFamily:ui, fontSize:10.5, color:C.jadeHi }}>● up next</span>}
          </div>
        ))}
      </div>
      <div style={{ display:'flex', gap:7 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key==='Enter' && send()}
          placeholder="Ask the host…" style={{ ...field, fontSize:13 }} />
        <button onClick={send} style={{ ...solidGold, padding:'0 13px' }}>Send</button>
      </div>
    </>
  );
}
const mini = (c: string): React.CSSProperties => ({ fontFamily:ui, fontSize:10.5, fontWeight:600, color:c,
  background:'none', border:`1px solid ${c}66`, borderRadius:3, padding:'2px 7px', cursor:'pointer' });

/* ----- judge scorecard ----- */
function ScorePanel({ debateId }: { debateId: string }) {
  const crit = ['Argument', 'Evidence', 'Rebuttal', 'Delivery'];
  const [sc, setSc] = useState<{ prop: number[]; opp: number[] }>({ prop: [7,7,7,7], opp: [7,7,7,7] });
  const [done, setDone] = useState(false);
  const tot = (s: 'prop'|'opp') => sc[s].reduce((a, b) => a + b, 0);
  const set = (s: 'prop'|'opp', i: number, v: number) =>
    setSc(p => ({ ...p, [s]: p[s].map((x, j) => (j === i ? v : x)) }));

  async function submit() {
    const toObj = (s: 'prop'|'opp') => Object.fromEntries(crit.map((c, i) => [c.toLowerCase(), sc[s][i]]));
    try { await submitBallot(debateId, { prop: toObj('prop'), opp: toObj('opp') }); setDone(true); }
    catch (e: any) { alert(e?.message ?? 'Could not submit'); }
  }

  return (
    <>
      <h3 style={{ fontFamily:display, fontSize:21, color:C.ink, margin:'0 0 14px' }}>Judge scorecard</h3>
      {crit.map((cn, i) => (
        <div key={cn} style={{ marginBottom:14 }}>
          <div style={{ fontFamily:ui, fontSize:12, color:C.dim, fontWeight:600, marginBottom:7 }}>{cn}</div>
          {(['prop','opp'] as const).map(s => (
            <div key={s} style={{ display:'flex', alignItems:'center', gap:9, marginBottom:6 }}>
              <span style={{ width:34, fontFamily:ui, fontSize:10, fontWeight:700, textTransform:'uppercase',
                color: s==='prop' ? C.jadeHi : C.garnetHi }}>{s}</span>
              <input type="range" min={0} max={10} value={sc[s][i]} onChange={e => set(s, i, +e.target.value)}
                style={{ flex:1, accentColor: s==='prop' ? C.jade : C.garnet }} />
              <span style={{ width:18, fontFamily:mono, fontSize:12, color:C.ink, textAlign:'right' }}>{sc[s][i]}</span>
            </div>
          ))}
        </div>
      ))}
      <div style={{ display:'flex', justifyContent:'space-between', padding:'12px 0', borderTop:`1px solid ${C.hair}`, margin:'4px 0 14px' }}>
        <span style={{ fontFamily:mono, color:C.jadeHi }}>Prop {tot('prop')}</span>
        <span style={{ fontFamily:mono, color:C.garnetHi }}>Opp {tot('opp')}</span>
      </div>
      <button onClick={submit} style={{ ...solidGold, width:'100%' }}>{done ? 'Ballot submitted ✓' : 'Submit ballot'}</button>
    </>
  );
}
