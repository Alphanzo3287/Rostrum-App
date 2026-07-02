// =====================================================================
// The Rostrum · src/screens/LobbyScreen.tsx (2026 redesign)
// Editorial bento layout: cinematic hero, live arenas, upcoming debates,
// global activity map, trending topics, top debaters.
// =====================================================================
import { useEffect, useState, type ReactNode } from 'react';
import {
  listLiveDebates, listUpcomingDebates, getPlatformStats, getTopDebaters,
  type PlatformStats, type TopDebater,
} from '../lib/api';
import type { Debate } from '../lib/types';
import { C, ui, display, mono, solidGold, a } from '../lib/theme';
import { Avatar } from '../components/ui';
import { GlobalActivityMap } from '../components/GlobalActivityMap';
import { useIsTablet } from '../lib/useMediaQuery';

// ── small util ────────────────────────────────────────────────────────
const fmt = (n: number) => n >= 1000000 ? `${(n/1000000).toFixed(1)}M` : n >= 1000 ? `${(n/1000).toFixed(1)}K` : String(n);
function fmtDate(d: string) { try { return new Date(d).toLocaleDateString('en-US', { month:'short', day:'numeric' }); } catch { return d; } }
function fmtTime(d: string) { try { return new Date(d).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' }); } catch { return ''; } }
function fmtRelDay(d: string) {
  try {
    const dt = new Date(d); const now = new Date();
    const diff = Math.floor((dt.getTime() - now.getTime()) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    return dt.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });
  } catch { return ''; }
}

const TRENDING = [
  'Artificial Intelligence', 'Climate Change', 'Free Speech',
  'Education Reform', 'Universal Basic Income', 'Cryptocurrency',
];

// ── shell helpers ─────────────────────────────────────────────────────
function PanelTitle({ children, action, onAction }: { children: ReactNode; action?: string; onAction?: () => void }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
      <div style={{ display:'flex', alignItems:'center', gap:9 }}>
        <span style={{ width:7, height:7, borderRadius:'50%', background:C.garnet,
          boxShadow:`0 0 12px ${C.garnet}` }} />
        <div style={{ fontFamily:ui, fontSize:12, fontWeight:700, color:C.faint,
          textTransform:'uppercase', letterSpacing:'.14em' }}>{children}</div>
      </div>
      {action && (
        <button onClick={onAction} style={{ background:'none', border:'none', cursor:'pointer',
          fontFamily:ui, fontSize:12, fontWeight:600, color:C.cyan,
          display:'flex', alignItems:'center', gap:6 }}>
          {action} <span style={{ fontSize:14 }}>→</span>
        </button>
      )}
    </div>
  );
}

function Card({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background:C.panel, border:`1px solid ${C.hair}`, borderRadius:24,
      boxShadow:`0 1px 0 ${a('#FFFFFF','08')} inset, 0 20px 60px rgba(0,0,0,0.25)`,
      padding:24, ...style }}>{children}</div>
  );
}

