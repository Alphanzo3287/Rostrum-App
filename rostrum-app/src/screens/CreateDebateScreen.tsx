// =====================================================================
// The Rostrum · src/screens/CreateDebateScreen.tsx
// The Host wizard, wired. On finish it calls createDebate() (which uploads
// the thumbnail + provisions the LiveKit room), optionally stores the
// YouTube key, then opens the room in Assembly. Debaters bring their own decks.
// =====================================================================
import { useState } from 'react';
import { createDebate, setBroadcastKey } from '../lib/api';
import type { DebateFormat, Side, Visibility } from '../lib/types';
import { C, ui, display, mono, solidGold, field } from '../lib/theme';

type Seg = { label: string; side: Side | null; min: number };

const FORMATS: Record<DebateFormat, Seg[]> = {
  oxford: [
    { label: 'Proposition · Opening', side: 'prop', min: 6 }, { label: 'Opposition · Opening', side: 'opp', min: 6 },
    { label: 'Proposition · Rebuttal', side: 'prop', min: 4 }, { label: 'Opposition · Rebuttal', side: 'opp', min: 4 },
    { label: 'Moderated Q&A', side: null, min: 5 }, { label: 'Closing Statements', side: null, min: 3 },
  ],
  cross_exam: [
    { label: 'Constructive · Aff', side: 'prop', min: 6 }, { label: 'Cross-ex by Neg', side: 'opp', min: 3 },
    { label: 'Constructive · Neg', side: 'opp', min: 6 }, { label: 'Cross-ex by Aff', side: 'prop', min: 3 },
    { label: 'Rebuttals', side: null, min: 4 }, { label: 'Closing', side: null, min: 3 },
  ],
  lincoln_douglas: [
    { label: 'Affirmative Case', side: 'prop', min: 6 }, { label: 'Negative Case', side: 'opp', min: 7 },
    { label: 'Aff Rebuttal', side: 'prop', min: 4 }, { label: 'Neg Rebuttal', side: 'opp', min: 6 }, { label: 'Aff Closing', side: 'prop', min: 3 },
  ],
  town_hall: [
    { label: 'Framing', side: null, min: 5 }, { label: 'Open floor', side: null, min: 20 },
    { label: 'Audience Q&A', side: null, min: 10 }, { label: 'Wrap-up', side: null, min: 5 },
  ],
  freestyle: [{ label: 'Open dialogue', side: null, min: 30 }],
};
const FORMAT_LABEL: Record<DebateFormat, string> = {
  oxford: 'Oxford · Formal', cross_exam: 'Cross-Examination', lincoln_douglas: 'Lincoln–Douglas',
  town_hall: 'Town Hall · Open', freestyle: 'Freestyle',
};
const nextSide = (s: Side | null): Side | null => (s === null ? 'prop' : s === 'prop' ? 'opp' : null);

