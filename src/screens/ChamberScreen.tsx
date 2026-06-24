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
import { useAuth } from '../lib/auth';
import { useRoom } from '../lib/useRoom';
import { useDebate } from '../lib/useDebate';
import { joinDebate } from '../lib/api';
import { VideoTile } from '../components/VideoTile';
import { SlideStage } from '../components/SlideStage';
import { ContextRail } from '../components/ContextRail';
import { RoleDock } from '../components/RoleDock';
import { C, ui, display, mono } from '../lib/theme';

type Layout = 'slides' | 'spotlight' | 'grid';

export function ChamberScreen({ debateId, onLeave, onEnded }: {
  debateId: string; onLeave: () => void; onEnded: () => void;
}) {
  const { user } = useAuth();
  const room = useRoom(debateId);
  const dz = useDebate(debateId);
  const [layout, setLayout] = useState<Layout>('slides');
  const [tab, setTab] = useState('vote');

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
          <span>{(dz.debate?.viewer_count ?? room.members.length).toLocaleString()} watching</span>
          <span style={{ padding:'4px 10px', borderRadius:4, border:`1px solid ${low ? C.ember : C.hair}`,
            color: low ? C.ember : C.ink, fontWeight:700, fontSize:15 }}>
            {dz.phase==='assembly' ? 'Doors open' : `${mm}:${ss}`}
          </span>
        </div>
      </div>

      {/* ---- main ---- */}
      <div style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 322px', minHeight:0 }}>
        <div style={{ display:'flex', flexDirection:'column', minWidth:0, padding:'14px 16px 0' }}>
          {dz.phase === 'assembly'
            ? <Assembly members={room.members} />
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
                        <SlideStage debateId={debateId} canPresent={room.canPublish} dim={layout==='spotlight'} />
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

        <ContextRail debateId={debateId} role={role} tab={tab} setTab={setTab} />
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
        setTab={setTab}
        onLeave={onLeave}
      />
    </div>
  );
}

/* assembly = who's in the room before the gavel */
function Assembly({ members }: { members: { identity: string; name: string; role: string; side: string | null }[] }) {
  const group = (r: string) => members.filter(m => m.role === r);
  const Row = ({ title, list, color }: { title: string; list: typeof members; color: string }) => (
    <div style={{ marginBottom:18 }}>
      <div style={{ fontFamily:ui, fontSize:10.5, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color, marginBottom:10 }}>{title}</div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:10 }}>
        {list.length ? list.map(m => (
          <div key={m.identity} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 11px',
            borderRadius:999, background:C.panel, border:`1px solid ${C.hair}` }}>
            <span style={{ width:8, height:8, borderRadius:'50%', background:C.jadeHi }} />
            <span style={{ fontFamily:ui, fontSize:13, color:C.ink }}>{m.name}</span>
          </div>
        )) : <span style={{ fontFamily:ui, fontSize:12, color:C.faint }}>—</span>}
      </div>
    </div>
  );
  return (
    <div style={{ flex:1, overflowY:'auto', paddingTop:8 }}>
      <div style={{ fontFamily:ui, fontSize:11, fontWeight:700, letterSpacing:2.5, textTransform:'uppercase', color:C.gold, marginBottom:18 }}>
        The hall is filling — debate begins shortly</div>
      <Row title="Moderator" list={group('moderator')} color={C.goldHi} />
      <Row title="Proposition" list={members.filter(m => m.role==='debater' && m.side==='prop')} color={C.jadeHi} />
      <Row title="Opposition" list={members.filter(m => m.role==='debater' && m.side==='opp')} color={C.garnetHi} />
      <Row title="Judges" list={group('judge')} color={C.dim} />
      <Row title={`Gallery · ${group('audience').length} seated`} list={group('audience').slice(0, 24)} color={C.faint} />
    </div>
  );
}

const iconBtn: React.CSSProperties = { width:32, height:32, borderRadius:5, border:`1px solid ${C.hair}`,
  background:'rgba(0,0,0,0.25)', color:C.dim, cursor:'pointer', fontSize:16, lineHeight:1 };