// ── HERO ──────────────────────────────────────────────────────────────
function Hero({ stats, onExplore }: { stats: PlatformStats | null; onExplore: () => void }) {
  return (
    <div style={{ position:'relative', borderRadius:28, overflow:'hidden',
      border:`1px solid ${C.hair}`, minHeight:380,
      background:`linear-gradient(135deg, ${a(C.gold,'14')}, ${a(C.cyan,'07')}), url('/hero-coliseum.png') center/cover no-repeat`,
      boxShadow:`0 30px 80px rgba(0,0,0,0.4)` }}>
      <div style={{ position:'absolute', inset:0,
        background:`linear-gradient(105deg, rgba(9,11,16,0.85) 0%, rgba(9,11,16,0.55) 45%, rgba(9,11,16,0.15) 100%)` }} />
      <div style={{ position:'relative', display:'grid', gridTemplateColumns:'1fr auto', gap:32,
        padding:'40px 36px', minHeight:380, alignItems:'center' }}>
        <div style={{ maxWidth:520 }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'6px 14px', borderRadius:999,
            background:a(C.garnet,'1A'), border:`1px solid ${a(C.garnet,'40')}`,
            marginBottom:24 }}>
            <span style={{ width:7, height:7, borderRadius:'50%', background:C.garnet,
              boxShadow:`0 0 10px ${C.garnet}` }} />
            <span style={{ fontFamily:ui, fontSize:11, fontWeight:800, color:C.garnetHi,
              textTransform:'uppercase', letterSpacing:'.16em' }}>LIVE NOW</span>
          </div>
          <h1 style={{ fontFamily:display, fontSize:'clamp(36px, 5vw, 56px)', fontWeight:700, color:'#FFFFFF',
            lineHeight:1.04, margin:'0 0 18px', letterSpacing:'-.02em' }}>
            Where Ideas<br />Take the Stage.
          </h1>
          <p style={{ fontFamily:ui, fontSize:15, color:C.dim, lineHeight:1.6, margin:'0 0 30px', maxWidth:440 }}>
            Watch. Debate. Vote. Influence. The world's premier platform for intelligent discourse.
          </p>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
            <button onClick={onExplore}
              style={{ ...solidGold, padding:'14px 22px', fontSize:14, borderRadius:14 }}>
              Explore Live Debates <span style={{ fontSize:14 }}>→</span>
            </button>
            <button style={{ display:'inline-flex', alignItems:'center', gap:10,
              padding:'14px 22px', borderRadius:14, background:'transparent',
              border:`1px solid ${a('#FFFFFF','26')}`, color:'#FFFFFF',
              fontFamily:ui, fontSize:14, fontWeight:600, cursor:'pointer' }}>
              <span style={{ display:'grid', placeItems:'center', width:24, height:24, borderRadius:'50%',
                background:a('#FFFFFF','1A') }}>▶</span>
              How It Works
            </button>
          </div>
        </div>

        {/* Stats card */}
        <div style={{ display:'flex', flexDirection:'column', gap:14,
          padding:20, borderRadius:18, minWidth:200,
          background:a('#000000','55'),
          border:`1px solid ${a('#FFFFFF','14')}`,
          backdropFilter:'blur(20px)' }}>
          <StatRow icon="👥" label="Active Debaters" value={stats ? fmt(stats.active_users) : '—'} />
          <div style={{ height:1, background:a('#FFFFFF','0F') }} />
          <StatRow icon="⚡" label="Live Debates" value={stats ? String(stats.live_debates) : '—'} />
          <div style={{ height:1, background:a('#FFFFFF','0F') }} />
          <StatRow icon="🌐" label="Countries" value={stats ? String(stats.countries) : '—'} />
        </div>
      </div>
    </div>
  );
}

function StatRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:14 }}>
      <div style={{ width:34, height:34, borderRadius:10, display:'grid', placeItems:'center',
        background:a(C.cyan,'1A'), fontSize:16 }}>{icon}</div>
      <div>
        <div style={{ fontFamily:ui, fontSize:18, fontWeight:700, color:'#FFFFFF',
          lineHeight:1, fontVariantNumeric:'tabular-nums' }}>{value}</div>
        <div style={{ fontFamily:ui, fontSize:10.5, color:C.faint, marginTop:3,
          textTransform:'uppercase', letterSpacing:'.08em' }}>{label}</div>
      </div>
    </div>
  );
}

