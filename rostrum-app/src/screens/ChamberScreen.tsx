// =====================================================================
// The Rostrum · src/screens/ChamberScreen.tsx
// The live room, fully wired:
//   cameras  -> useRoom + VideoTile
//   deck     -> SlideStage (synced)
//   clock    -> useDebate (authoritative segment timer)
//   poll/Q&A/score -> ContextRail
//   controls -> RoleDock (host go-live, segment mic-gating, end)
// =====================================================================
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useRoom } from '../lib/useRoom';
import { useDebate } from '../lib/useDebate';
import { useYouTubeStream } from '../lib/useYouTubeStream';
import { joinDebate } from '../lib/api';
import { VideoTile } from '../components/VideoTile';
import { SlideStage } from '../components/SlideStage';
import { ContextRail } from '../components/ContextRail';
import { RoleDock } from '../components/RoleDock';
import { ShareButton } from '../components/ShareSheet';
import { C, ui, display, mono } from '../lib/theme';

type Layout = 'slides' | 'spotlight' | 'grid';

export function ChamberScreen({ debateId, onLeave, onEnded }: {
  debateId: string; onLeave: () => void; onEnded: () => void;
}) {
  const { user } = useAuth();
  const room = useRoom(debateId);
  const dz = useDebate(debateId);
  const nav = useNavigate();
  const openProfile = (handle?: string | null) => { if (handle) nav(`/u/${handle}`); };
  const [layout, setLayout] = useState<Layout>('slides');
  const [tab, setTab] = useState('vote');

  // YouTube simulcast state, lifted here so it survives the dock remount
  // when the debate moves from assembly → live.
  const yt = useYouTubeStream(debateId, true);

  // make sure a participant row exists (token also upserts audience as a fallback)
  useEffect(() => { joinDebate(debateId).catch(() => {}); }, [debateId]);

  // when the host finalizes, everyone is routed to results
  useEffect(() => { if (dz.phase === 'ended') onEnded(); }, [dz.phase, onEnded]);

  const me = room.members.find(m => m.isLocal);
  const role = (me?.role ?? 'audience') as any;
  useEffect(() => { setTab(role === 'judge' ? 'score' : role === 'host' ? 'ros' : 'vote'); }, [role]);

  const speakerSide = dz.seg?.side ?? null;
  const speaker = room.members.find(m => m.isSpeaking)
    ?? room.members.find(m => m.role === 'debater' && m.side === speakerSide)
    ?? room.members.find(m => m.role === 'moderator')
    ?? me;

  const mm = String(Math.floor(dz.remaining / 60)).padStart(2, '0');
  const ss = String(dz.remaining % 60).padStart(2, '0');
  const low = dz.remaining <= 30 && dz.phase === 'live';
  const onAir = dz.phase === 'live';

  return (
    <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', background:C.base }}>
      {/* ---- tally bar ---- */}
      <div style={{ display:'flex', alignItems:'center', gap:14, padding:'11px 18px', borderBottom:`1px solid ${C.hair}` }}>
        <button onClick={onLeave} style={iconBtn}>‹</button>
        <span style={{ padding:'4px 11px', borderRadius:3, fontFamily:ui, fontWeight:700, fontSize:11, letterSpacing:1.5,
          color: dz.phase==='assembly' ? C.base : onAir ? '#1a0a06' : '#000',
          background: dz.phase==='assembly' ? C.gold : onAir ? C.ember : C.faint }}>
          {dz.phase==='assembly' ? 'ASSEMBLING' : onAir ? 'ON AIR' : 'OFF AIR'}
        </span>
        <div style={{ fontFamily:display, fontSize:18, color:C.ink, fontWeight:600, overflow:'hidden',
          whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{dz.debate?.motion ?? '…'}</div>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:16, fontFamily:mono, fontSize:12, color:C.dim }}>
          <ShareButton compact url={typeof window!=='undefined' ? `${window.location.origin}/debate/${debateId}` : ''}
            title={dz.debate?.motion ?? 'A debate on The Rostrum'}
            text={dz.debate?.motion ? `Watch: ${dz.debate.motion}` : 'Watch this debate on The Rostrum'} />
          <span>{Math.max(dz.debate?.viewer_count ?? 0, room.members.length).toLocaleString()} watching</span>
          <button onClick={() => nav(`/debate/${debateId}/watch`)} title="Immersive view"
            style={{ padding:'4px 10px', borderRadius:4, border:`1px solid ${C.hair}`,
              color:C.dim, fontSize:12, fontFamily:ui, fontWeight:600,
              background:'transparent', cursor:'pointer' }}>
            ⛶ Immersive
          </button>
          <button onClick={() => role==='host' && setTab('ros')}
            title={role==='host' ? 'Edit time in Run of show' : undefined}
            style={{ padding:'4px 10px', borderRadius:4, border:`1px solid ${low ? C.ember : C.hair}`,
              color: low ? C.ember : C.ink, fontWeight:700, fontSize:15, fontFamily:mono,
              background:'transparent', cursor: role==='host' ? 'pointer' : 'default' }}>
            {dz.phase==='assembly' ? 'Doors open' : `${mm}:${ss}`}
          </button>
        </div>
      </div>

      {/* ---- main ---- */}
      <div style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 322px', minHeight:0 }}>
        <div style={{ display:'flex', flexDirection:'column', minWidth:0, padding:'14px 16px 0' }}>
          {dz.phase === 'assembly'
            ? <Assembly members={room.members} onProfile={openProfile} />
            : <>
                {/* segment + layout switch */}
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                  <span style={{ fontFamily:ui, fontSize:10.5, fontWeight:700, letterSpacing:2.5, textTransform:'uppercase',
                    color: speakerSide==='opp' ? C.garnetHi : speakerSide==='prop' ? C.jadeHi : C.gold }}>
                    {dz.seg?.label ?? 'Segment'}</span>
                  <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
                    {(['slides','spotlight','grid'] as Layout[]).map(k => (
                      <button key={k} onClick={() => setLayout(k)} style={{ ...iconBtn,
                        borderColor: layout===k ? C.gold : C.hair, color: layout===k ? C.gold : C.dim, fontSize:11 }}>{k[0].toUpperCase()}</button>
                    ))}
                  </div>
                </div>

                {/* canvas */}
                <div style={{ flex:1, minHeight:0, position:'relative', borderRadius:7, overflow:'hidden', border:`1px solid ${C.hair}`, background:C.base2 }}>
                  {layout === 'grid'
                    ? <div style={{ position:'absolute', inset:0, padding:12, display:'grid', gap:10,
                        gridTemplateColumns:'repeat(3,1fr)', alignContent:'center' }}>
                        {room.members.map(m => <VideoTile key={m.identity} member={m} active={m.identity===speaker?.identity} />)}
                      </div>
                    : <>
                        <SlideStage debateId={debateId} canPresent={room.canPublish && role !== 'host'} dim={layout==='spotlight'} />
                        {speaker && (
                          <div style={{ position:'absolute', right:'3%', bottom:'7%', width: layout==='spotlight' ? '46%' : '31%', aspectRatio:'4 / 3' }}>
                            <VideoTile member={speaker} active size={layout==='spotlight' ? 'stage' : 'tile'} />
                          </div>
                        )}
                      </>}
                </div>

                {/* filmstrip */}
                <div style={{ display:'flex', gap:9, overflowX:'auto', padding:'12px 2px 14px' }}>
                  {room.members.map(m => (
                    <div key={m.identity} style={{ width:108, flexShrink:0 }}>
                      <VideoTile member={m} active={m.identity===speaker?.identity} />
                    </div>
                  ))}
                </div>
              </>}
        </div>

        <ContextRail debateId={debateId} role={role} tab={tab} setTab={setTab} members={room.members}
          ros={{
            segments: dz.segments, segIdx: dz.segIdx, remaining: dz.remaining,
            running: dz.running, phase: dz.phase,
            onJump: (i: number) => dz.goToSegment(room.members, i),
            onToggle: dz.toggleTimer,
            onNext: () => dz.nextSegment(room.members),
            onSetRemaining: (s: number) => dz.setClock(s),
          }} />
      </div>

      {/* ---- dock ---- */}
      <RoleDock
        debateId={debateId}
        role={role}
        phase={dz.phase}
        running={dz.running}
        canPublish={room.canPublish}
        micOn={room.micOn}
        camOn={room.camOn}
        toggleMic={room.toggleMic}
        toggleCam={room.toggleCam}
        onGoLive={() => dz.goLive(room.members)}
        onNextSegment={() => dz.nextSegment(room.members)}
        onToggleTimer={dz.toggleTimer}
        onEnd={dz.endDebate}
        onCancel={async () => { await dz.cancelEvent(); onLeave(); }}
        streamPhase={yt.phase}
        streamError={yt.error}
        onStreamStart={yt.start}
        onStreamStop={yt.stop}
        setTab={setTab}
        onLeave={onLeave}
      />
    </div>
  );
}

