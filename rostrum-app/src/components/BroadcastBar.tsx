// =====================================================================
// The Rostrum · src/components/BroadcastBar.tsx
// StreamYard-style broadcast control bar for the host, shown under the
// stage. The host picks the live layout (what YouTube sees), grants a
// presenter, and the active presenter pushes slides / screen share.
// Layout changes propagate instantly over the LiveKit data channel.
// =====================================================================
import { useEffect, useRef, useState } from 'react';
import {
  getBroadcastState, subscribeBroadcastState, setBroadcastState,
  setPresenter, requestPresent, clearDeck, uploadDeck,
  type BroadcastState, type BcastLayout,
} from '../lib/api';
import { rasterizeToImages } from '../lib/deck';
import { publishBcastControl } from '../lib/livekit';
import { C, ui, a } from '../lib/theme';

type Role = 'host' | 'moderator' | 'debater' | 'judge' | 'audience';

// The seven StreamYard-style layouts, each drawn as a tiny diagram.
const LAYOUTS: { key: BcastLayout; label: string; needsScreen?: boolean }[] = [
  { key: 'solo',      label: 'Solo' },
  { key: 'group',     label: 'Group' },
  { key: 'spotlight', label: 'Spotlight' },
  { key: 'news',      label: 'News',   needsScreen: true },
  { key: 'screen',    label: 'Screen', needsScreen: true },
  { key: 'pip',       label: 'PiP',    needsScreen: true },
  { key: 'cinema',    label: 'Cinema', needsScreen: true },
];

