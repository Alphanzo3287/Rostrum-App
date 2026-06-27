// =====================================================================
// The Rostrum · src/screens/BroadcastScreen.tsx
// The audience-facing "studio output" rendered by LiveKit web egress and
// streamed to YouTube. NO host controls — just the show: motion header,
// segment + timer, speaker spotlight with slides, prop/opp name plates,
// and an audience strip. Token + LiveKit URL arrive as query params.
// Route: /broadcast/:id?t=<token>&u=<livekit_url>
// =====================================================================
import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useDebate } from '../lib/useDebate';
import { useBroadcastRoom } from '../lib/useBroadcastRoom';
import { getDeck, subscribeSlide } from '../lib/api';
import { VideoTile } from '../components/VideoTile';
import { SlideStage } from '../components/SlideStage';
import { C, ui, display, mono } from '../lib/theme';

export function BroadcastScreen() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const token = params.get('t');
  const url   = params.get('u');

  const debateId = id ?? '';
  const dz   = useDebate(debateId);
  const { members } = useBroadcastRoom(token, url);

  // Detect whether a deck is shared, so we can choose the layout:
  //  · deck present → slides large, speaker inset (your option 1)
  //  · no deck      → speaker large, full stage (your option 3 fallback)
  const [hasDeck, setHasDeck] = useState(false);
  useEffect(() => {
    if (!debateId) return;
    let alive = true;
    const refresh = () => getDeck(debateId).then(({ urls }) => { if (alive) setHasDeck(urls.length > 0); }).catch(() => {});
    refresh();
    const off = subscribeSlide(debateId, refresh);
    return () => { alive = false; off(); };
  }, [debateId]);

  // Who's on the floor: active speaker → current side's debater → host.
  const speakerSide = dz.seg?.side ?? null;
  const speaker = useMemo(() =>
    members.find(m => m.isSpeaking && m.camOn)
    ?? members.find(m => m.isSpeaking)
    ?? members.find(m => m.role === 'debater' && m.side === speakerSide)
    ?? members.find(m => m.role === 'host'),
  [members, speakerSide]);

  const debaters = members.filter(m => m.role === 'debater');
  const audience = members.filter(m => m.role === 'audience');
  const prop = debaters.filter(m => m.side === 'prop');
  const opp  = debaters.filter(m => m.side === 'opp');
  const host = members.find(m => m.role === 'host');

  // The corner inset follows the show: while a deck is being presented, show
  // the PRESENTER (the debater on the floor for the current side) and remove
  // the host; between slide segments the host returns.
  const presenter = members.find(m => m.role === 'debater' && m.side === speakerSide)
    ?? members.find(m => m.isSpeaking && m.role === 'debater');
  const cornerPerson = hasDeck ? (presenter ?? speaker) : (speaker ?? host);

  const mm = String(Math.floor(dz.remaining / 60)).padStart(2, '0');
  const ss = String(dz.remaining % 60).padStart(2, '0');
  const low = dz.remaining <= 30 && dz.phase === 'live';
  const onAir = dz.phase === 'live';
  const assembling = dz.phase === 'assembly';

  return (
    <div style={{ position:'fixed', inset:0, background:'#0a0909', display:'flex', flexDirection:'column',
      fontFamily:ui, overflow:'hidden' }}>

      {/* ── Top bar: brand · motion · timer ── */}
      <div style={{ display:'flex', alignItems:'center', gap:16, padding:'14px 22px',
        background:'linear-gradient(180deg, rgba(0,0,0,0.6), transparent)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:9 }}>
          <span style={{ fontFamily:display, fontSize:18, fontWeight:800, color:C.gold, letterSpacing:'.01em' }}>
            The Rostrum
          </span>
        </div>
        <div style={{ flex:1, textAlign:'center', minWidth:0 }}>
          {dz.debate?.motion && (
            <div style={{ fontFamily:display, fontSize:17, fontWeight:600, color:C.ink,
              whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', padding:'0 12px' }}>
              {dz.debate.motion}
            </div>
          )}
          {dz.seg && (
            <div style={{ fontSize:11.5, color:C.gold, marginTop:2, letterSpacing:'.05em',
              textTransform:'uppercase', fontWeight:600 }}>
              {dz.seg.label}
            </div>
          )}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          {onAir && (
            <div style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 11px', borderRadius:999,
              background:'rgba(220,50,50,0.18)', border:'1px solid rgba(220,50,50,0.5)' }}>
              <span style={{ width:7, height:7, borderRadius:'50%', background:'#ff3b3b',
                animation:'pulse 1.4s ease-in-out infinite' }} />
              <span style={{ fontSize:11, fontWeight:800, color:'#ff5a5a', letterSpacing:'.08em' }}>LIVE</span>
            </div>
          )}
          <div style={{ fontFamily:mono, fontSize:22, fontWeight:700,
            color: low ? C.garnetHi : C.ink, letterSpacing:'.04em', minWidth:78, textAlign:'right' }}>
            {mm}:{ss}
          </div>
        </div>
      </div>

      {/* ── Main area: assembly seating before the gavel, live show after ── */}
      {assembling ? (
        <BroadcastAssembly host={host} prop={prop} opp={opp}
          mod={members.find(m => m.role === 'moderator')}
          judges={members.filter(m => m.role === 'judge')}
          audience={audience} />
      ) : (
      <div style={{ flex:1, display:'flex', gap:12, padding:'4px 18px 12px', overflow:'hidden' }}>
        {/* Main stage: slides-large with speaker inset when a deck is shared;
            otherwise the speaker fills the stage. */}
        <div style={{ flex:'1 1 72%', position:'relative', borderRadius:14, overflow:'hidden',
          border:`1px solid ${C.hair}`, background:'#111' }}>
          {hasDeck ? (
            <>
              <SlideStage debateId={debateId} canPresent={false} />
              {cornerPerson && (
                <div style={{ position:'absolute', bottom:14, right:14, width:240, height:135,
                  borderRadius:10, overflow:'hidden', border:`2px solid ${
                    cornerPerson.side === 'prop' ? C.jadeHi : cornerPerson.side === 'opp' ? C.garnetHi : C.gold}`,
                  boxShadow:'0 8px 24px rgba(0,0,0,0.5)' }}>
                  <VideoTile member={cornerPerson} active size="tile" />
                </div>
              )}
            </>
          ) : (
            cornerPerson
              ? <VideoTile member={cornerPerson} active size="stage" />
              : <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center',
                  color:C.faint, fontSize:14 }}>Waiting for the debate to begin…</div>
          )}
        </div>

        {/* Right rail: prop / opp name plates */}
        <div style={{ flex:'0 0 26%', display:'flex', flexDirection:'column', gap:10, minWidth:0 }}>
          <SideCard label="Proposition" tone={C.jadeHi} members={prop} active={speakerSide==='prop'} />
          <SideCard label="Opposition" tone={C.garnetHi} members={opp} active={speakerSide==='opp'} />
        </div>
      </div>
      )}

      {/* ── Audience strip (live show only) ── */}
      {!assembling && audience.length > 0 && (
        <div style={{ flex:'0 0 auto', padding:'8px 18px 14px' }}>
          <div style={{ fontSize:10, color:C.faint, letterSpacing:'.08em', textTransform:'uppercase',
            marginBottom:6, fontWeight:600 }}>
            In the hall · {audience.length}
          </div>
          <div style={{ display:'flex', gap:8, overflow:'hidden' }}>
            {audience.slice(0, 12).map(m => (
              <div key={m.identity} style={{ width:96, height:64, flexShrink:0, borderRadius:8,
                overflow:'hidden', border:`1px solid ${C.hair}` }}>
                <VideoTile member={m} size="tile" />
              </div>
            ))}
            {audience.length > 12 && (
              <div style={{ width:64, height:64, flexShrink:0, borderRadius:8, border:`1px solid ${C.hair}`,
                display:'flex', alignItems:'center', justifyContent:'center', color:C.dim, fontSize:13, fontWeight:700 }}>
                +{audience.length - 12}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer watermark — invites YouTube viewers into the app */}
      <div style={{ flex:'0 0 auto', padding:'7px 22px', textAlign:'center',
        background:'rgba(0,0,0,0.4)', borderTop:`1px solid ${C.hair}` }}>
        <span style={{ fontSize:12, color:C.dim }}>
          Join the debate live at <span style={{ color:C.gold, fontWeight:700 }}>rostrums.site</span>
        </span>
      </div>

      <style>{`
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:.3 } }
      `}</style>
    </div>
  );
}

function BroadcastAssembly({ host, mod, judges, prop, opp, audience }: {
  host?: any; mod?: any; judges: any[]; prop: any[]; opp: any[]; audience: any[];
}) {
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', padding:'10px 26px 18px', overflow:'hidden' }}>
      {/* eyebrow */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:22 }}>
        <span style={{ width:8, height:8, borderRadius:'50%', background:C.gold, boxShadow:`0 0 10px ${C.gold}` }} />
        <span style={{ fontSize:11, fontWeight:700, letterSpacing:'2.5px', textTransform:'uppercase', color:C.gold }}>
          The hall is filling — debate begins shortly
        </span>
        <span style={{ marginLeft:'auto', fontFamily:mono, fontSize:12.5, color:C.dim }}>
          {prop.length + opp.length} debaters · {judges.length} judges · {audience.length} in the hall
        </span>
      </div>

      {/* host / moderator / judges row */}
      <div style={{ display:'flex', justifyContent:'center', gap:28, marginBottom:26, flexWrap:'wrap' }}>
        {host && <BSeat p={host} accent={C.gold} label="Host" />}
        {mod ? <BSeat p={mod} accent={C.goldHi} label="Moderator" /> : <BOpen accent={C.goldHi} label="Moderator" />}
        <div style={{ display:'flex', gap:16, paddingLeft:22, borderLeft:`1px solid ${C.hair}` }}>
          {judges.length ? judges.map(j => <BSeat key={j.identity} p={j} accent={C.dim} label="Judge" />)
                         : <BOpen accent={C.dim} label="Judge" />}
        </div>
      </div>

      {/* benches around the floor */}
      <div style={{ flex:1, display:'flex', alignItems:'flex-start', justifyContent:'space-between',
        gap:18, minHeight:0 }}>
        <BBench title="Proposition" tone={C.jadeHi} people={prop} />
        <div style={{ textAlign:'center', flexShrink:0, paddingTop:24 }}>
          <div style={{ width:90, height:60, margin:'0 auto', borderRadius:'8px 8px 4px 4px',
            background:`linear-gradient(180deg, ${C.panel2}, ${C.base})`, border:`1px solid ${C.hairHi}`,
            boxShadow:'0 0 26px rgba(217,180,92,0.18)', position:'relative' }}>
            <span style={{ position:'absolute', top:-9, left:'50%', transform:'translateX(-50%)', width:34, height:9,
              background:C.gold, borderRadius:3, opacity:.85 }} />
          </div>
          <div style={{ fontSize:10.5, color:C.faint, marginTop:9, letterSpacing:'1.5px', textTransform:'uppercase' }}>
            The floor
          </div>
        </div>
        <BBench title="Opposition" tone={C.garnetHi} people={opp} />
      </div>

      {/* gallery */}
      <div style={{ marginTop:14, paddingTop:14, borderTop:`1px solid ${C.hair}` }}>
        <div style={{ fontSize:10.5, fontWeight:700, letterSpacing:'2.5px', textTransform:'uppercase',
          color:C.faint, marginBottom:10 }}>
          Gallery · {audience.length} seated
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {audience.length === 0
            ? <span style={{ fontSize:12, color:C.faint }}>No one in the gallery yet.</span>
            : audience.slice(0, 24).map(a => <BAvatar key={a.identity} name={a.name} />)}
          {audience.length > 24 && (
            <div style={{ width:34, height:34, borderRadius:'50%', display:'grid', placeItems:'center',
              background:C.panel, color:C.dim, fontFamily:mono, fontSize:11 }}>+{audience.length - 24}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function BSeat({ p, accent, label }: { p: any; accent: string; label: string }) {
  return (
    <div style={{ textAlign:'center', width:96 }}>
      <div style={{ width:64, height:64, margin:'0 auto', borderRadius:'50%', overflow:'hidden',
        border:`2px solid ${accent}`, background:C.panel }}>
        {p.camOn && p.videoTrack
          ? <VideoTile member={p} active size="tile" />
          : <BAvatar name={p.name} size={64} bare />}
      </div>
      <div style={{ fontSize:12.5, fontWeight:600, color:C.ink, marginTop:7,
        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.name}</div>
      <div style={{ fontSize:9.5, color:accent, letterSpacing:'1px', textTransform:'uppercase', marginTop:1 }}>{label}</div>
    </div>
  );
}
function BOpen({ accent, label }: { accent: string; label: string }) {
  return (
    <div style={{ textAlign:'center', width:96 }}>
      <div style={{ width:64, height:64, margin:'0 auto', borderRadius:'50%',
        border:`1.5px dashed ${C.hair}`, display:'grid', placeItems:'center', color:C.faint, fontSize:22 }}>+</div>
      <div style={{ fontSize:10, color:C.faint, marginTop:7 }}>Open</div>
      <div style={{ fontSize:9.5, color:accent, letterSpacing:'1px', textTransform:'uppercase', marginTop:1 }}>{label}</div>
    </div>
  );
}
function BBench({ title, tone, people }: { title: string; tone: string; people: any[] }) {
  return (
    <div style={{ flex:1, borderRadius:14, border:`1px solid ${tone}33`, background:`${tone}0a`,
      padding:'14px 16px', minHeight:0 }}>
      <div style={{ fontSize:11, fontWeight:800, letterSpacing:'.07em', textTransform:'uppercase',
        color:tone, marginBottom:12 }}>{title}</div>
      <div style={{ display:'flex', gap:14, flexWrap:'wrap' }}>
        {people.length === 0
          ? <span style={{ fontSize:12, color:C.faint, fontStyle:'italic' }}>Seat open</span>
          : people.map(p => <BSeat key={p.identity} p={p} accent={tone} label="Debater" />)}
      </div>
    </div>
  );
}
function BAvatar({ name, size = 34, bare }: { name: string; size?: number; bare?: boolean }) {
  const initial = (name || '?').charAt(0).toUpperCase();
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', display:'grid', placeItems:'center',
      background:`linear-gradient(135deg, ${C.panel2}, ${C.panel})`, color:C.dim,
      fontSize:size*0.4, fontWeight:700, border: bare ? 'none' : `1px solid ${C.hair}` }}>
      {initial}
    </div>
  );
}


function SideCard({ label, tone, members, active }: {
  label: string; tone: string; members: any[]; active: boolean;
}) {
  return (
    <div style={{ flex:1, borderRadius:12, border:`1px solid ${active ? tone : C.hair}`,
      background: active ? `${tone}14` : 'rgba(255,255,255,0.02)', padding:10, display:'flex',
      flexDirection:'column', minHeight:0, transition:'border-color .3s, background .3s' }}>
      <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:8 }}>
        <span style={{ width:8, height:8, borderRadius:'50%', background:tone }} />
        <span style={{ fontSize:11, fontWeight:800, color:tone, letterSpacing:'.07em', textTransform:'uppercase' }}>
          {label}
        </span>
      </div>
      <div style={{ flex:1, display:'flex', flexDirection:'column', gap:8, minHeight:0 }}>
        {members.length === 0
          ? <div style={{ fontSize:12, color:C.faint, fontStyle:'italic' }}>Seat empty</div>
          : members.map((m: any) => (
            <div key={m.identity} style={{ flex:1, minHeight:0, borderRadius:8, overflow:'hidden',
              border:`1px solid ${C.hair}`, position:'relative' }}>
              <VideoTile member={m} active={active} size="tile" />
              <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'4px 8px',
                background:'linear-gradient(transparent, rgba(0,0,0,0.8))', fontSize:12, fontWeight:600, color:'#fff' }}>
                {m.name}
              </div>
            </div>
          ))
        }
      </div>
    </div>
  );
}
