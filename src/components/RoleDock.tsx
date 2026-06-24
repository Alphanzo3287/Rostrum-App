// =====================================================================
// The Rostrum · src/components/RoleDock.tsx
// The bottom control dock, wired. Controls differ by role; the host's
// buttons call the real room actions, the debater's mic respects the
// server-granted permission, and "Share slides" uploads the deck.
// =====================================================================
import { useRef, useState } from 'react';
import { uploadDeck } from '../lib/api';
import { muteAudience } from '../lib/livekit';
import { C, ui } from '../lib/theme';

type Role = 'host' | 'moderator' | 'debater' | 'judge' | 'audience';

interface Props {
  debateId: string;
  role: Role;
  phase: 'assembly' | 'live' | 'ended';
  running: boolean;
  canPublish: boolean;
  micOn: boolean;
  camOn: boolean;
  toggleMic: () => void;
  toggleCam: () => void;
  onGoLive: () => void;
  onNextSegment: () => void;
  onToggleTimer: () => void;
  onEnd: () => void;
  setTab: (t: string) => void;
  onLeave: () => void;
}

export function RoleDock(p: Props) {
  // ---- assembly (pre-gavel) ----
  if (p.phase === 'assembly') {
    return (
      <Dock>
        {p.role === 'host'
          ? <Btn primary label="Begin debate · go live" onClick={p.onGoLive} />
          : <Note>Waiting for the host to begin — the hall is filling.</Note>}
      </Dock>
    );
  }

  // ---- live ----
  if (p.role === 'host') {
    return (
      <Dock>
        <Btn label={p.running ? 'Pause clock' : 'Start clock'} onClick={p.onToggleTimer} />
        <Btn label="Next segment" onClick={p.onNextSegment} />
        <Btn label="Mute all" onClick={() => muteAudience(p.debateId)} />
        <Sep />
        <Btn danger label="End event" onClick={p.onEnd} />
      </Dock>
    );
  }

  if (p.role === 'debater' || p.role === 'moderator') {
    return (
      <Dock>
        <Btn active={p.micOn} disabled={!p.canPublish}
          label={p.canPublish ? (p.micOn ? 'Mic on' : 'Mic off') : 'Not your turn'}
          onClick={p.toggleMic} accent={C.jade} />
        <Btn active={p.camOn} disabled={!p.canPublish} label="Camera" onClick={p.toggleCam} />
        <ShareSlides debateId={p.debateId} disabled={!p.canPublish} />
        <Sep />
        <Note>
          {p.canPublish ? 'You hold the floor — opponents are muted until their segment.'
                        : 'Your mic opens automatically when your segment begins.'}
        </Note>
      </Dock>
    );
  }

  if (p.role === 'judge') {
    return (
      <Dock>
        <Btn label="Scorecard" accent={C.gold} active onClick={() => p.setTab('score')} />
        <Btn disabled={!p.canPublish} label="Mic (Q&A)" onClick={p.toggleMic} />
        <Btn active={p.camOn} disabled={!p.canPublish} label="Camera" onClick={p.toggleCam} />
        <Sep />
        <Note>Submit your ballot before closing statements end.</Note>
      </Dock>
    );
  }

  // ---- audience ----
  return (
    <Dock>
      <Btn disabled label="Mic off" />
      <Btn label="Vote" accent={C.gold} onClick={() => p.setTab('vote')} />
      <Btn label="Ask" onClick={() => p.setTab('qa')} />
      <Sep />
      <Note>Audience is muted by house rule — questions go to the host during Q&A.</Note>
      <button onClick={p.onLeave} style={{ ...btnBase, marginLeft:'auto', color:C.garnetHi }}>Leave</button>
    </Dock>
  );
}

/* ---- share slides (upload deck) ---- */
function ShareSlides({ debateId, disabled }: { debateId: string; disabled: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setBusy(true);
    // NOTE: pass already-rasterized PNG/JPG pages. PPTX/PDF → images happens in
    // your conversion step before this (e.g. a serverless render job).
    try { await uploadDeck(debateId, files); } catch (err: any) { alert(err?.message ?? 'Upload failed'); }
    finally { setBusy(false); }
  }
  return (
    <>
      <input ref={ref} type="file" accept="image/*" multiple onChange={pick} style={{ display:'none' }} />
      <Btn disabled={disabled || busy} label={busy ? 'Uploading…' : 'Share slides'} onClick={() => ref.current?.click()} />
    </>
  );
}

/* ---- atoms ---- */
function Dock({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ borderTop:`1px solid ${C.hair}`, background:'rgba(12,11,13,0.9)', padding:'11px 16px',
      display:'flex', alignItems:'center', gap:10 }}>{children}</div>
  );
}
const btnBase: React.CSSProperties = {
  display:'flex', flexDirection:'column', alignItems:'center', gap:4, padding:'7px 12px', borderRadius:6,
  border:`1px solid ${C.hair}`, background:'transparent', color:C.dim, fontFamily:ui, fontSize:10.5,
  fontWeight:600, cursor:'pointer',
};
function Btn({ label, onClick, accent, active, disabled, primary, danger }: any) {
  const color = disabled ? C.faint : danger ? C.garnetHi : active && accent ? accent : active ? C.ink : C.dim;
  const style: React.CSSProperties = primary
    ? { ...btnBase, flexDirection:'row', padding:'11px 18px', fontSize:13.5, fontWeight:700, color:C.base,
        border:'none', background:`linear-gradient(180deg,${C.goldHi},${C.gold})` }
    : { ...btnBase, color, opacity: disabled ? 0.55 : 1, cursor: disabled ? 'not-allowed' : 'pointer',
        borderColor: active && accent ? accent : C.hair, background: active && accent ? `${accent}1f` : 'transparent' };
  return <button onClick={disabled ? undefined : onClick} disabled={disabled} style={style}>{label}</button>;
}
const Sep = () => <span style={{ width:1, height:30, background:C.hair, margin:'0 4px' }} />;
const Note = ({ children }: { children: React.ReactNode }) =>
  <span style={{ fontFamily:ui, fontSize:11.5, color:C.faint, maxWidth:320, lineHeight:1.35 }}>{children}</span>;