export function CreateDebateScreen({ onCancel, onCreated }: {
  onCancel: () => void; onCreated: (debateId: string) => void;
}) {
  const [step, setStep] = useState(1);
  const [motion, setMotion] = useState('This House would abolish the electoral college');
  const [format, setFormat] = useState<DebateFormat>('oxford');
  const [vis, setVis] = useState<Visibility>('public');
  const [thumb, setThumb] = useState<File | null>(null);
  const [thumbPrev, setThumbPrev] = useState<string | null>(null);
  const [voters, setVoters] = useState(true);
  const [segs, setSegs] = useState<Seg[]>(FORMATS.oxford);
  const [paid, setPaid] = useState(false);
  const [price, setPrice] = useState(5);
  const [gifts, setGifts] = useState(true);
  const [recording, setRecording] = useState(true);
  const [youtubeKey, setYoutubeKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pickFormat = (f: DebateFormat) => { setFormat(f); setSegs(FORMATS[f]); };
  const totalMin = segs.reduce((a, b) => a + b.min, 0);
  const sideColor = (s: Side | null) => (s === 'prop' ? C.jadeHi : s === 'opp' ? C.garnetHi : C.faint);
  const sideLabel = (s: Side | null) => (s === 'prop' ? 'PROP' : s === 'opp' ? 'OPP' : 'BOTH');

  async function create() {
    setErr(null); setBusy(true);
    try {
      const debate = await createDebate({
        motion, format, visibility: vis,
        isPaid: paid, priceCents: paid ? Math.round(price * 100) : 0,
        giftsEnabled: gifts, recordingEnabled: recording, votersEnabled: voters,
        segments: segs.map(s => ({ label: s.label, side: s.side, durationSecs: s.min * 60 })),
        thumbnailFile: thumb,
      });
      if (youtubeKey.trim()) await setBroadcastKey(debate.id, youtubeKey.trim());
      onCreated(debate.id);
    } catch (e: any) {
      setErr(e?.message ?? 'Could not create the debate'); setBusy(false);
    }
  }

  const steps = ['Motion & format', 'Run of show', 'Access & broadcast'];

  return (
    <div style={{ position:'absolute', inset:0, overflowY:'auto', background:C.base }}>
      <div style={{ maxWidth:860, margin:'0 auto', padding:'24px 24px 110px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
          <button onClick={onCancel} style={iconBtn}>‹</button>
          <h2 style={{ fontFamily:display, fontSize:30, fontWeight:600, color:C.ink, margin:0 }}>Host a debate</h2>
        </div>

        {/* stepper */}
        <div style={{ display:'flex', gap:8, marginBottom:22 }}>
          {steps.map((s, i) => (
            <button key={s} onClick={() => setStep(i + 1)} style={{ flex:1, padding:'10px', borderRadius:7, cursor:'pointer',
              fontFamily:ui, fontSize:13, fontWeight:600, textAlign:'left',
              border:`1px solid ${step === i + 1 ? C.gold : C.hair}`,
              background: step === i + 1 ? 'rgba(217,180,92,0.08)' : 'transparent', color: step === i + 1 ? C.ink : C.dim }}>
              <span style={{ fontFamily:mono, color:C.gold, marginRight:8 }}>{i + 1}</span>{s}
            </button>
          ))}
        </div>

        <div style={{ background:C.panel, border:`1px solid ${C.hair}`, borderRadius:10, padding:'22px 24px', minHeight:340 }}>
          {step === 1 && <>
            <Label>The motion</Label>
            <textarea value={motion} onChange={e => setMotion(e.target.value)} rows={2}
              style={{ ...field, fontFamily:display, fontSize:20, marginBottom:22 }} />
            <Label>Format</Label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:8, marginBottom:22 }}>
              {(Object.keys(FORMATS) as DebateFormat[]).map(f => (
                <Chip key={f} on={format === f} onClick={() => pickFormat(f)}>{FORMAT_LABEL[f]}</Chip>
              ))}
            </div>
            <Label>Visibility</Label>
            <div style={{ display:'flex', gap:8, marginTop:8, marginBottom:22 }}>
              <Chip on={vis === 'public'} onClick={() => setVis('public')}>Public</Chip>
              <Chip on={vis === 'unlisted'} onClick={() => setVis('unlisted')}>Unlisted · link only</Chip>
            </div>
            <Label>Cover thumbnail</Label>
            <label style={{ display:'block', marginTop:9, cursor:'pointer' }}>
              <input type="file" accept="image/*" style={{ display:'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) { setThumb(f); setThumbPrev(URL.createObjectURL(f)); } }} />
              <div style={{ height:170, borderRadius:8, overflow:'hidden', display:'grid', placeItems:'center',
                border:`1px ${thumb ? 'solid' : 'dashed'} ${thumb ? C.hair : C.hairHi}`,
                background: thumb ? '#000' : `linear-gradient(150deg, ${C.jade}1f, ${C.base} 72%)` }}>
                {thumbPrev ? <img src={thumbPrev} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  : <span style={{ fontFamily:ui, fontSize:13, color:C.faint }}>Upload a 16:9 cover</span>}
              </div>
            </label>
          </>}

          {step === 2 && <>
            <Label>Run of show · set each timer and which side holds the mic</Label>
            <div style={{ marginTop:12 }}>
              {segs.map((s, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:`1px solid ${C.hair}` }}>
                  <span style={{ fontFamily:mono, fontSize:11, color:C.faint, width:22 }}>{String(i + 1).padStart(2, '0')}</span>
                  <input value={s.label} onChange={e => setSegs(x => x.map((y, j) => j === i ? { ...y, label: e.target.value } : y))}
                    style={{ ...field, flex:1, padding:'8px 10px', fontSize:13 }} />
                  <button onClick={() => setSegs(x => x.map((y, j) => j === i ? { ...y, side: nextSide(y.side) } : y))}
                    style={{ width:54, fontFamily:ui, fontSize:10, fontWeight:700, color: sideColor(s.side),
                      background:'none', border:`1px solid ${C.hair}`, borderRadius:4, padding:'6px 0', cursor:'pointer' }}>
                    {sideLabel(s.side)}</button>
                  <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                    <input type="number" value={s.min} min={1} max={60}
                      onChange={e => setSegs(x => x.map((y, j) => j === i ? { ...y, min: +e.target.value } : y))}
                      style={{ ...field, width:50, padding:'8px', fontFamily:mono, textAlign:'center' }} />
                    <span style={{ fontFamily:ui, fontSize:11, color:C.faint }}>min</span>
                  </div>
                  <button onClick={() => setSegs(x => x.filter((_, j) => j !== i))} style={{ ...iconBtn, color:C.garnetHi }}>×</button>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:14 }}>
              <button onClick={() => setSegs(x => [...x, { label: 'New segment', side: null, min: 3 }])}
                style={{ ...ghost }}>＋ Add segment</button>
              <span style={{ fontFamily:mono, fontSize:12.5, color:C.dim }}>Total floor time · {totalMin} min</span>
            </div>
          </>}

          {step === 3 && <>
            <Toggle label="Audience voting" sub="Let viewers vote a verdict from their seats" on={voters} set={setVoters} />
            <Toggle label="Gifts & donations" sub="Audience can tip debaters and the host live" on={gifts} set={setGifts} />
            <Toggle label="Record & allow downloads" sub="Host and debaters get the MP4 afterward" on={recording} set={setRecording} />
            <div style={{ display:'flex', alignItems:'center', gap:14, padding:'15px 0', borderBottom:`1px solid ${C.hair}` }}>
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:ui, fontSize:14, color:C.ink, fontWeight:600 }}>Entry</div>
                <div style={{ fontFamily:ui, fontSize:12, color:C.faint, marginTop:2 }}>{paid ? 'Viewers pay at the door' : 'Open to everyone'}</div>
              </div>
              <Chip on={!paid} onClick={() => setPaid(false)}>Free</Chip>
              <Chip on={paid} onClick={() => setPaid(true)}>Paid</Chip>
              {paid && <input type="number" value={price} min={1} onChange={e => setPrice(+e.target.value)}
                style={{ ...field, width:80, textAlign:'center' }} />}
            </div>

            <div style={{ marginTop:18 }}>
              <Label>YouTube stream key <span style={{ color:C.faint, fontWeight:400 }}>(optional — simulcast)</span></Label>
              <input value={youtubeKey} onChange={e => setYoutubeKey(e.target.value)} placeholder="xxxx-xxxx-xxxx-xxxx"
                style={{ ...field, marginTop:8 }} />
              <p style={{ fontFamily:ui, fontSize:11.5, color:C.faint, marginTop:6 }}>
                Stored privately — only used server-side when you go live.</p>
            </div>

            <p style={{ fontFamily:ui, fontSize:11.5, color:C.faint, marginTop:18, lineHeight:1.5 }}>
              Slides are uploaded by the debaters themselves — each side shares its own deck from the floor
              once they’ve taken their seat.</p>
          </>}
        </div>

        {err && <p style={{ fontFamily:ui, color:C.garnetHi, marginTop:14 }}>{err}</p>}
      </div>

      {/* footer */}
      <div style={{ position:'sticky', bottom:0, display:'flex', gap:12, padding:'14px 24px',
        borderTop:`1px solid ${C.hair}`, background:'rgba(12,11,13,0.92)' }}>
        <span style={{ fontFamily:ui, fontSize:12, color:C.faint, alignSelf:'center' }}>Step {step} of 3</span>
        <div style={{ marginLeft:'auto', display:'flex', gap:10 }}>
          {step > 1 && <button onClick={() => setStep(s => s - 1)} style={ghost}>Back</button>}
          {step < 3
            ? <button onClick={() => setStep(s => s + 1)} style={solidGold}>Continue</button>
            : <button onClick={create} disabled={busy} style={{ ...solidGold, opacity: busy ? 0.6 : 1 }}>
                {busy ? 'Opening the hall…' : 'Create & open the hall'}</button>}
        </div>
      </div>
    </div>
  );
}