export function BroadcastBar({ debateId, role, identity, members, lkRoom, setScreenShare, onLocalState }: {
  debateId: string; role: Role; identity: string; members: any[]; lkRoom?: any;
  setScreenShare?: (on: boolean) => Promise<boolean>;
  onLocalState?: (patch: Partial<BroadcastState>) => void;
}) {
  const [bs, setBs] = useState<BroadcastState>({ layout: 'solo', stageId: null, slidesOn: false, presenterId: null, presentType: null, presentRequest: null });
  const [busy, setBusy] = useState(false);
  const deckRef = useRef<HTMLInputElement>(null);

  const isHost = role === 'host';
  const canPresentRole = role === 'host' || role === 'debater' || role === 'moderator';
  const iAmPresenter = bs.presenterId === identity;

  useEffect(() => {
    let alive = true;
    getBroadcastState(debateId).then(s => { if (alive) setBs(s); }).catch(() => {});
    const off = subscribeBroadcastState(debateId, s => { if (alive) setBs(s); });
    return () => { alive = false; off(); };
  }, [debateId]);

  function pushLayout(layout: BcastLayout) {
    if (!isHost) return;
    setBs(b => ({ ...b, layout }));
    onLocalState?.({ layout });
    publishBcastControl(lkRoom, { layout });
    setBroadcastState(debateId, { layout }).catch(() => {});
  }

  async function grantPresenter(id: string | null, type: 'slides' | 'screen' = 'slides') {
    if (!isHost) return;
    setBs(b => ({ ...b, presenterId: id, presentType: id ? type : null }));
    onLocalState?.({ presenterId: id, presentType: id ? type : null });
    publishBcastControl(lkRoom, { presenterId: id, presentType: id ? type : null });
    try { await setPresenter(debateId, id, type); } catch (e: any) { alert(e?.message ?? 'Could not set presenter'); }
  }

  async function uploadSlides(files: File[]) {
    setBusy(true);
    try {
      await uploadDeck(debateId, await rasterizeToImages(files));
      const pid = bs.presenterId ?? identity;
      // If I'm the granted presenter (or host), make my slides the screen source.
      if (isHost && !bs.presenterId) await setPresenter(debateId, identity, 'slides');
      setBs(b => ({ ...b, presenterId: pid, presentType: 'slides' }));
      onLocalState?.({ presenterId: pid, presentType: 'slides' });
      publishBcastControl(lkRoom, { deckChanged: true, presentType: 'slides', presenterId: pid });
      // Nudge layout to a screen layout so it's visible.
      if (isHost) pushLayout('news');
    } catch (e: any) { alert(e?.message ?? 'Upload failed'); }
    finally { setBusy(false); if (deckRef.current) deckRef.current.value = ''; }
  }

  async function startScreenShare() {
    if (!setScreenShare) return;
    const ok = await setScreenShare(true);
    if (!ok) { alert('Screen share was blocked or cancelled.'); return; }
    if (isHost && !bs.presenterId) await grantPresenter(identity, 'screen');
    else { publishBcastControl(lkRoom, { presentType: 'screen', presenterId: bs.presenterId ?? identity }); }
    if (isHost) pushLayout('screen');
  }
  async function stopScreenShare() {
    if (setScreenShare) await setScreenShare(false);
    if (isHost) await grantPresenter(null);
  }

  // request to present (debater/moderator)
  async function askToPresent() {
    try { await requestPresent(debateId, identity); alert('Request sent to the host.'); }
    catch (e: any) { alert(e?.message ?? 'Could not request'); }
  }

  const presenterName = bs.presenterId ? (members.find(m => m.identity === bs.presenterId)?.name ?? 'Presenter') : null;
  const requester = bs.presentRequest ? members.find(m => m.identity === bs.presentRequest) : null;

  return (
    <div style={{ borderTop:`1px solid ${C.hair}`, padding:'10px 14px', display:'flex', flexDirection:'column', gap:9,
      fontFamily:ui, background:'rgba(12,11,13,0.6)' }}>

      {/* Layout strip (host only) */}
      {isHost && (
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <span style={{ fontSize:10, fontWeight:700, letterSpacing:'.12em', textTransform:'uppercase', color:C.faint, marginRight:4 }}>Layout</span>
          {LAYOUTS.map(l => {
            const on = bs.layout === l.key;
            const dimmed = l.needsScreen && !bs.presenterId;
            return (
              <button key={l.key} title={l.label + (dimmed ? ' (needs a presenter)' : '')}
                onClick={() => pushLayout(l.key)}
                style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, padding:'5px 7px',
                  borderRadius:7, cursor:'pointer', border:`1px solid ${on ? C.gold : C.hair}`,
                  background: on ? `${a(C.gold,'1f')}` : 'transparent', opacity: dimmed ? 0.5 : 1 }}>
                <LayoutGlyph kind={l.key} on={on} />
                <span style={{ fontSize:9.5, fontWeight:600, color: on ? C.gold : C.dim }}>{l.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Present + presenter controls */}
      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
        <input ref={deckRef} type="file" accept="application/pdf,image/*" multiple style={{ display:'none' }}
          onChange={e => { const f = Array.from(e.target.files ?? []); if (f.length) uploadSlides(f); }} />

        {/* Present button — host always; debaters only once granted */}
        {(isHost || iAmPresenter) && (
          <>
            <Btn onClick={() => deckRef.current?.click()} disabled={busy}>
              {busy ? 'Uploading…' : '⊞ Present slides'}
            </Btn>
            {setScreenShare && <Btn onClick={startScreenShare}>🖵 Share screen</Btn>}
          </>
        )}

        {/* Debater not yet granted → request */}
        {!isHost && canPresentRole && !iAmPresenter && (
          <Btn onClick={askToPresent}>✋ Request to present</Btn>
        )}

        {/* Active presenter status + host stop */}
        {presenterName && (
          <span style={{ fontSize:11.5, color:C.dim, display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ width:7, height:7, borderRadius:'50%', background:C.jadeHi }} />
            Presenting: <strong style={{ color:C.ink }}>{presenterName}</strong>
            {bs.presentType === 'screen' ? ' · screen' : ' · slides'}
            {isHost && <button onClick={stopScreenShare} style={{ ...linkBtn, color:C.garnetHi }}>Remove</button>}
          </span>
        )}

        {/* Host sees a pending request to approve */}
        {isHost && requester && requester.identity !== bs.presenterId && (
          <span style={{ marginLeft:'auto', fontSize:11.5, color:C.gold, display:'flex', alignItems:'center', gap:8 }}>
            {requester.name} wants to present
            <button onClick={() => grantPresenter(requester.identity, 'slides')} style={{ ...linkBtn, color:C.jadeHi }}>Allow</button>
            <button onClick={() => setBroadcastState(debateId, {}).catch(()=>{})} style={{ ...linkBtn, color:C.faint }}>Dismiss</button>
          </span>
        )}
      </div>

      {/* Host: grant a specific debater the floor to present */}
      {isHost && !bs.presenterId && (
        <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
          <span style={{ fontSize:10.5, color:C.faint }}>Let present:</span>
          {members.filter(m => ['debater','moderator'].includes(m.role)).map(m => (
            <button key={m.identity} onClick={() => grantPresenter(m.identity, 'slides')} style={linkBtn}>{m.name}</button>
          ))}
          {members.filter(m => ['debater','moderator'].includes(m.role)).length === 0 &&
            <span style={{ fontSize:10.5, color:C.faint, fontStyle:'italic' }}>no debaters seated yet</span>}
        </div>
      )}
    </div>
  );
}

function Btn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ padding:'7px 12px', borderRadius:7, cursor: disabled?'default':'pointer',
      fontSize:12, fontWeight:600, border:`1px solid ${C.hair}`, background:'transparent', color:C.dim, opacity: disabled?0.6:1 }}>
      {children}
    </button>
  );
}
const linkBtn: React.CSSProperties = { background:'none', border:'none', cursor:'pointer', fontFamily:ui, fontSize:11.5, fontWeight:600, color:C.gold, padding:'2px 4px' };

/* tiny layout diagrams */
function LayoutGlyph({ kind, on }: { kind: string; on: boolean }) {
  const s = on ? C.gold : C.dim;
  const box = (x:number,y:number,w:number,h:number,fill=false) =>
    <rect x={x} y={y} width={w} height={h} rx="1.5" fill={fill ? s : 'none'} stroke={s} strokeWidth="1.2" opacity={fill?0.5:1} />;
  return (
    <svg width="26" height="18" viewBox="0 0 26 18">
      {kind === 'solo' && box(3,2,20,14,true)}
      {kind === 'group' && <>{box(3,2,9,14,true)}{box(14,2,9,14,true)}</>}
      {kind === 'spotlight' && <>{box(3,2,14,14,true)}{box(19,2,4,6.5,true)}{box(19,9.5,4,6.5,true)}</>}
      {kind === 'news' && <>{box(3,2,9,14,true)}{box(14,2,9,14)}</>}
      {kind === 'screen' && <>{box(3,2,15,14)}{box(20,2,3,14,true)}</>}
      {kind === 'pip' && <>{box(3,2,20,14)}{box(16,10,6,5,true)}</>}
      {kind === 'cinema' && box(3,2,20,14)}
    </svg>
  );
}
