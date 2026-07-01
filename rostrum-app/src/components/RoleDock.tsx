// =====================================================================
// The Rostrum · src/components/RoleDock.tsx
// The bottom control dock, wired. Controls differ by role; the host's
// buttons call the real room actions, the debater's mic respects the
// server-granted permission, and "Share slides" uploads the deck.
// Batch 8: host now has YouTube stream start/stop controls.
// =====================================================================
import { useRef, useState } from 'react';
import { uploadDeck } from '../lib/api';
import { rasterizeToImages } from '../lib/deck';
import { muteAudience } from '../lib/livekit';
import type { StreamPhase } from '../lib/useYouTubeStream';
import { C, ui, a } from '../lib/theme';

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
  onCancel: () => void;
  streamPhase: StreamPhase;
  streamError: string | null;
  onStreamStart: () => void;
  onStreamStop: () => void;
  setTab: (t: string) => void;
  onLeave: () => void;
  pollOpen?: boolean;
  onTogglePoll?: () => void;
  winMode?: string;
  onFinalize?: () => void;
  onAnnounce?: () => void;
  resultsReady?: boolean;
  winnerAnnounced?: boolean;
  hasSegments?: boolean;
  beginLabel?: string;
  hideYouTube?: boolean;
  hideCamera?: boolean;
}

export function RoleDock(p: Props) {
  // ---- assembly (pre-gavel) ----
  if (p.phase === 'assembly') {
    return (
      <Dock>
        {p.role === 'host' ? (
          <>
            <Btn primary label={p.beginLabel ?? 'Begin debate'} onClick={p.onGoLive} />
            {!p.hideYouTube && (
              <>
                <Sep />
                <StreamBtn phase={p.streamPhase} error={p.streamError} onStart={p.onStreamStart} onStop={p.onStreamStop} />
              </>
            )}
            <Sep />
            <Btn danger label="Cancel event" onClick={() => {
              if (window.confirm('Cancel this event? This cannot be undone.')) p.onCancel();
            }} />
          </>
        ) : (
          <Note>Waiting for the host to begin — the hall is filling.</Note>
        )}
      </Dock>
    );
  }

  // ---- live ----
  if (p.role === 'host') {
    return (
      <Dock>
        <Btn active={p.micOn} disabled={!p.canPublish}
          label={p.canPublish ? (p.micOn ? 'Mic on' : 'Mic off') : 'Mic'} onClick={p.toggleMic} accent={C.jade} />
        {!p.hideCamera && <Btn active={p.camOn} disabled={!p.canPublish} label="Camera" onClick={p.toggleCam} />}
        <Sep />
        {p.hasSegments !== false && (
          <>
            <Btn label={p.running ? 'Pause clock' : 'Start clock'} onClick={p.onToggleTimer} />
            <Btn label="Next segment" onClick={p.onNextSegment} />
          </>
        )}
        <Btn label="Mute all" onClick={() => muteAudience(p.debateId)} />
        <Sep />
        {p.onTogglePoll && (
          <Btn label={p.pollOpen ? '🗳 Close poll' : '🗳 Open poll'} onClick={p.onTogglePoll}
            active={p.pollOpen} accent={p.pollOpen ? C.jade : undefined} />
        )}
        {p.onFinalize && !p.resultsReady && (
          <Btn label="📊 Finalize" onClick={p.onFinalize} />
        )}
        {p.onAnnounce && p.resultsReady && !p.winnerAnnounced && (
          <Btn label="🏆 Announce winner" onClick={p.onAnnounce} accent={C.gold} />
        )}
        <Sep />
        {!p.hideYouTube && (
          <>
            <StreamBtn phase={p.streamPhase} error={p.streamError} onStart={p.onStreamStart} onStop={p.onStreamStop} />
            <Sep />
          </>
        )}
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
      <Btn label="Gift" accent={C.gold} onClick={() => p.setTab('gift')} />
      <Sep />
      <Note>Audience is muted by house rule — questions go to the host during Q&A.</Note>
      <button onClick={p.onLeave} style={{ ...btnBase, marginLeft:'auto', color:C.garnetHi }}>Leave</button>
    </Dock>
  );
}

/* ---- YouTube stream start/stop ----
   Stateless: all state lives in useYouTubeStream (in ChamberScreen) so it
   survives the assembly→live dock remount. This just renders + dispatches. */
function StreamBtn({ phase, error, onStart, onStop }: {
  phase: StreamPhase; error: string | null; onStart: () => void; onStop: () => void;
}) {
  const label =
    phase === 'connecting' ? 'Connecting…' :
    phase === 'live'       ? '⏹ Stop stream' :
    phase === 'error'      ? '⚠ Retry stream' :
    '▶ YouTube';

  const onClick = () => {
    if (phase === 'live') onStop();
    else if (phase !== 'connecting') onStart();
  };

  return (
    <div style={{ display:'inline-flex', flexDirection:'column', alignItems:'stretch', gap:4, maxWidth:320 }}>
      <Btn
        label={label}
        accent={phase === 'error' ? C.ember : C.garnet}
        active={phase === 'live'}
        onClick={onClick}
        disabled={phase === 'connecting'}
      />
      {phase === 'error' && error && (
        <div style={{ fontFamily:'JetBrains Mono, monospace', fontSize:10, lineHeight:1.4,
          color:C.ember, background:`${a(C.ember,'14')}`, border:`1px solid ${a(C.ember,'40')}`,
          borderRadius:6, padding:'5px 7px', maxWidth:320, wordBreak:'break-word' }}>
          {error}
        </div>
      )}
    </div>
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
    try { await uploadDeck(debateId, await rasterizeToImages(files)); }
    catch (err: any) { alert(err?.message ?? 'Upload failed'); }
    finally { setBusy(false); }
  }
  return (
    <>
      <input ref={ref} type="file" accept="application/pdf,image/*" multiple onChange={pick} style={{ display:'none' }} />
      <Btn disabled={disabled || busy} label={busy ? 'Uploading…' : 'Share slides'} onClick={() => ref.current?.click()} />
    </>
  );
}

/* ---- atoms ---- */
function Dock({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ borderTop:`1px solid ${C.hair}`, background:a(C.base,'E6'), padding:'11px 16px',
      display:'flex', alignItems:'center', gap:10, overflowX:'auto', WebkitOverflowScrolling:'touch' }}>{children}</div>
  );
}
const btnBase: React.CSSProperties = {
  display:'flex', flexDirection:'column', alignItems:'center', gap:4, padding:'8px 13px', borderRadius:10,
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
