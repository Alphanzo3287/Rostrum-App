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
import { useRoom, type RoomMember } from '../lib/useRoom';
import { useDebate } from '../lib/useDebate';
import { useYouTubeStream } from '../lib/useYouTubeStream';
import {
  joinDebate, getBroadcastState, subscribeBroadcastState, getResults,
  getFloorStats, getTally, castVote, listParticipants, demoteToAudience, promoteToRole, setSpotlight,
  type BroadcastState, type FloorStats,
} from '../lib/api';
import { demoteFromStage, promoteFromAudience } from '../lib/livekit';
import { useStageInvites, type StageRole, type StageSide } from '../lib/stageInvites';
import { VideoTile } from '../components/VideoTile';
import { SlideStage } from '../components/SlideStage';
import { ScreenTile } from '../components/ScreenTile';
import { SafePanel } from '../components/SafePanel';
import { ContextRail } from '../components/ContextRail';
import { RoleDock } from '../components/RoleDock';
import { WinnerOverlay } from '../components/WinnerOverlay';
import { BroadcastBar } from '../components/BroadcastBar';
import { ShareButton } from '../components/ShareSheet';
import { C, ui, display, mono, a, ghostBtn, solidGold } from '../lib/theme';
import { useIsTablet, useIsMobile } from '../lib/useMediaQuery';
import { CompetitorCard, FloorStage, HostTopRow, GalleryStrip, AudienceVoteStrip, JudgesStrip, FloorStatStrip, WaitingHall, Initials, useSideIdentity, sideLabelFor, SideIdentityModal } from '../components/hall';
import { InteractionBar } from '../components/InteractionBar';
import type { Profile, Side, Tally } from '../lib/types';

type Layout = 'slides' | 'spotlight' | 'grid';