/* atoms */
const Label = ({ children }: { children: React.ReactNode }) =>
  <span style={{ fontFamily:ui, fontSize:11.5, fontWeight:700, letterSpacing:'.8px', textTransform:'uppercase', color:C.dim }}>{children}</span>;
function Chip({ on, onClick, children }: any) {
  return <button onClick={onClick} style={{ padding:'9px 14px', borderRadius:6, cursor:'pointer', fontFamily:ui, fontSize:13,
    fontWeight:600, border:`1px solid ${on ? C.gold : C.hair}`, background: on ? 'rgba(217,180,92,0.1)' : 'transparent',
    color: on ? C.gold : C.dim }}>{children}</button>;
}
function Toggle({ label, sub, on, set }: { label: string; sub: string; on: boolean; set: (b: boolean) => void }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:14, padding:'15px 0', borderBottom:`1px solid ${C.hair}` }}>
      <div style={{ flex:1 }}>
        <div style={{ fontFamily:ui, fontSize:14, color:C.ink, fontWeight:600 }}>{label}</div>
        <div style={{ fontFamily:ui, fontSize:12, color:C.faint, marginTop:2 }}>{sub}</div>
      </div>
      <button onClick={() => set(!on)} style={{ width:42, height:24, borderRadius:999, border:'none', cursor:'pointer',
        background: on ? C.jade : C.panel2, position:'relative' }}>
        <span style={{ position:'absolute', top:3, left: on ? 21 : 3, width:18, height:18, borderRadius:'50%', background:'#fff', transition:'left .2s' }} />
      </button>
    </div>
  );
}
const ghost: React.CSSProperties = { display:'inline-flex', alignItems:'center', gap:7, padding:'10px 16px', borderRadius:5,
  border:`1px solid ${C.hair}`, background:'transparent', color:C.dim, fontFamily:ui, fontSize:13, fontWeight:600, cursor:'pointer' };
const iconBtn: React.CSSProperties = { width:32, height:32, borderRadius:5, border:`1px solid ${C.hair}`,
  background:'rgba(0,0,0,0.25)', color:C.dim, cursor:'pointer', fontSize:16, lineHeight:1 };
