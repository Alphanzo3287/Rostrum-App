// =====================================================================
// The Rostrum · src/screens/WatchScreen.tsx
// Batch 8: immersive full-screen debate viewer.
// Optimized for watching — no nav, no dock clutter, focus on content.
// Layouts: spotlight (featured speaker), slides (content-first), grid.
// YouTube embed available if the host has simulcasted.
// =====================================================================
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useRoom } from '../lib/useRoom';
import { useDebate } from '../lib/useDebate';
import { joinDebate, getDebate } from '../lib/api';
import { VideoTile } from '../components/VideoTile';
import { SlideStage } from '../components/SlideStage';
import { C, ui, display, mono } from '../lib/theme';
import type { Debate } from '../lib/types';

type Layout = 'spotlight' | 'slides' | 'grid';

export function WatchScreen({ debateId, onLeave }: { debateId: string; onLeave: () => void }) {
  const { user } = useAuth();
  const room    = useRoom(debateId);
  const dz      = useDebate(debateId);
  const nav     = useNavigate();
  const [layout, setLayout]   = useState<Layout>('spotlight');
  const [uiVis, setUiVis]     = useState(true);
  const [debate, setDebate]   = useState<Debate | null>(null);
  const [hideTimer, setHideTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { joinDebate(debateId).catch(() => {}); }, [debateId]);
  useEffect(() => { getDebate(debateId).then(setDebate).catch(() => {}); }, [debateId]);
  useEffect(() => { if (dz.phase === 'ended') nav(`/results/${debateId}`); }, [dz.phase, debateId, nav]);

  // Auto-hide UI chrome after 4s of no mouse movement
  const showUI = useCallback(() => {
    setUiVis(true);
    if (hideTimer) clearTimeout(hideTimer);
    const t = setTimeout(() => setUiVis(false), 4000);
    setHideTimer(t);
  }, [hideTimer]);

  useEffect(() => {
    window.addEventListener('mousemove', showUI);
    window.addEventListener('touchstart', showUI);
    showUI();
    return () => {
      window.removeEventListener('mousemove', showUI);
      window.removeEventListener('touchstart', showUI);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const me = room.members.find(m => m.isLocal);
  const speakerSide = dz.seg?.side ?? null;
  const speaker = room.members.find(m => m.isSpeaking)
    ?? room.members.find(m => m.role === 'debater' && m.side === speakerSide)
    ?? room.members.find(m => m.role === 'host');

  const debaters = room.members.filter(m => m.role === 'debater');
  const others   = room.members.filter(m => m.role !== 'debater' && !m.isLocal);

  const mm = String(Math.floor(dz.remaining / 60)).padStart(2, '0');
  const ss = String(dz.remaining % 60).padStart(2, '0');
  const low = dz.remaining <= 30 && dz.phase === 'live';
  const onAir = dz.phase === 'live';

  return (
    <div style={{ position:'fixed', inset:0, background:'#0a0909', display:'flex', flexDirection:'column',
      cursor: uiVis ? 'default' : 'none' }}>

      {/* ── Top chrome (fades on idle) ── */}
      <div style={{ position:'absolute', top:0, left:0, right:0, zIndex:20,
        background:'linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, transparent 100%)',
        padding:'16px 20px', display:'flex', alignItems:'center', gap:14,
        opacity: uiVis ? 1 : 0, transition:'opacity 0.4s', pointerEvents: uiVis ? 'auto' : 'none' }}>
        <button onClick={onLeave} style={{ background:'none', border:'none', color:C.dim, cursor:'pointer',
          fontFamily:ui, fontSize:22, lineHeight:1, padding:0 }}>‹</button>
        <div style={{ flex:1 }}>
          {debate?.motion && (
            <div style={{ fontFamily:display, fontSize:15, fontWeight:600, color:C.ink,
              whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:600 }}>
              {debate.motion}
            </div>
          )}
          {dz.seg && (
            <div style={{ fontFamily:ui, fontSize:11, color:C.faint, marginTop:2 }}>
              {dz.seg.label}
            </div>
          )}
        </div>

        {/* Clock */}
        {onAir && (
          <div style={{ fontFamily:mono, fontSize:20, fontWeight:700,
            color: low ? C.garnetHi : C.ink, letterSpacing:'0.04em' }}>
            {mm}:{ss}
          </div>
        )}

        {/* On-air badge */}
        {onAir && (
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 10px', borderRadius:999,
            background:'rgba(220,50,50,0.15)', border:'1px solid rgba(220,50,50,0.4)' }}>
            <span style={{ width:7, height:7, borderRadius:'50%', background:'#e03030',
              animation:'pulse 1.5s ease-in-out infinite' }} />
            <span style={{ fontFamily:ui, fontSize:11, fontWeight:700, color:'#e03030', letterSpacing:'.06em' }}>LIVE</span>
          </div>
        )}

        {/* Layout switcher */}
        <div style={{ display:'flex', gap:4 }}>
          {(['spotlight','slides','grid'] as Layout[]).map(l => (
            <button key={l} onClick={() => setLayout(l)} style={{
              padding:'5px 10px', borderRadius:4, border:'none', cursor:'pointer', fontFamily:ui, fontSize:10.5, fontWeight:600,
              background: layout===l ? C.gold : 'rgba(255,255,255,0.08)',
              color: layout===l ? C.base : C.dim }}>
              {l === 'spotlight' ? '◉' : l === 'slides' ? '▤' : '⊞'}
            </button>
          ))}
        </div>

        {/* Viewer count */}
        <div style={{ fontFamily:ui, fontSize:12, color:C.faint }}>
          {Math.max(dz.debate?.viewer_count ?? 0, room.members.length).toLocaleString()} watching
        </div>
      </div>

      {/* ── Main stage ── */}
      <div style={{ flex:1, display:'flex', overflow:'hidden', position:'relative' }}>

        {/* Slides layout: deck fills 70%, speaker strip on right */}
        {layout === 'slides' && (
          <>
            <div style={{ flex:'0 0 70%', display:'flex', alignItems:'center', justifyContent:'center',
              background:'#111', padding:8 }}>
              <SlideStage debateId={debateId} />
            </div>
            <div style={{ flex:1, display:'flex', flexDirection:'column', gap:6, padding:8, overflowY:'auto' }}>
              {debaters.map(m => (
                <div key={m.identity} style={{ flex:1, minHeight:0 }}>
                  <VideoTile member={m} active={m.identity === speaker?.identity} />
                </div>
              ))}
            </div>
          </>
        )}

        {/* Spotlight: featured speaker large, others strip at bottom */}
        {layout === 'spotlight' && (
          <div style={{ flex:1, display:'flex', flexDirection:'column' }}>
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center',
              position:'relative', overflow:'hidden' }}>
              {speaker
                ? <VideoTile member={speaker} active style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                : <SlideStage debateId={debateId} />}
            </div>
            {/* Secondary speakers strip */}
            {room.members.filter(m => m.identity !== speaker?.identity).length > 0 && (
              <div style={{ display:'flex', gap:6, padding:'8px 10px',
                background:'rgba(0,0,0,0.5)', overflowX:'auto' }}>
                {room.members.filter(m => m.identity !== speaker?.identity).map(m => (
                  <div key={m.identity} style={{ width:120, flexShrink:0 }}>
                    <VideoTile member={m} active={false} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Grid: equal tiles */}
        {layout === 'grid' && (
          <div style={{ flex:1, display:'grid', gap:6, padding:8,
            gridTemplateColumns: `repeat(${Math.min(room.members.length, 3)}, 1fr)`,
            gridAutoRows:'1fr', alignContent:'start' }}>
            {room.members.map(m => (
              <VideoTile key={m.identity} member={m} active={m.identity === speaker?.identity} />
            ))}
          </div>
        )}
      </div>

      {/* ── Bottom chrome (sides badge) ── */}
      <div style={{ position:'absolute', bottom:0, left:0, right:0, zIndex:20,
        background:'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)',
        padding:'14px 20px', display:'flex', gap:14, alignItems:'flex-end',
        opacity: uiVis ? 1 : 0, transition:'opacity 0.4s', pointerEvents:'none' }}>
        {debaters.filter(m => m.side === 'prop').length > 0 && (
          <SidePill side="prop" label="Proposition"
            names={debaters.filter(m => m.side==='prop').map(m => m.name)} />
        )}
        {debaters.filter(m => m.side === 'opp').length > 0 && (
          <SidePill side="opp" label="Opposition"
            names={debaters.filter(m => m.side==='opp').map(m => m.name)} />
        )}
        <div style={{ marginLeft:'auto', pointerEvents:'auto' }}>
          <button onClick={onLeave} style={{ background:'rgba(255,255,255,0.08)', border:'none', cursor:'pointer',
            color:C.dim, fontFamily:ui, fontSize:12, padding:'7px 14px', borderRadius:6 }}>
            Leave
          </button>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%  { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

function SidePill({ side, label, names }: { side: 'prop'|'opp'; label: string; names: string[] }) {
  const color = side === 'prop' ? C.jadeHi : C.garnetHi;
  return (
    <div style={{ padding:'6px 12px', borderRadius:6, background:'rgba(0,0,0,0.5)',
      border:`1px solid ${color}44` }}>
      <div style={{ fontFamily:ui, fontSize:9.5, fontWeight:700, letterSpacing:'.08em',
        textTransform:'uppercase', color }}>{label}</div>
      <div style={{ fontFamily:ui, fontSize:12, color:C.ink, marginTop:2 }}>{names.join(' · ')}</div>
    </div>
  );
}