// ── ARENA CARD ────────────────────────────────────────────────────────
function ArenaCard({ d, onOpen }: { d: Debate; onOpen: () => void }) {
  const hash = (d.id ?? '').split('').reduce((h, c) => ((h<<5)-h) + c.charCodeAt(0), 0);
  const hue = Math.abs(hash) % 360;
  const fallbackBg = `linear-gradient(135deg, hsl(${hue},65%,28%), hsl(${(hue+60)%360},65%,42%))`;

  // Pseudo prop/opp ratio from id hash for visual interest until real votes show up
  const ratio = 30 + (Math.abs(hash) % 50);

  return (
    <div onClick={onOpen}
      style={{ flexShrink:0, width:300, borderRadius:18, overflow:'hidden',
        background:C.panel, border:`1px solid ${C.hair}`, cursor:'pointer',
        transition:'transform .25s ease, box-shadow .25s ease, border-color .25s ease' }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = `0 20px 50px ${a(C.gold,'2E')}`;
        e.currentTarget.style.borderColor = a(C.gold,'4D');
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.borderColor = C.hair;
      }}>
      {/* Thumbnail */}
      <div style={{ position:'relative', height:160,
        background: d.thumbnail_url ? `url(${d.thumbnail_url}) center/cover` : fallbackBg }}>
        <div style={{ position:'absolute', inset:0,
          background:'linear-gradient(180deg, rgba(0,0,0,0.4) 0%, transparent 30%, transparent 60%, rgba(0,0,0,0.55) 100%)' }} />
        <div style={{ position:'absolute', top:12, left:12, display:'flex', alignItems:'center', gap:5,
          padding:'4px 10px', borderRadius:8, background:C.garnet }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background:'#FFFFFF',
            animation:'pulse 1.5s infinite' }} />
          <span style={{ fontFamily:ui, fontSize:10, fontWeight:800, color:'#FFFFFF', letterSpacing:'.1em' }}>LIVE</span>
        </div>
        <div style={{ position:'absolute', top:12, right:12, display:'flex', alignItems:'center', gap:5,
          padding:'4px 10px', borderRadius:8, background:a('#000000','73'), color:'#FFFFFF',
          fontFamily:ui, fontSize:11, fontWeight:600 }}>
          👁 {fmt(d.viewer_count ?? 0)}
        </div>
        {d.is_paid && d.price_cents > 0 && (
          <div style={{ position:'absolute', bottom:12, left:12, display:'flex', alignItems:'center', gap:5,
            padding:'4px 10px', borderRadius:8, background:a(C.gold,'F2'), color:'#1a1400',
            fontFamily:ui, fontSize:11, fontWeight:800, letterSpacing:'.02em' }}>
            🔒 ${(d.price_cents / 100).toFixed(2)}
          </div>
        )}
      </div>
      {/* Body */}
      <div style={{ padding:'14px 16px 16px' }}>
        <div style={{ fontFamily:display, fontSize:16, fontWeight:700, color:C.ink,
          lineHeight:1.25, height:42, overflow:'hidden',
          display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
          {d.motion}
        </div>
        <div style={{ fontFamily:ui, fontSize:11, fontWeight:600, color:C.faint, marginTop:6,
          textTransform:'uppercase', letterSpacing:'.08em' }}>
          {(d as any).tag ?? d.format ?? 'General'}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:12, fontFamily:mono, fontSize:11 }}>
          <span style={{ color:C.gold, fontWeight:700 }}>{ratio}%</span>
          <div style={{ flex:1, height:5, borderRadius:3, background:C.panel2, overflow:'hidden', display:'flex' }}>
            <div style={{ width:`${ratio}%`, background:C.gold }} />
            <div style={{ flex:1, background:C.garnet }} />
          </div>
          <span style={{ color:C.garnet, fontWeight:700 }}>{100-ratio}%</span>
        </div>
      </div>
    </div>
  );
}

// ── UPCOMING ROW ──────────────────────────────────────────────────────
function UpcomingRow({ d, onOpen }: { d: Debate; onOpen: () => void }) {
  const at = d.scheduled_at ?? d.created_at ?? '';
  return (
    <div onClick={onOpen} style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 8px',
      borderRadius:12, cursor:'pointer', transition:'background .15s ease' }}
      onMouseEnter={e => e.currentTarget.style.background = C.panel2}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      <div style={{ flexShrink:0, width:64, textAlign:'center', padding:'8px 0', borderRadius:10,
        border:`1px solid ${C.hair}`, background:C.panel2 }}>
        <div style={{ fontFamily:ui, fontSize:10, fontWeight:700, color:C.cyan,
          textTransform:'uppercase', letterSpacing:'.1em' }}>{fmtDate(at).split(' ')[0]}</div>
        <div style={{ fontFamily:display, fontSize:22, fontWeight:700, color:C.ink, lineHeight:1 }}>
          {new Date(at).getDate() || '—'}
        </div>
        <div style={{ fontFamily:mono, fontSize:9, color:C.faint, marginTop:2 }}>{fmtTime(at)}</div>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontFamily:ui, fontSize:14, fontWeight:600, color:C.ink,
          whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
          {d.motion}
        </div>
        <div style={{ fontFamily:ui, fontSize:11.5, color:C.faint, marginTop:3 }}>
          {(d as any).tag ?? d.format ?? 'General'} · {fmtRelDay(at)}
        </div>
      </div>
      <button onClick={e => { e.stopPropagation(); alert('Reminder set!'); }}
        style={{ flexShrink:0, padding:'7px 14px', borderRadius:10,
          background:'transparent', border:`1px solid ${C.hair}`,
          color:C.dim, fontFamily:ui, fontSize:12, fontWeight:600, cursor:'pointer',
          display:'flex', alignItems:'center', gap:5 }}>
        🔔 Remind Me
      </button>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────