export function ChamberScreen({ debateId, onLeave, onEnded }: {
  debateId: string; onLeave: () => void; onEnded: () => void;
}) {
  const { user } = useAuth();
  const room = useRoom(debateId);
  const dz = useDebate(debateId);
  const isNarrow = useIsTablet();
  const isMobile = useIsMobile();
  const nav = useNavigate();
  const openProfile = (handle?: string | null) => { if (handle) nav(`/u/${handle}`); };
  const [tab, setTab] = useState('vote');

  // Mirror the live broadcast composition so the host's preview matches what
  // YouTube sees, and the layout strip gives immediate visual feedback.
  const [bs, setBs] = useState<BroadcastState>({ layout: 'solo', stageId: null, slidesOn: false, presenterId: null, presentType: null, presentRequest: null });
  useEffect(() => {
    let alive = true;
    getBroadcastState(debateId).then(s => { if (alive) setBs(s); }).catch(() => {});
    const off = subscribeBroadcastState(debateId, s => { if (alive) setBs(s); });
    return () => { alive = false; off(); };
  }, [debateId]);

  // YouTube simulcast state, lifted here so it survives the dock remount
  // when the debate moves from assembly → live.
  const yt = useYouTubeStream(debateId, true);

  // make sure a participant row exists (token also upserts audience as a fallback)
  useEffect(() => { joinDebate(debateId).catch(() => {}); }, [debateId]);

  // when the host finalizes, everyone is routed to results
  useEffect(() => { if (dz.phase === 'ended') onEnded(); }, [dz.phase, onEnded]);

  const me = room.members.find(m => m.isLocal);
  const role = (me?.role ?? 'audience') as any;
  const isHost = role === 'host';
  const format = dz.debate?.format;
  const isLecture = format === 'lecture';
  const isLegacy = format === 'legacy';
  const isSpeakersCorner = format === 'speakers_corner';
  useEffect(() => {
    if (isLecture || isLegacy) { setTab('chat'); return; }
    if (isSpeakersCorner) { setTab(role === 'host' ? 'invite' : 'chat'); return; }
    setTab(role === 'judge' ? 'score' : role === 'host' ? 'ros' : 'vote');
  }, [role, isLecture, isLegacy, isSpeakersCorner]);

  // ---- C6 · Stage management (right-click promote/demote) — lives at the
  // top level so it works during assembly (before "Begin debate") as well
  // as once the debate is live, not just one phase. ----
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; member: RoomMember } | null>(null);
  const openCtxMenu = (e: React.MouseEvent, m: RoomMember) => {
    const isSelf = m.identity === me?.identity;
    if (!isHost && !isSelf) return;         // only the host can act on others
    if (isSelf && m.role === 'audience') return; // nothing to do for yourself while in the audience
    if (!isSelf && m.role === 'host') return;    // the host isn't managed through this menu
    setCtxMenu({ x: e.clientX, y: e.clientY, member: m });
  };
  const { incoming: incomingStageInvite, sendInvite: sendStageInvite, respond: respondStageInvite } =
    useStageInvites(room.room, me?.identity ?? '', me?.name ?? '', isHost,
      (fromIdentity, _fromName, role, side) => {
        // Fires only on the host's own client once the target accepts —
        // only the host is authorized to actually perform the promotion.
        promoteToRole(debateId, fromIdentity, role, side).catch(() => {});
        promoteFromAudience(debateId, fromIdentity, role, side).catch(() => {});
      });

  const speakerSide = dz.seg?.side ?? null;
  const speaker = room.members.find(m => m.isSpeaking)
    ?? room.members.find(m => m.role === 'debater' && m.side === speakerSide)
    ?? room.members.find(m => m.role === 'moderator')
    ?? me;

  const mm = String(Math.floor(dz.remaining / 60)).padStart(2, '0');
  const ss = String(dz.remaining % 60).padStart(2, '0');
  const low = dz.remaining <= 30 && dz.phase === 'live';
  const onAir = dz.phase === 'live';

  // ---- C2 Live Hall data — interval polling (crash-safe, no new realtime channels) ----
  const [floor, setFloor] = useState<FloorStats | null>(null);
  const [tally, setTally] = useState<Tally>({ prop: 0, opp: 0 });
  const [myVote, setMyVote] = useState<Side | null>(null);
  const [sideProfiles, setSideProfiles] = useState<{ prop?: Profile; opp?: Profile }>({});

  useEffect(() => {
    if (dz.phase !== 'live') return;
    let alive = true;
    const pull = () => {
      getFloorStats(debateId).then(f => { if (alive) setFloor(f); }).catch(() => {});
      getTally(debateId).then(t => { if (alive) setTally(t); }).catch(() => {});
    };
    pull();
    const iv = setInterval(pull, 4000);
    return () => { alive = false; clearInterval(iv); };
  }, [debateId, dz.phase]);

  // map prop/opp debaters → their profiles for the competitor-card stats
  useEffect(() => {
    let alive = true;
    listParticipants(debateId).then(rows => {
      if (!alive) return;
      const prop = rows.find(r => r.role === 'debater' && r.side === 'prop')?.profile;
      const opp = rows.find(r => r.role === 'debater' && r.side === 'opp')?.profile;
      setSideProfiles({ prop, opp });
    }).catch(() => {});
    return () => { alive = false; };
  }, [debateId, room.members.length]);

  const onVote = async (side: Side) => {
    setMyVote(side);
    try { const t = await castVote(debateId, side); setTally(t); } catch { /* noop */ }
  };

  return (
    <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', background:C.base }}>
      {/* ---- tally bar ---- */}
      <div style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 20px',
        borderBottom:`1px solid ${C.hair}`, background:a(C.base,'CC'), backdropFilter:'blur(20px)' }}>
        <button onClick={onLeave} style={iconBtn}>‹</button>
        <span style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'5px 12px', borderRadius:999,
          fontFamily:ui, fontWeight:800, fontSize:10.5, letterSpacing:'.12em',
          color:'#FFFFFF',
          background: dz.phase==='assembly'
            ? `linear-gradient(135deg, ${C.gold}, ${C.cyan})`
            : onAir ? C.garnet : a(C.faint,'40') }}>
          {(dz.phase==='assembly' || onAir) && (
            <span style={{ width:6, height:6, borderRadius:'50%', background:'#FFFFFF',
              animation: onAir ? 'pulse 1.5s infinite' : 'none' }} />
          )}
          {dz.phase==='assembly' ? 'ASSEMBLING' : onAir ? 'ON AIR' : 'OFF AIR'}
        </span>
        <div style={{ fontFamily:display, fontSize:18, color:C.ink, fontWeight:700, overflow:'hidden',
          whiteSpace:'nowrap', textOverflow:'ellipsis', letterSpacing:'-.01em' }}>{dz.debate?.motion ?? '…'}</div>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:16, fontFamily:mono, fontSize:12, color:C.dim }}>
          <ShareButton compact url={typeof window!=='undefined' ? `${window.location.origin}/debate/${debateId}` : ''}
            title={dz.debate?.motion ?? 'A debate on The Rostrum'}
            text={dz.debate?.motion ? `Watch: ${dz.debate.motion}` : 'Watch this debate on The Rostrum'} />
          <span>{Math.max(dz.debate?.viewer_count ?? 0, room.members.length).toLocaleString()} watching</span>
          <button onClick={() => nav(`/debate/${debateId}/watch`)} title="Immersive view"
            style={{ padding:'6px 12px', borderRadius:10, border:`1px solid ${C.hair}`,
              color:C.dim, fontSize:12, fontFamily:ui, fontWeight:600,
              background:C.glass, cursor:'pointer' }}>
            ⛶ Immersive
          </button>
          <button onClick={() => role==='host' && setTab('ros')}
            title={role==='host' ? 'Edit time in Run of show' : undefined}
            style={{ padding:'6px 12px', borderRadius:10, border:`1px solid ${low ? C.garnet : C.hair}`,
              color: low ? C.garnet : C.ink, fontWeight:700, fontSize:15, fontFamily:mono,
              background: low ? a(C.garnet,'14') : C.glass, cursor: role==='host' ? 'pointer' : 'default' }}>
            {dz.phase==='assembly' ? 'Doors open' : `${mm}:${ss}`}
          </button>
        </div>
      </div>

      {/* ---- main ---- */}
      <div style={{ flex:1, display:'grid',
        gridTemplateColumns: isNarrow ? '1fr' : '1fr 322px',
        gridTemplateRows: isNarrow ? 'minmax(240px,42vh) 1fr' : '1fr',
        minHeight:0, overflow: isNarrow ? 'auto' : 'hidden' }}>
        <div style={{ display:'flex', flexDirection:'column', minWidth:0, minHeight:0, padding:'14px 16px 0' }}>
          {dz.phase === 'assembly'
            ? <WaitingHall debateId={debateId} members={room.members} motion={dz.debate?.motion ?? ''}
                viewerCount={Math.max(dz.debate?.viewer_count ?? 0, room.members.length)}
                scheduledAt={dz.debate?.scheduled_at} role={role} onProfile={openProfile}
                onContextMenu={openCtxMenu} format={dz.debate?.format} />
            : isLecture
            ? <LectureHall
                debateId={debateId} room={room} bs={bs}
                onLocalState={(patch) => setBs(b => ({ ...b, ...patch }))}
                me={me} role={role} speaker={speaker}
                onProfile={openProfile} narrow={isNarrow}
                countdown={`${mm}:${ss}`} phaseLabel={dz.seg?.label ?? 'Presentation'}
                onAskQuestion={() => setTab('qa')} isHost={isHost} onContextMenu={openCtxMenu}
              />
            : isLegacy
            ? <LegacyHall
                debateId={debateId} room={room} me={me} role={role} motion={dz.debate?.motion ?? ''}
                maxStageSeats={dz.debate?.max_stage_seats} maxModerators={dz.debate?.max_moderators}
                onProfile={openProfile} onAskQuestion={() => setTab('qa')} isHost={isHost} onContextMenu={openCtxMenu}
              />
            : isSpeakersCorner
            ? <SpeakersCornerHall
                debateId={debateId} room={room} bs={bs}
                onLocalState={(patch) => setBs(b => ({ ...b, ...patch }))}
                me={me} role={role} tally={tally} myVote={myVote} onVote={onVote}
                onProfile={openProfile} narrow={isNarrow} onAskQuestion={() => setTab('qa')}
                isHost={isHost} onContextMenu={openCtxMenu}
              />
            : <LiveHall
                debateId={debateId} room={room} dz={dz} bs={bs}
                onLocalState={(patch) => setBs(b => ({ ...b, ...patch }))}
                me={me} role={role} speaker={speaker} speakerSide={speakerSide}
                floor={floor} tally={tally} myVote={myVote} onVote={onVote}
                sideProfiles={sideProfiles} onProfile={openProfile} narrow={isNarrow} mobile={isMobile}
                countdown={`${mm}:${ss}`} onAskQuestion={() => setTab('qa')}
                isHost={isHost} onContextMenu={openCtxMenu}
              />}
        </div>

        {ctxMenu && (
          <StageActionMenu x={ctxMenu.x} y={ctxMenu.y} member={ctxMenu.member} debateId={debateId} format={format}
            isSelf={ctxMenu.member.identity === me?.identity}
            onSendInvite={(r, s) => {
              const maxSeats = dz.debate?.max_stage_seats;
              const maxMods = dz.debate?.max_moderators;
              const mods = room.members.filter((m: any) => m.role === 'moderator').length;
              if (r === 'moderator' && maxMods != null && mods >= maxMods) {
                alert(`This room is capped at ${maxMods} moderator${maxMods === 1 ? '' : 's'}.`); return;
              }
              if (isSpeakersCorner && r === 'debater' && s && maxSeats != null) {
                const teamCap = maxSeats / 2;
                const onSide = room.members.filter((m: any) => m.role === 'debater' && m.side === s).length;
                if (onSide >= teamCap) {
                  alert(`This side is capped at ${teamCap} speaker${teamCap === 1 ? '' : 's'}.`); return;
                }
              } else {
                const seated = room.members.filter((m: any) => m.role === 'debater' || m.role === 'moderator').length;
                if (maxSeats != null && seated >= maxSeats) {
                  alert(`This room is capped at ${maxSeats} speaker${maxSeats === 1 ? '' : 's'} on stage.`); return;
                }
              }
              sendStageInvite(ctxMenu.member.identity, r, s);
            }}
            onClose={() => setCtxMenu(null)} />
        )}
        {incomingStageInvite && (
          <IncomingStageInviteCard invite={incomingStageInvite}
            onAccept={() => respondStageInvite(true)} onDecline={() => respondStageInvite(false)} />
        )}

        <ContextRail debateId={debateId} role={role} tab={tab} setTab={setTab} members={room.members} lkRoom={room.room}
          pollOpen={!!dz.debate?.poll_open} format={dz.debate?.format}
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
        pollOpen={!!dz.debate?.poll_open}
        onTogglePoll={(isLecture || isLegacy) ? undefined : dz.togglePoll}
        winMode={dz.debate?.win_mode}
        onFinalize={(isLecture || isLegacy) ? undefined : dz.doFinalize}
        onAnnounce={(isLecture || isLegacy) ? undefined : dz.doAnnounce}
        resultsReady={!!dz.results}
        winnerAnnounced={!!dz.debate?.winner_announced}
        hasSegments={dz.debate?.format !== 'legacy' && dz.debate?.format !== 'speakers_corner'}
        beginLabel={(isLecture || isLegacy) ? 'Start room' : 'Begin debate'}
        hideYouTube={isLegacy}
        hideCamera={isLegacy}
      />
    </div>
  );
}