/* ---- assembly: the seated chamber before the gavel (real members) ---- */
type M = { identity: string; name: string; handle?: string | null; role: string; side: string | null };

const seatHoverCSS = `.rseat{transition:transform .12s ease, filter .12s ease} .rseat:hover{transform:translateY(-2px);filter:brightness(1.12)}`;

function hueOf(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h); return Math.abs(h) % 360; }

function SeatAvatar({ name, size = 54, ring }: { name: string; size?: number; ring?: string }) {
  const h = hueOf(name || '?');
  const init = (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', flexShrink:0, display:'grid', placeItems:'center',
      fontFamily:ui, fontWeight:700, fontSize:size*0.36, color:'#0C0B0D',
      background:`linear-gradient(145deg, hsl(${h} 42% 60%), hsl(${(h+38)%360} 38% 40%))`,
      boxShadow: ring ? `0 0 0 2px ${C.base}, 0 0 0 3.5px ${ring}` : 'inset 0 -2px 6px rgba(0,0,0,.4)' }}>{init}</div>
  );
}

function Seat({ p, accent, label, small, onProfile }: { p: M; accent: string; label: string; small?: boolean; onProfile?: (h?: string | null) => void }) {
  const clickable = !!(onProfile && p.handle);
  return (
    <div className={clickable ? 'rseat' : undefined}
      onClick={clickable ? () => onProfile!(p.handle) : undefined}
      title={clickable ? `View ${p.name}'s profile` : undefined}
      style={{ textAlign:'center', width: small ? 58 : 76, cursor: clickable ? 'pointer' : 'default' }}>
      <div style={{ position:'relative', display:'inline-block' }}>
        <SeatAvatar name={p.name} size={small ? 42 : 54} ring={accent} />
        <span style={{ position:'absolute', bottom:-1, right:-1, width:15, height:15, borderRadius:'50%',
          background:C.base2, border:`2px solid ${C.base}`, display:'grid', placeItems:'center' }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background:C.jadeHi }} /></span>
      </div>
      <div style={{ fontFamily:ui, fontSize:12, color:C.ink, marginTop:7, fontWeight:600,
        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{(p.name || 'Guest').split(' ')[0]}</div>
      <div style={{ marginTop:2, fontFamily:ui, fontSize:9, letterSpacing:'.6px', textTransform:'uppercase', color:accent }}>{label}</div>
    </div>
  );
}

function OpenSeat({ accent, label, small }: { accent: string; label: string; small?: boolean }) {
  const size = small ? 42 : 54;
  return (
    <div style={{ textAlign:'center', width: small ? 58 : 76, opacity:.5 }}>
      <div style={{ width:size, height:size, margin:'0 auto', borderRadius:'50%', border:`1.5px dashed ${C.hairHi}`,
        display:'grid', placeItems:'center', color:C.faint, fontSize:size*0.4, fontWeight:300, lineHeight:1 }}>+</div>
      <div style={{ fontFamily:ui, fontSize:11, color:C.faint, marginTop:7 }}>Open</div>
      <div style={{ marginTop:2, fontFamily:ui, fontSize:9, letterSpacing:'.6px', textTransform:'uppercase', color:accent }}>{label}</div>
    </div>
  );
}

function Bench({ title, people, side, accent, tint, onProfile }: {
  title: string; people: M[]; side: 'left' | 'right'; accent: string; tint: string; onProfile?: (h?: string | null) => void;
}) {
  const opens = Math.max(0, 1 - people.length);
  return (
    <div style={{ flex:1, maxWidth:280, padding:'16px 18px', borderRadius:10,
      background:`linear-gradient(${side==='left'?'110deg':'250deg'}, ${tint}22, rgba(20,18,22,0.55) 80%)`,
      border:`1px solid ${tint}55` }}>
      <div style={{ fontFamily:ui, fontSize:10.5, fontWeight:700, letterSpacing:'1.5px', textTransform:'uppercase',
        color:accent, marginBottom:14, textAlign: side==='left'?'left':'right' }}>{title}</div>
      <div style={{ display:'flex', gap:16, flexWrap:'wrap', justifyContent: side==='left'?'flex-start':'flex-end' }}>
        {people.map(p => <Seat key={p.identity} p={p} accent={accent} label={side==='left'?'Proposition':'Opposition'} onProfile={onProfile} />)}
        {Array.from({ length: opens }).map((_, i) => <OpenSeat key={'o'+i} accent={accent} label={side==='left'?'Proposition':'Opposition'} />)}
      </div>
    </div>
  );
}

function Assembly({ members, onProfile }: { members: M[]; onProfile?: (h?: string | null) => void }) {
  const g = (r: string) => members.filter(m => m.role === r);
  const host = g('host'), mod = g('moderator'), judges = g('judge');
  const prop = members.filter(m => m.role === 'debater' && m.side === 'prop');
  const opp  = members.filter(m => m.role === 'debater' && m.side === 'opp');
  const audience = g('audience');
  const GAL = 30;

  return (
    <div style={{ flex:1, minHeight:0, overflowY:'auto', display:'flex', flexDirection:'column', paddingBottom:14 }}>
      <style>{seatHoverCSS}</style>
      {/* eyebrow + counts */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
        <span style={{ width:8, height:8, borderRadius:'50%', background:C.gold, boxShadow:`0 0 10px ${C.gold}` }} />
        <span style={{ fontFamily:ui, fontSize:10.5, fontWeight:700, letterSpacing:'2.5px', textTransform:'uppercase', color:C.gold }}>
          The hall is filling — debate begins shortly</span>
        <span style={{ marginLeft:'auto', fontFamily:mono, fontSize:12, color:C.dim }}>
          {prop.length + opp.length} debaters · {judges.length} judges · {members.length} in the hall</span>
      </div>

      {/* host / moderator + judges */}
      <div style={{ display:'flex', justifyContent:'center', gap:30, marginBottom:22, flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:22 }}>
          {host.map(p => <Seat key={p.identity} p={p} accent={C.gold} label="Host" onProfile={onProfile} />)}
          {mod.length
            ? mod.map(p => <Seat key={p.identity} p={p} accent={C.goldHi} label="Moderator" onProfile={onProfile} />)
            : <OpenSeat accent={C.goldHi} label="Moderator" />}
        </div>
        <div style={{ display:'flex', gap:18, paddingLeft:22, borderLeft:`1px solid ${C.hair}` }}>
          {judges.length
            ? judges.map(j => <Seat key={j.identity} p={j} accent={C.dim} label="Judge" small onProfile={onProfile} />)
            : <OpenSeat accent={C.dim} label="Judge" small />}
        </div>
      </div>

      {/* benches around the floor */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:18, marginBottom:18 }}>
        <Bench title="Proposition" people={prop} side="left" accent={C.jadeHi} tint={C.jade} onProfile={onProfile} />
        <div style={{ textAlign:'center', flexShrink:0, paddingTop:10 }}>
          <div style={{ width:82, height:56, margin:'0 auto', borderRadius:'8px 8px 4px 4px',
            background:`linear-gradient(180deg, ${C.panel2}, ${C.base})`, border:`1px solid ${C.hairHi}`,
            boxShadow:'0 0 26px rgba(217,180,92,0.18)', position:'relative' }}>
            <span style={{ position:'absolute', top:-9, left:'50%', transform:'translateX(-50%)', width:30, height:9,
              background:C.gold, borderRadius:3, opacity:.85 }} /></div>
          <div style={{ fontFamily:ui, fontSize:10, color:C.faint, marginTop:9, letterSpacing:'1.5px', textTransform:'uppercase' }}>The floor</div>
        </div>
        <Bench title="Opposition" people={opp} side="right" accent={C.garnetHi} tint={C.garnet} onProfile={onProfile} />
      </div>

      {/* gallery */}
      <div style={{ marginTop:'auto', paddingTop:16, borderTop:`1px solid ${C.hair}` }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
          <span style={{ fontFamily:ui, fontSize:10.5, fontWeight:700, letterSpacing:'2.5px', textTransform:'uppercase', color:C.faint }}>
            Gallery · {audience.length} seated</span>
          <span style={{ marginLeft:'auto', fontFamily:ui, fontSize:11.5, color:C.faint }}>Muted — questions only</span>
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
          {audience.length === 0
            ? <span style={{ fontFamily:ui, fontSize:12, color:C.faint }}>No one in the gallery yet.</span>
            : audience.slice(0, GAL).map(a => {
                const clickable = !!(onProfile && a.handle);
                return (
                  <div key={a.identity} className={clickable ? 'rseat' : undefined}
                    onClick={clickable ? () => onProfile!(a.handle) : undefined}
                    title={clickable ? `View ${a.name}'s profile` : a.name}
                    style={{ cursor: clickable ? 'pointer' : 'default' }}>
                    <SeatAvatar name={a.name} size={28} />
                  </div>
                );
              })}
          {audience.length > GAL && (
            <div style={{ width:28, height:28, borderRadius:'50%', display:'grid', placeItems:'center',
              background:C.panel, color:C.dim, fontFamily:mono, fontSize:10.5 }}>+{audience.length - GAL}</div>
          )}
        </div>
      </div>
    </div>
  );
}

const iconBtn: React.CSSProperties = { width:32, height:32, borderRadius:5, border:`1px solid ${C.hair}`,
  background:'rgba(0,0,0,0.25)', color:C.dim, cursor:'pointer', fontSize:16, lineHeight:1 };