export function LobbyScreen({ onOpenDebate, onHost: _onHost }: {
  onOpenDebate?: (id: string) => void; onHost?: () => void;
}) {
  const [live, setLive] = useState<Debate[] | null>(null);
  const [upcoming, setUpcoming] = useState<Debate[] | null>(null);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [debaters, setDebaters] = useState<TopDebater[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const isMobile = useIsTablet();

  useEffect(() => {
    let alive = true;
    const pull = () => listLiveDebates().then(d => { if (alive) setLive(d); }).catch(e => { if (alive) setErr(e?.message ?? 'Could not load debates'); });
    pull();
    listUpcomingDebates().then(d => { if (alive) setUpcoming(d); }).catch(() => {});
    getPlatformStats().then(s => { if (alive) setStats(s); }).catch(() => {});
    getTopDebaters(5).then(d => { if (alive) setDebaters(d); }).catch(() => {});
    // Safety-net refresh so a debate going live shows up here without a
    // manual reload — matches the same polling-fallback pattern used
    // throughout the debate room (useDebate, floor_stats, etc).
    const iv = setInterval(pull, 15000);
    return () => { alive = false; clearInterval(iv); };
  }, []);

  const open = (id: string) => onOpenDebate ? onOpenDebate(id) : (window.location.href = `/debate/${id}`);

  return (
    <div style={{ padding: isMobile ? '20px 16px 40px' : '28px 28px 60px',
      display:'flex', flexDirection:'column', gap:24, maxWidth:1400, margin:'0 auto', minWidth:0 }}>

      {err && (
        <div style={{ padding:14, borderRadius:12, background:a(C.garnet,'1A'),
          border:`1px solid ${a(C.garnet,'40')}`, fontFamily:ui, fontSize:13, color:C.garnetHi }}>
          {err}
        </div>
      )}

      {/* HERO */}
      <Hero stats={stats} onExplore={() => document.getElementById('live-arenas')?.scrollIntoView({ behavior:'smooth' })} />

      {/* MAIN GRID: main column + right rail */}
      <div style={{ display:'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 320px',
        gap:24 }}>

        {/* ── LEFT (main) ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:24, minWidth:0 }}>

          {/* LIVE ARENAS */}
          <div id="live-arenas">
            <PanelTitle action="View All Live">LIVE ARENAS</PanelTitle>
            {live === null
              ? <Card><div style={{ fontFamily:ui, fontSize:14, color:C.faint }}>Loading…</div></Card>
              : live.length === 0
                ? <Card><div style={{ fontFamily:ui, fontSize:14, color:C.faint }}>No live debates right now — host one to get started.</div></Card>
                : (
                  <div style={{ display:'flex', gap:14, overflowX:'auto', padding:'4px 2px 14px',
                    scrollSnapType:'x mandatory', scrollbarWidth:'thin' }}>
                    {live.map(d => (
                      <div key={d.id} style={{ scrollSnapAlign:'start' }}>
                        <ArenaCard d={d} onOpen={() => open(d.id)} />
                      </div>
                    ))}
                  </div>
                )}
          </div>

          {/* TWO-COL: Upcoming + Global Activity */}
          <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:20 }}>
            {/* Upcoming */}
            <Card>
              <PanelTitle action="View Calendar">UPCOMING DEBATES</PanelTitle>
              {upcoming === null || upcoming.length === 0 ? (
                <div style={{ fontFamily:ui, fontSize:13, color:C.faint, padding:'14px 8px' }}>
                  No scheduled debates yet.
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                  {upcoming.slice(0, 4).map(d => <UpcomingRow key={d.id} d={d} onOpen={() => open(d.id)} />)}
                </div>
              )}
            </Card>

            {/* Global Activity */}
            <Card>
              <PanelTitle>GLOBAL DEBATE ACTIVITY</PanelTitle>
              <GlobalActivityMap showCaption captionText="Live debate activity" />
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginTop:14,
                paddingTop:14, borderTop:`1px solid ${C.hair}` }}>
                {[
                  { v: stats ? fmt(stats.total_debates) : '—', l:'Debates Today' },
                  { v: stats ? fmt(stats.active_users)  : '—', l:'Active Now' },
                  { v: stats ? String(stats.countries) : '—', l:'Countries' },
                  { v: stats ? fmt(stats.total_votes)  : '—', l:'Votes' },
                ].map(({ v, l }) => (
                  <div key={l} style={{ textAlign:'center' }}>
                    <div style={{ fontFamily:display, fontSize:20, fontWeight:700, color:C.ink,
                      lineHeight:1, fontVariantNumeric:'tabular-nums' }}>{v}</div>
                    <div style={{ fontFamily:ui, fontSize:9.5, color:C.faint, marginTop:4,
                      textTransform:'uppercase', letterSpacing:'.07em' }}>{l}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>

        {/* ── RIGHT RAIL ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:20, minWidth:0 }}>
          {/* Trending Topics */}
          <Card>
            <PanelTitle>TRENDING TOPICS</PanelTitle>
            <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
              {TRENDING.map(t => (
                <div key={t} style={{ display:'flex', alignItems:'center', gap:9, padding:'9px 6px',
                  borderRadius:10, cursor:'pointer', transition:'background .15s ease' }}
                  onMouseEnter={e => e.currentTarget.style.background = C.panel2}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <span style={{ color:C.faint, fontFamily:mono, fontSize:13 }}>#</span>
                  <span style={{ flex:1, fontFamily:ui, fontSize:13, color:C.ink, fontWeight:500 }}>{t}</span>
                  <span style={{ color:C.cyan, fontSize:12 }}>↗</span>
                </div>
              ))}
            </div>
            <button style={{ width:'100%', marginTop:14, padding:'11px', borderRadius:12,
              background:'transparent', border:`1px solid ${C.hair}`, color:C.dim,
              fontFamily:ui, fontSize:12.5, fontWeight:600, cursor:'pointer' }}>
              Explore All Topics
            </button>
          </Card>

          {/* Top Debaters */}
          <Card>
            <PanelTitle>TOP DEBATERS</PanelTitle>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {debaters.length === 0
                ? <div style={{ fontFamily:ui, fontSize:13, color:C.faint }}>Rankings coming soon.</div>
                : debaters.map((u, i) => {
                  const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
                  return (
                    <div key={u.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 4px' }}>
                      <div style={{ width:22, textAlign:'center', fontFamily:mono, fontSize:13,
                        color:C.faint, fontWeight:700 }}>
                        {medal ?? `${i + 1}`}
                      </div>
                      <Avatar url={u.avatar_url} name={u.display_name} size={32} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontFamily:ui, fontSize:13, fontWeight:600, color:C.ink,
                          whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                          {u.display_name}
                        </div>
                        <div style={{ fontFamily:ui, fontSize:10, color:C.faint, marginTop:1 }}>{u.rank}</div>
                      </div>
                      <div style={{ fontFamily:mono, fontSize:12, fontWeight:600, color:C.dim, fontVariantNumeric:'tabular-nums' }}>
                        {fmt(u.wins * 1000)}
                      </div>
                    </div>
                  );
                })}
            </div>
            <button style={{ width:'100%', marginTop:14, padding:'11px', borderRadius:12,
              background:'transparent', border:`1px solid ${C.hair}`, color:C.dim,
              fontFamily:ui, fontSize:12.5, fontWeight:600, cursor:'pointer' }}>
              View Full Leaderboard
            </button>
          </Card>
        </div>
      </div>
    </div>
  );
}