/* ---- chamber preview: mirrors the live broadcast composition ---- */
function ChamberPreview({ members, bs, debateId, speaker, speakerSide, meId }: {
  members: M[]; bs: BroadcastState; debateId: string; speaker?: M; speakerSide: string | null; meId?: string;
}) {
  const presenter = bs.presenterId ? members.find(m => m.identity === bs.presenterId) : undefined;
  const screenTrack = (presenter as any)?.screenTrack;
  const hasScreen = bs.presentType === 'screen' && !!screenTrack;
  const iPresent = !!meId && bs.presenterId === meId && bs.presentType === 'slides';
  const featured = (bs.stageId ? members.find(m => m.identity === bs.stageId) : undefined)
    ?? presenter ?? speaker
    ?? members.find(m => m.role === 'debater' && m.side === speakerSide)
    ?? members.find(m => m.role === 'host')
    ?? members[0];
  const cams = members.filter(m => ['host','debater','moderator'].includes(m.role));
  const screenCam = presenter ?? featured;

  const Content = hasScreen
    ? <ScreenTile track={screenTrack} fit="contain" />
    : <SlideStage debateId={debateId} canPresent={iPresent} />;

  const cam = (m?: M, big = true) => m
    ? <div style={{ position:'absolute', inset:0 }}><VideoTile member={m} active size={big ? 'stage' : 'tile'} /></div>
    : <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center', color:C.faint, fontSize:13 }}>Waiting…</div>;

  const wrap = (children: React.ReactNode) =>
    <div style={{ position:'absolute', inset:0, padding:8 }}>{children}</div>;

  switch (bs.layout) {
    case 'group':
      return wrap(
        <div style={{ width:'100%', height:'100%', display:'grid', gap:8,
          gridTemplateColumns:`repeat(${cams.length<=1?1:cams.length<=4?2:3},1fr)`, alignContent:'center', alignItems:'center' }}>
          {cams.map(m => <div key={m.identity} style={{ position:'relative' }}><VideoTile member={m} active={m.identity===speaker?.identity} /></div>)}
        </div>);
    case 'news':
      return wrap(
        <div style={{ width:'100%', height:'100%', display:'flex', gap:8 }}>
          <div style={{ flex:'1 1 38%', position:'relative' }}>{cam(screenCam)}</div>
          <div style={{ flex:'1 1 62%', position:'relative', borderRadius:14, overflow:'hidden' }}>{Content}</div>
        </div>);
    case 'screen':
      return wrap(
        <div style={{ width:'100%', height:'100%', display:'flex', gap:8 }}>
          <div style={{ flex:'1 1 78%', position:'relative', borderRadius:14, overflow:'hidden' }}>{Content}</div>
          <div style={{ flex:'1 1 22%', position:'relative' }}>{cam(screenCam,false)}</div>
        </div>);
    case 'pip':
      return (
        <>
          <div style={{ position:'absolute', inset:0 }}>{Content}</div>
          <div style={{ position:'absolute', right:'3%', bottom:'6%', width:'20%', aspectRatio:'16/9' }}>{cam(screenCam,false)}</div>
        </>);
    case 'cinema':
      return <div style={{ position:'absolute', inset:0 }}>{Content}</div>;
    case 'spotlight': {
      const others = cams.filter(m => m.identity !== featured?.identity).slice(0,5);
      return wrap(
        <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', gap:8 }}>
          <div style={{ flex:1, position:'relative' }}>{cam(featured)}</div>
          {others.length>0 && <div style={{ flex:'0 0 22%', display:'flex', gap:8 }}>
            {others.map(m => <div key={m.identity} style={{ flex:1, position:'relative' }}>{cam(m,false)}</div>)}
          </div>}
        </div>);
    }
    case 'solo':
    default:
      return cam(featured);
  }
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
      fontFamily:ui, fontWeight:700, fontSize:size*0.36, color:C.base,
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
    <div style={{ flex:1, maxWidth:280, padding:'18px 20px', borderRadius:18,
      background:`linear-gradient(${side==='left'?'110deg':'250deg'}, ${a(tint,'1F')}, ${a(C.panel,'8C')} 80%)`,
      border:`1px solid ${a(tint,'40')}` }}>
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

/* ---- C2 · Live Debate Hall (concept panel 1) ----------------------------
   Competitor cards (prop left / opp right) flank the center floor stage with
   the amphitheater backdrop; gallery / audience-vote / judges row + the floor
   stat strip sit beneath. The broadcast controls + filmstrip are preserved
   underneath, and the host can flip the center to the broadcast MONITOR (what
   YouTube actually composes) without losing the hall. ChamberPreview,
   BroadcastBar, SafePanel and WinnerOverlay are reused verbatim — no live
   LiveKit / egress wiring changes. */
/* ---- D2 · Lecture Hall — single presenter, center stage, controlled by
   the layout bar beneath (the "old StreamYard model"). No sides, no
   judges, no audience verdict — just the presenter, their deck, and the
   room watching. The layout-driven ChamberPreview IS the main view here
   (unlike Oxford, there's no separate "Monitor" toggle needed since
   there's no competing cinematic floor view to switch away from). ---- */
function LectureHall({
  debateId, room, bs, onLocalState, me, role, speaker,
  onProfile, narrow, countdown, phaseLabel, onAskQuestion, isHost, onContextMenu,
}: {
  debateId: string; room: any; bs: BroadcastState;
  onLocalState: (patch: Partial<BroadcastState>) => void;
  me?: M; role: string; speaker?: M;
  onProfile: (h?: string | null) => void; narrow: boolean; countdown: string; phaseLabel: string;
  onAskQuestion?: () => void; isHost: boolean; onContextMenu: (e: React.MouseEvent, m: any) => void;
}) {
  const members = room.members as any[];
  const host = members.find(m => m.role === 'host');
  const mod = members.find(m => m.role === 'moderator');
  const canControl = role === 'host' || role === 'moderator';

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:0, height:'100%',
      overflowY:'auto', paddingBottom: narrow ? 10 : 0 }}>

      {/* presenter identity strip */}
      <div style={{ flexShrink:0 }}>
        <HostTopRow host={host} mod={mod} judgeCount={0} onProfile={onProfile} hideJudge
          onModContextMenu={mod ? (e) => onContextMenu(e, mod) : undefined} />
      </div>

      {/* main stage — layout-driven, always the ChamberPreview composition */}
      <div style={{ flex:'1 1 auto', minHeight: narrow ? 220 : 260, display:'flex', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'relative', height:'100%', width:'100%', borderRadius:18, overflow:'hidden',
          border:`1px solid ${C.hair}`, background:C.base2, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ height:'100%', maxWidth:'100%', maxHeight:'100%', aspectRatio:'16 / 9', position:'relative' }}>
            <SafePanel resetKey={`lecture:${bs.layout}:${bs.presenterId ?? ''}`} label="Stage" fill>
              <ChamberPreview members={members} bs={bs} debateId={debateId} speaker={speaker} speakerSide={null} meId={me?.identity} />
            </SafePanel>
          </div>
          <span style={{ position:'absolute', top:10, left:10, padding:'4px 11px', borderRadius:999,
            background:a(C.base,'B3'), border:`1px solid ${C.hairHi}`, fontFamily:ui, fontSize:10.5, fontWeight:700,
            color:C.ink, backdropFilter:'blur(6px)' }}>
            {phaseLabel} · <span style={{ fontFamily:mono }}>{countdown}</span>
          </span>
        </div>
      </div>

      {me && (
        <div style={{ marginTop:12, flexShrink:0 }}>
          <InteractionBar room={room.room} identity={me.identity} name={me.name} onAskQuestion={onAskQuestion} />
        </div>
      )}

      {canControl && (
        <div style={{ marginTop:12, flexShrink:0 }}>
          <SafePanel resetKey="lecture-bar" label="Controls">
            <BroadcastBar debateId={debateId} role={role} identity={me?.identity ?? ''}
              members={members} lkRoom={room.room} setScreenShare={room.setScreenShare}
              onLocalState={onLocalState} />
          </SafePanel>
        </div>
      )}
    </div>
  );
}


/* ---- D3 · Legacy Hall — Clubhouse/X Spaces style. Speakers (mic-capable:
   host, moderators, promoted speakers) up top in a scrollable grid;
   listeners below in their own scrollable grid. No sides, no judges, no
   timer — just an open room. Capacity (if the host set one) is enforced
   at invite-time, shown here as a simple counter. ---- */
function LegacyHall({
  debateId, room, me, role, motion, maxStageSeats, maxModerators,
  onProfile, onAskQuestion, isHost, onContextMenu,
}: {
  debateId: string; room: any; me?: M; role: string; motion: string;
  maxStageSeats: number | null | undefined; maxModerators: number | null | undefined;
  onProfile: (h?: string | null) => void; onAskQuestion?: () => void;
  isHost: boolean; onContextMenu: (e: React.MouseEvent, m: any) => void;
}) {
  const members = room.members as any[];
  const host = members.find(m => m.role === 'host');
  const speakers = members.filter(m => m.role === 'moderator' || m.role === 'debater');
  const listeners = members.filter(m => m.role === 'audience');
  const modCount = members.filter(m => m.role === 'moderator').length;
  const stageCount = speakers.length + (host ? 1 : 0);

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:0, height:'100%', overflowY:'auto' }}>
      <div style={{ flexShrink:0, marginBottom:8 }}>
        <div style={{ fontFamily:display, fontSize:19, fontWeight:600, color:C.ink,
          whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{motion}</div>
        <div style={{ fontFamily:ui, fontSize:12, color:C.faint, marginTop:2 }}>
          🎙 {stageCount} speaking · {listeners.length} listening
        </div>
      </div>

      {/* speakers — host, moderators, promoted speakers */}
      <div style={{ flexShrink:0, marginBottom:18 }}>
        <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:10 }}>
          <span style={{ fontFamily:ui, fontSize:11, fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:C.faint }}>
            On stage</span>
          {(maxStageSeats != null || maxModerators != null) && (
            <span style={{ fontFamily:mono, fontSize:10.5, color:C.faint }}>
              {maxStageSeats != null && `${stageCount}/${maxStageSeats} seats`}
              {maxStageSeats != null && maxModerators != null && ' · '}
              {maxModerators != null && `${modCount}/${maxModerators} mods`}
            </span>
          )}
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:18 }}>
          {host && <SpeakerTile member={host} tag="Host" tone={C.warning} onProfile={onProfile} />}
          {speakers.map(m => (
            <SpeakerTile key={m.identity} member={m} tag={m.role === 'moderator' ? 'Mod' : undefined}
              tone={m.role === 'moderator' ? C.gold : C.jadeHi} onProfile={onProfile}
              onContextMenu={isHost ? (e) => onContextMenu(e, m) : undefined} />
          ))}
        </div>
      </div>

      {/* listeners — scrollable, shows everyone in the room */}
      <div style={{ flexShrink:0 }}>
        <span style={{ fontFamily:ui, fontSize:11, fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase',
          color:C.faint, display:'block', marginBottom:10 }}>Listening · {listeners.length}</span>
        {listeners.length === 0 ? (
          <p style={{ fontFamily:ui, fontSize:12.5, color:C.faint }}>Empty for now.</p>
        ) : (
          <div style={{ display:'flex', flexWrap:'wrap', gap:14, maxHeight:260, overflowY:'auto', paddingRight:4 }}>
            {listeners.map(m => (
              <ListenerTile key={m.identity} member={m} onProfile={onProfile}
                onContextMenu={isHost ? (e) => onContextMenu(e, m) : undefined} />
            ))}
          </div>
        )}
      </div>

      {me && (
        <div style={{ marginTop:'auto', paddingTop:16, flexShrink:0 }}>
          <InteractionBar room={room.room} identity={me.identity} name={me.name} onAskQuestion={onAskQuestion} />
        </div>
      )}
    </div>
  );
}
function SpeakerTile({ member, tag, tone, onProfile, onContextMenu }: {
  member: any; tag?: string; tone: string; onProfile: (h?: string | null) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  const clickable = !!member.handle;
  return (
    <div onClick={clickable ? () => onProfile(member.handle) : undefined}
      onContextMenu={onContextMenu ? (e) => { e.preventDefault(); onContextMenu(e); } : undefined}
      style={{ width:84, textAlign:'center', cursor: clickable ? 'pointer' : 'default' }}>
      <div style={{ position:'relative', display:'inline-block' }}>
        <span style={{ display:'block', borderRadius:'50%',
          boxShadow: member.isSpeaking ? `0 0 0 3px ${C.base}, 0 0 0 5px ${tone}, 0 0 16px ${a(tone,'99')}` : `0 0 0 2px ${a(tone,'44')}` }}>
          <Initials name={member.name} url={member.avatar} size={68} />
        </span>
        {tag && (
          <span style={{ position:'absolute', bottom:-3, left:'50%', transform:'translateX(-50%)', padding:'1.5px 7px',
            borderRadius:999, background:C.base, border:`1px solid ${tone}`, color:tone, fontFamily:ui, fontSize:8.5, fontWeight:800,
            letterSpacing:'.06em', textTransform:'uppercase', whiteSpace:'nowrap' }}>{tag}</span>
        )}
        {!member.micOn && (
          <span style={{ position:'absolute', top:-2, right:-2, width:20, height:20, borderRadius:'50%',
            background:C.base, border:`1px solid ${C.hair}`, display:'grid', placeItems:'center', fontSize:10 }}>🔇</span>
        )}
      </div>
      <div style={{ fontFamily:ui, fontSize:11.5, fontWeight:600, color:C.ink, marginTop:6,
        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{member.name}</div>
    </div>
  );
}
function ListenerTile({ member, onProfile, onContextMenu }: {
  member: any; onProfile: (h?: string | null) => void; onContextMenu?: (e: React.MouseEvent) => void;
}) {
  const clickable = !!member.handle;
  return (
    <div onClick={clickable ? () => onProfile(member.handle) : undefined}
      onContextMenu={onContextMenu ? (e) => { e.preventDefault(); onContextMenu(e); } : undefined}
      style={{ width:60, textAlign:'center', cursor: clickable ? 'pointer' : 'default' }}>
      <Initials name={member.name} url={member.avatar} size={44} />
      <div style={{ fontFamily:ui, fontSize:10.5, color:C.dim, marginTop:5,
        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{member.name}</div>
    </div>
  );
}


/* ---- D4 · Speakers' Corner — scaled-up Oxford: 1v1 up to 5v5, audience
   vote only, no judges, no timer. Layout control (for the YouTube stream)
   is retained but slide-deck presenting is not — Evidence stays. Clicking
   a speaker expands them into the center spotlight; clicking again (or
   the × ) reverts. This is a per-viewer local choice, not host-broadcast,
   so everyone can focus on whoever they want independently. ---- */
function SpeakersCornerHall({
  debateId, room, bs, onLocalState, me, role, tally, myVote, onVote,
  onProfile, narrow, onAskQuestion, isHost, onContextMenu,
}: {
  debateId: string; room: any; bs: BroadcastState; onLocalState: (patch: Partial<BroadcastState>) => void;
  me?: M; role: string; tally: Tally; myVote: Side | null; onVote: (s: Side) => void;
  onProfile: (h?: string | null) => void; narrow: boolean; onAskQuestion?: () => void;
  isHost: boolean; onContextMenu: (e: React.MouseEvent, m: any) => void;
}) {
  const members = room.members as any[];
  const host = members.find(m => m.role === 'host');
  const mod = members.find(m => m.role === 'moderator');
  const propSpeakers = members.filter(m => m.role === 'debater' && m.side === 'prop');
  const oppSpeakers = members.filter(m => m.role === 'debater' && m.side === 'opp');
  const audience = members.filter(m => m.role === 'audience');
  const canControl = role === 'host' || role === 'moderator';
  const expandedId = bs.stageId;
  const setExpandedId = (identity: string | null) => {
    onLocalState({ stageId: identity }); // optimistic, instant for the clicker
    setSpotlight(debateId, identity).catch(() => {}); // persists + realtime-syncs to everyone else, incl. late joiners
  };
  const expanded = members.find(m => m.identity === expandedId);
  const { identity, reload: reloadIdentity } = useSideIdentity(debateId, true);
  const [customizing, setCustomizing] = useState<Side | null>(null);
  const iAmPropSpeaker = !!propSpeakers.find(m => m.identity === me?.identity);
  const iAmOppSpeaker = !!oppSpeakers.find(m => m.identity === me?.identity);

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:0, height:'100%',
      overflowY:'auto', paddingBottom: narrow ? 10 : 0 }}>
      <div style={{ flexShrink:0 }}>
        <HostTopRow host={host} mod={mod} judgeCount={0} onProfile={onProfile} hideJudge
          onModContextMenu={mod ? (e) => onContextMenu(e, mod) : undefined} />
      </div>

      {customizing && (
        <SideIdentityModal debateId={debateId} side={customizing} onClose={() => setCustomizing(null)}
          onSaved={() => { setCustomizing(null); reloadIdentity(); }} />
      )}

      <div style={{ display:'grid', gap:14, flexShrink:0, marginBottom:14,
        gridTemplateColumns: narrow ? '1fr' : 'minmax(160px,1fr) minmax(0,1.4fr) minmax(160px,1fr)' }}>
        <CornerSide side="prop" speakers={propSpeakers} expandedId={expandedId} setExpandedId={setExpandedId}
          isHost={isHost} onContextMenu={onContextMenu} identity={identity.prop}
          canCustomize={iAmPropSpeaker} onCustomize={() => setCustomizing('prop')} />
        <div style={{ borderRadius:18, border:`1px solid ${C.hair}`, background:C.base2, minHeight:220,
          display:'flex', alignItems:'center', justifyContent:'center', position:'relative', overflow:'hidden' }}>
          {expanded ? (
            <>
              <div style={{ position:'absolute', inset:0 }}><VideoTile member={expanded} active size="stage" /></div>
              <button onClick={() => setExpandedId(null)} title="Collapse"
                style={{ position:'absolute', top:10, right:10, width:30, height:30, borderRadius:'50%',
                  background:a(C.base,'B3'), border:`1px solid ${C.hairHi}`, color:C.ink, cursor:'pointer', fontSize:16 }}>×</button>
              <span style={{ position:'absolute', bottom:10, left:10, padding:'4px 11px', borderRadius:999,
                background:a(C.base,'B3'), border:`1px solid ${C.hairHi}`, fontFamily:ui, fontSize:11, fontWeight:700, color:C.ink }}>
                {expanded.name}</span>
            </>
          ) : (
            <div style={{ textAlign:'center', padding:20 }}>
              <svg width="46" height="26" viewBox="0 0 46 26" fill="none" aria-hidden style={{ margin:'0 auto 10px' }}>
                <path d="M23 1L44 9H2L23 1Z" fill={C.warning} opacity=".9" />
                <rect x="7" y="10" width="5" height="14" fill={C.warning} opacity=".85" />
                <rect x="20" y="10" width="5" height="14" fill={C.warning} opacity=".85" />
                <rect x="33" y="10" width="5" height="14" fill={C.warning} opacity=".85" />
                <rect x="2" y="24" width="42" height="2.4" rx="1.2" fill={C.warning} opacity=".9" />
              </svg>
              <div style={{ fontFamily:ui, fontSize:12.5, color:C.faint }}>Click a speaker to bring them into focus</div>
            </div>
          )}
        </div>
        <CornerSide side="opp" speakers={oppSpeakers} expandedId={expandedId} setExpandedId={setExpandedId}
          isHost={isHost} onContextMenu={onContextMenu} identity={identity.opp}
          canCustomize={iAmOppSpeaker} onCustomize={() => setCustomizing('opp')} />
      </div>

      <div style={{ display:'grid', gap:12, marginBottom:14, flexShrink:0,
        gridTemplateColumns: narrow ? '1fr' : '1.2fr 1fr' }}>
        <AudienceVoteStrip tally={tally} myVote={myVote} canVote onVote={onVote}
          propLabel={sideLabelFor('prop', identity.prop)} oppLabel={sideLabelFor('opp', identity.opp)} />
        <GalleryStrip audience={audience} onProfile={onProfile}
          onMemberContextMenu={isHost ? (e, m) => onContextMenu(e, m) : undefined} />
      </div>

      {me && (
        <div style={{ marginBottom:12, flexShrink:0 }}>
          <InteractionBar room={room.room} identity={me.identity} name={me.name} onAskQuestion={onAskQuestion} />
        </div>
      )}

      {canControl && (
        <div style={{ flexShrink:0 }}>
          <SafePanel resetKey="corner-bar" label="Controls">
            <BroadcastBar debateId={debateId} role={role} identity={me?.identity ?? ''}
              members={members} lkRoom={room.room} setScreenShare={room.setScreenShare}
              onLocalState={onLocalState} hidePresentSlides />
          </SafePanel>
        </div>
      )}
    </div>
  );
}
function CornerSide({ side, speakers, expandedId, setExpandedId, isHost, onContextMenu, identity, canCustomize, onCustomize }: {
  side: Side; speakers: any[]; expandedId: string | null; setExpandedId: (id: string | null) => void;
  isHost: boolean; onContextMenu: (e: React.MouseEvent, m: any) => void;
  identity: { label: string; logoUrl: string | null } | null; canCustomize: boolean; onCustomize: () => void;
}) {
  const tone = side === 'prop' ? C.jadeHi : C.garnetHi;
  const label = identity?.label || (side === 'prop' ? 'Proposition' : 'Opposition');
  return (
    <div style={{ borderRadius:18, border:`1px solid ${a(tone,'33')}`, background:a(tone,'0A'), padding:'12px 10px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, marginBottom:10 }}>
        {identity?.logoUrl && (
          <img src={identity.logoUrl} alt="" style={{ width:18, height:18, borderRadius:5, objectFit:'cover' }} />
        )}
        <span style={{ fontFamily:ui, fontWeight:800, fontSize:10.5, letterSpacing:'.1em', textTransform:'uppercase',
          color:tone, textAlign:'center', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:140 }}>{label}</span>
      </div>
      {canCustomize && (
        <div style={{ textAlign:'center', marginBottom:10 }}>
          <button onClick={onCustomize} style={{ background:'none', border:'none', cursor:'pointer',
            fontFamily:ui, fontSize:10, color:C.faint, textDecoration:'underline' }}>
            {identity ? 'Change name/logo' : 'Name this side'}
          </button>
        </div>
      )}
      {speakers.length === 0 ? (
        <div style={{ fontFamily:ui, fontSize:11.5, color:C.faint, textAlign:'center', padding:'14px 0' }}>Open seat</div>
      ) : (
        <div style={{ display:'flex', flexWrap:'wrap', gap:12, justifyContent:'center' }}>
          {speakers.map(m => (
            <div key={m.identity} onClick={() => setExpandedId(expandedId === m.identity ? null : m.identity)}
              onContextMenu={isHost ? (e) => { e.preventDefault(); onContextMenu(e, m); } : undefined}
              style={{ width:72, textAlign:'center', cursor:'pointer' }}>
              <span style={{ display:'block', borderRadius:'50%',
                boxShadow: expandedId === m.identity ? `0 0 0 3px ${C.base}, 0 0 0 5px ${tone}` : `0 0 0 2px ${a(tone,'44')}` }}>
                <Initials name={m.name} url={m.avatar} size={56} />
              </span>
              <div style={{ fontFamily:ui, fontSize:11, fontWeight:600, color:C.ink, marginTop:5,
                whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{m.name}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


function LiveHall({
  debateId, room, dz, bs, onLocalState, me, role, speaker, speakerSide,
  floor, tally, myVote, onVote, sideProfiles, onProfile, narrow, countdown, onAskQuestion, mobile,
  isHost, onContextMenu,
}: {
  debateId: string; room: any; dz: any; bs: BroadcastState;
  onLocalState: (patch: Partial<BroadcastState>) => void;
  me?: M; role: string; speaker?: M; speakerSide: Side | null;
  floor: FloorStats | null; tally: Tally; myVote: Side | null; onVote: (s: Side) => void;
  sideProfiles: { prop?: Profile; opp?: Profile }; onProfile: (h?: string | null) => void;
  narrow: boolean; countdown: string; onAskQuestion?: () => void; mobile?: boolean;
  isHost: boolean; onContextMenu: (e: React.MouseEvent, m: any) => void;
}) {
  const [monitor, setMonitor] = useState(false);

  const members = room.members as any[];
  const propMember = members.find(m => m.role === 'debater' && m.side === 'prop');
  const oppMember = members.find(m => m.role === 'debater' && m.side === 'opp');
  const host = members.find(m => m.role === 'host');
  const mod = members.find(m => m.role === 'moderator');
  const judges = members.filter(m => m.role === 'judge');
  const audience = members.filter(m => m.role === 'audience');

  const segTotal = dz.segments?.[dz.segIdx]?.duration_secs ?? 0;
  const phaseLabel = dz.seg?.label ?? 'In session';
  const canControl = role === 'host' || role === 'debater' || role === 'moderator';

  const overlays = (
    <>
      {dz.debate?.poll_open && (
        <div style={{ position:'absolute', top:10, right:10, zIndex:20, display:'flex', alignItems:'center', gap:6,
          padding:'5px 12px', borderRadius:20, background:a(C.base,'B3'), backdropFilter:'blur(6px)',
          border:`1px solid ${a(C.jade,'55')}` }}>
          <span style={{ width:8, height:8, borderRadius:'50%', background:C.jade, boxShadow:`0 0 6px ${C.jade}`, animation:'pulse 1.5s infinite' }} />
          <span style={{ fontFamily:ui, fontSize:11, fontWeight:700, color:C.jade, textTransform:'uppercase', letterSpacing:'.08em' }}>Voting open</span>
        </div>
      )}
      {dz.debate?.winner_announced && dz.results && (
        <WinnerOverlay
          winnerSide={dz.results.winner_side}
          winMode={dz.debate.win_mode ?? 'public'}
          peoplesChoice={dz.results.peoples_choice_side}
          propScore={dz.results.prop_judge_total}
          oppScore={dz.results.opp_judge_total}
          propAudience={dz.results.prop_audience}
          oppAudience={dz.results.opp_audience}
        />
      )}
    </>
  );

  // Slides/screen-share must be visible to everyone by default — not just
  // behind the host-only Monitor toggle, which only previews the YouTube
  // composition. This mirrors ChamberPreview's own derivation exactly.
  const presenter = bs.presenterId ? members.find(m => m.identity === bs.presenterId) : undefined;
  const screenTrack = (presenter as any)?.screenTrack;
  const hasScreen = bs.presentType === 'screen' && !!screenTrack;
  const isPresenting = !!bs.presenterId && (bs.presentType === 'slides' || hasScreen);
  const iPresentSlides = !!me?.identity && bs.presenterId === me.identity && bs.presentType === 'slides';
  const presentingContent = isPresenting
    ? (hasScreen ? <ScreenTile track={screenTrack} fit="contain" /> : <SlideStage debateId={debateId} canPresent={iPresentSlides} />)
    : null;

  const stage = monitor
    ? (
      <div style={{ position:'relative', height:'100%', width:'100%', minHeight:0, display:'flex', alignItems:'center', justifyContent:'center',
        borderRadius:18, overflow:'hidden', border:`1px solid ${C.hair}`, background:C.base2 }}>
        <div style={{ height:'100%', maxWidth:'100%', maxHeight:'100%', aspectRatio:'16 / 9', position:'relative' }}>
          <SafePanel resetKey={`mon:${bs.layout}:${bs.presenterId ?? ''}`} label="Monitor" fill>
            <ChamberPreview members={members} bs={bs} debateId={debateId} speaker={speaker} speakerSide={speakerSide} meId={me?.identity} />
          </SafePanel>
        </div>
        {overlays}
      </div>
    )
    : <FloorStage roundLabel={phaseLabel} countdown={countdown} hasFloorSide={speakerSide}
        presenting={presentingContent} presenterName={presenter?.name}>{overlays}</FloorStage>;

  const propCard = (
    <CompetitorCard side="prop" member={propMember} profile={sideProfiles.prop}
      hasFloor={speakerSide === 'prop'} speakingSecs={floor?.prop_speaking ?? 0} segTotal={segTotal} onProfile={onProfile}
      onContextMenu={propMember ? (e) => onContextMenu(e, propMember) : undefined} />
  );
  const oppCard = (
    <CompetitorCard side="opp" member={oppMember} profile={sideProfiles.opp}
      hasFloor={speakerSide === 'opp'} speakingSecs={floor?.opp_speaking ?? 0} segTotal={segTotal} onProfile={onProfile}
      onContextMenu={oppMember ? (e) => onContextMenu(e, oppMember) : undefined} />
  );

  const monitorToggle = canControl ? (
    <button onClick={() => setMonitor(v => !v)} title="Toggle the broadcast monitor (what YouTube sees)"
      style={{ padding:'6px 12px', borderRadius:10, border:`1px solid ${monitor ? a(C.gold,'66') : C.hair}`,
        background: monitor ? a(C.gold,'1F') : C.glass, color: monitor ? C.goldHi : C.dim,
        fontFamily:ui, fontSize:12, fontWeight:600, cursor:'pointer' }}>
      ◉ {monitor ? 'Monitor on' : 'Monitor'}
    </button>
  ) : undefined;

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:0, height:'100%',
      overflowY:'auto', paddingBottom: narrow ? 10 : 0 }}>
      <div style={{ flexShrink:0 }}>
        <HostTopRow host={host} mod={mod} judgeCount={judges.length} onProfile={onProfile} right={monitorToggle}
          onModContextMenu={mod ? (e) => onContextMenu(e, mod) : undefined} />
      </div>

      {narrow ? (
        <div style={{ display:'flex', flexDirection:'column', gap:12, flexShrink:0 }}>
          <div style={{ height:'46vh', minHeight:260, display:'flex' }}>{stage}</div>
          <div style={{ display:'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap:12 }}>{propCard}{oppCard}</div>
        </div>
      ) : (
        <div style={{ flex:'1 1 auto', flexShrink:0, minHeight:0, display:'grid', gap:14,
          gridTemplateColumns:'minmax(220px,300px) minmax(0,1fr) minmax(220px,300px)' }}>
          {propCard}
          <div style={{ display:'flex', minHeight:0 }}>{stage}</div>
          {oppCard}
        </div>
      )}

      <div style={{ display:'grid', gap:12, marginTop:14, flexShrink:0,
        gridTemplateColumns: narrow ? '1fr' : '1.1fr 1.3fr 1fr' }}>
        <GalleryStrip audience={audience} onProfile={onProfile}
          onMemberContextMenu={(e, m) => onContextMenu(e, m)} />
        <AudienceVoteStrip tally={tally} myVote={myVote} canVote={!!dz.debate?.poll_open} onVote={onVote} />
        <JudgesStrip judges={judges} onProfile={onProfile}
          onJudgeContextMenu={(e, m) => onContextMenu(e, m)} />
      </div>

      <div style={{ marginTop:12, flexShrink:0 }}>
        <FloorStatStrip floor={floor} hasFloorSide={speakerSide} phaseLabel={phaseLabel} segTotal={segTotal} />
      </div>

      {me && (
        <div style={{ marginTop:12, flexShrink:0 }}>
          <InteractionBar room={room.room} identity={me.identity} name={me.name} onAskQuestion={onAskQuestion} />
        </div>
      )}

      {canControl && (
        <div style={{ marginTop:12, flexShrink:0 }}>
          <SafePanel resetKey={`bar:${dz.phase}`} label="Controls">
            <BroadcastBar debateId={debateId} role={role} identity={me?.identity ?? ''}
              members={members} lkRoom={room.room} setScreenShare={room.setScreenShare}
              onLocalState={onLocalState} />
          </SafePanel>
        </div>
      )}

      <div style={{ display:'flex', gap:9, overflowX:'auto', padding:'12px 2px 4px', flexShrink:0 }}>
        {members.map(m => (
          <div key={m.identity} style={{ width:108, flexShrink:0 }}>
            <VideoTile member={m} active={m.identity === speaker?.identity} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- C5 · Stage Action Menu (host-only: right-click a profile to
   promote them onto the stage or move them back to the audience) ---- */
function StageActionMenu({ x, y, member, debateId, isSelf, onSendInvite, onClose, format }: {
  x: number; y: number; member: RoomMember; debateId: string; isSelf: boolean;
  onSendInvite: (role: StageRole, side: StageSide) => void; onClose: () => void; format?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const onStage = member.role !== 'audience';

  async function demote() {
    setBusy(true);
    try {
      await Promise.all([demoteToAudience(debateId, member.identity, member.identity), demoteFromStage(debateId, member.identity)]);
      onClose();
    } catch (e: any) { alert(e?.message ?? 'Could not leave the stage'); setBusy(false); }
  }
  function invite(role: StageRole, side: StageSide, label: string) {
    onSendInvite(role, side);
    setSent(label);
    setTimeout(onClose, 900);
  }

  const menuW = 210;
  const left = typeof window !== 'undefined' ? Math.min(x, window.innerWidth - menuW - 12) : x;
  const top = typeof window !== 'undefined' ? Math.min(y, window.innerHeight - 220) : y;

  return (
    <>
      <div onClick={onClose} onContextMenu={e => { e.preventDefault(); onClose(); }}
        style={{ position:'fixed', inset:0, zIndex:205 }} />
      <div style={{ position:'fixed', top, left, zIndex:210, width:menuW, borderRadius:12,
        background:C.panel, border:`1px solid ${C.hairHi}`, boxShadow:'0 20px 50px rgba(0,0,0,.5)', padding:6 }}>
        <div style={{ padding:'8px 10px 7px', fontFamily:ui, fontSize:11.5, fontWeight:700, color:C.ink,
          borderBottom:`1px solid ${C.hair}`, marginBottom:4, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
          {isSelf ? 'You' : member.name}
        </div>
        {sent ? (
          <div style={{ padding:'9px 10px', fontFamily:ui, fontSize:12.5, color:C.jadeHi }}>✓ Invite sent — {sent}</div>
        ) : isSelf ? (
          <MenuBtn label="Leave the stage" danger onClick={demote} busy={busy} />
        ) : onStage ? (
          <MenuBtn label="→ Move to audience" danger onClick={demote} busy={busy} />
        ) : format === 'legacy' ? (
          <>
            <MenuBtn label="Invite as Speaker" onClick={() => invite('debater', null, 'Speaker')} busy={busy} />
            <MenuBtn label="Invite as Moderator" onClick={() => invite('moderator', null, 'Moderator')} busy={busy} />
          </>
        ) : format === 'speakers_corner' ? (
          <>
            <MenuBtn label="Invite as Proposition" onClick={() => invite('debater', 'prop', 'Proposition')} busy={busy} />
            <MenuBtn label="Invite as Opposition" onClick={() => invite('debater', 'opp', 'Opposition')} busy={busy} />
            <MenuBtn label="Invite as Moderator" onClick={() => invite('moderator', null, 'Moderator')} busy={busy} />
          </>
        ) : (
          <>
            <MenuBtn label="Invite as Proposition" onClick={() => invite('debater', 'prop', 'Proposition')} busy={busy} />
            <MenuBtn label="Invite as Opposition" onClick={() => invite('debater', 'opp', 'Opposition')} busy={busy} />
            <MenuBtn label="Invite as Moderator" onClick={() => invite('moderator', null, 'Moderator')} busy={busy} />
            <MenuBtn label="Invite as Judge" onClick={() => invite('judge', null, 'Judge')} busy={busy} />
          </>
        )}
      </div>
    </>
  );
}
function MenuBtn({ label, onClick, busy, danger }: { label: string; onClick: () => void; busy: boolean; danger?: boolean }) {
  return (
    <button onClick={onClick} disabled={busy} style={{ display:'block', width:'100%', textAlign:'left', padding:'9px 10px',
      borderRadius:8, border:'none', background:'transparent', cursor: busy ? 'default' : 'pointer',
      fontFamily:ui, fontSize:13, fontWeight:500, color: danger ? C.garnetHi : C.ink, opacity: busy ? .6 : 1 }}
      onMouseEnter={e => { if (!busy) e.currentTarget.style.background = C.panel2; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
      {busy ? '…' : label}
    </button>
  );
}

/* ---- C6 · Incoming stage invite (shown to the invitee) ---- */
function IncomingStageInviteCard({ invite, onAccept, onDecline }: {
  invite: { fromName: string; role: string; side: string | null };
  onAccept: () => void; onDecline: () => void;
}) {
  const roleLabel = invite.side === 'prop' ? 'Proposition' : invite.side === 'opp' ? 'Opposition'
    : invite.role === 'moderator' ? 'Moderator' : invite.role === 'judge' ? 'Judge' : 'the stage';
  return (
    <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', zIndex:220,
      width:'min(380px, calc(100vw - 32px))', borderRadius:16, background:C.panel, border:`1px solid ${C.hairHi}`,
      boxShadow:'0 24px 60px rgba(0,0,0,.55)', padding:18, textAlign:'center' }}>
      <div style={{ fontFamily:ui, fontSize:13, color:C.dim, marginBottom:6 }}>
        <strong style={{ color:C.ink }}>{invite.fromName}</strong> invited you to join as
      </div>
      <div style={{ fontFamily:display, fontSize:20, fontWeight:700, color:C.goldHi, marginBottom:16 }}>{roleLabel}</div>
      <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
        <button onClick={onDecline} style={{ ...ghostBtn, flex:1 }}>Decline</button>
        <button onClick={onAccept} style={{ ...solidGold, flex:1 }}>Accept</button>
      </div>
    </div>
  );
}
