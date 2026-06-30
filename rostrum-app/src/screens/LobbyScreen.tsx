// =====================================================================
// The Rostrum · src/screens/LobbyScreen.tsx
// Discovery: Live now + Upcoming. Tiles show the thumbnail (gradient
// fallback) and the host joined from profiles. Unlisted/private debates
// never appear here — the lobby lists public only.
// =====================================================================
import { useEffect, useState } from 'react';
import { listLiveDebates, listUpcomingDebates } from '../lib/api';
import type { Debate } from '../lib/types';
import { C, ui, display, mono, solidGold, a } from '../lib/theme';

export function LobbyScreen({ onOpenDebate, onHost }: {
  onOpenDebate?: (id: string) => void; onHost?: () => void;
}) {
  const [live, setLive] = useState<Debate[] | null>(null);
  const [soon, setSoon] = useState<Debate[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => {
      listLiveDebates().then(d => { if (alive) setLive(d); }).catch(e => { if (alive) setErr(e?.message ?? 'Could not load debates'); });
      listUpcomingDebates().then(d => { if (alive) setSoon(d); }).catch(() => { if (alive) setSoon([]); });
    };
    load();
    // Auto-refresh so newly-opened rooms appear without a manual reload.
    const iv = setInterval(load, 15000);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => { alive = false; clearInterval(iv); window.removeEventListener('focus', onFocus); };
  }, []);

  const hasLive = !!live?.length;
  const hasSoon = !!soon?.length;

  return (
    <div style={{ position:'absolute', inset:0, overflowY:'auto', background:C.base }}>
      <div style={{ maxWidth:1120, margin:'0 auto', padding:'24px 24px 70px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:26 }}>
          <h2 style={{ fontFamily:display, fontSize:44, fontWeight:600, color:C.ink, margin:0 }}>The floor</h2>
          <button onClick={onHost} style={solidGold}>＋ Host a debate</button>
        </div>

        {err && <p style={{ fontFamily:ui, color:C.garnetHi }}>{err}</p>}
        {!live && !err && <p style={{ fontFamily:ui, color:C.faint }}>Loading the floor…</p>}

        {/* LIVE NOW */}
        {live && (
          <section style={{ marginBottom:38 }}>
            <SectionHead dot={C.ember} label="Live now" count={live.length} />
            {hasLive
              ? <Grid>{live.map(d => <LiveTile key={d.id} d={d} onOpen={() => onOpenDebate?.(d.id)} />)}</Grid>
              : <Quiet>No debates live this minute{hasSoon ? ' — see what’s coming up below.' : ' — host the first one.'}</Quiet>}
          </section>
        )}

        {/* UPCOMING */}
        {hasSoon && (
          <section>
            <SectionHead dot={C.gold} label="Upcoming" count={soon!.length} />
            <Grid>{soon!.map(d => <ScheduledTile key={d.id} d={d} onOpen={() => onOpenDebate?.(d.id)} />)}</Grid>
          </section>
        )}
      </div>
    </div>
  );
}

/* ---- layout atoms ---- */
function Grid({ children }: { children: React.ReactNode }) {
  return <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(310px,1fr))', gap:16 }}>{children}</div>;
}
function SectionHead({ dot, label, count }: { dot: string; label: string; count: number }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:15 }}>
      <span style={{ width:9, height:9, borderRadius:'50%', background:dot, boxShadow:`0 0 10px ${dot}` }} />
      <h3 style={{ fontFamily:ui, fontSize:13, fontWeight:700, letterSpacing:'2px', textTransform:'uppercase', color:C.ink, margin:0 }}>{label}</h3>
      <span style={{ fontFamily:mono, fontSize:12, color:C.faint }}>{count}</span>
    </div>
  );
}
function Quiet({ children }: { children: React.ReactNode }) {
  return <p style={{ fontFamily:ui, fontSize:14, color:C.faint, padding:'6px 0' }}>{children}</p>;
}

/* ---- tiles ---- */
function LiveTile({ d, onOpen }: { d: Debate; onOpen?: () => void }) {
  const tone = d.is_paid ? C.garnet : C.jade;
  return (
    <button onClick={onOpen} style={tileBtn}>
      <div style={{ ...cover, background: d.thumbnail_url ? '#000' : `linear-gradient(150deg, ${tone}30, ${C.base} 72%)` }}>
        {d.thumbnail_url && <img src={d.thumbnail_url} alt="" style={coverImg} />}
        <div style={coverShade} />
        <span style={{ position:'absolute', top:12, left:12, ...chip(C.ember, true) }}>● {d.status === 'live' ? 'ON AIR' : 'ASSEMBLING'}</span>
        <span style={{ position:'absolute', top:12, right:12, ...chip(d.is_paid ? C.gold : C.jade, true) }}>
          {d.is_paid ? `$${(d.price_cents / 100).toFixed(0)}` : 'Free'}</span>
        <span style={{ position:'absolute', bottom:11, right:13, fontFamily:mono, fontSize:12, color:C.ink }}>
          {d.viewer_count.toLocaleString()} watching</span>
      </div>
      <Body d={d} />
    </button>
  );
}

function ScheduledTile({ d, onOpen }: { d: Debate; onOpen?: () => void }) {
  return (
    <button onClick={onOpen} style={tileBtn}>
      <div style={{ ...cover, background: d.thumbnail_url ? '#000' : `linear-gradient(150deg, ${a(C.gold,'26')}, ${C.base} 75%)` }}>
        {d.thumbnail_url && <img src={d.thumbnail_url} alt="" style={coverImg} />}
        <div style={coverShade} />
        <span style={{ position:'absolute', top:12, left:12, ...chip(C.gold, true) }}>SCHEDULED</span>
        <span style={{ position:'absolute', top:12, right:12, ...chip(d.is_paid ? C.gold : C.jade, true) }}>
          {d.is_paid ? `$${(d.price_cents / 100).toFixed(0)}` : 'Free'}</span>
        <span style={{ position:'absolute', bottom:11, right:13, fontFamily:mono, fontSize:12.5, color:C.goldHi, fontWeight:700 }}>
          {whenLabel(d.scheduled_at)}</span>
      </div>
      <Body d={d} />
    </button>
  );
}

function Body({ d }: { d: Debate }) {
  return (
    <div style={{ padding:'15px 16px 17px' }}>
      <div style={{ fontFamily:ui, fontSize:11, fontWeight:700, letterSpacing:'.6px', textTransform:'uppercase', color:C.faint }}>
        {formatLabel(d.format)}</div>
      <h3 style={{ fontFamily:display, fontSize:22, lineHeight:1.12, color:C.ink, margin:'7px 0 13px', fontWeight:600 }}>{d.motion}</h3>
      <div style={{ fontFamily:ui, fontSize:13, color:C.dim }}>{d.host?.display_name ?? 'Host'}</div>
    </div>
  );
}

/* ---- helpers ---- */
const tileBtn: React.CSSProperties = { textAlign:'left', cursor:'pointer', padding:0, borderRadius:7,
  overflow:'hidden', border:`1px solid ${C.hair}`, background:C.panel };
const cover: React.CSSProperties = { position:'relative', height:130, overflow:'hidden' };
const coverImg: React.CSSProperties = { width:'100%', height:'100%', objectFit:'cover' };
const coverShade: React.CSSProperties = { position:'absolute', inset:0, boxShadow:'inset 0 0 90px 10px rgba(0,0,0,0.6)' };

const chip = (c: string, solid?: boolean): React.CSSProperties => ({
  display:'inline-flex', alignItems:'center', gap:5, padding:'3px 8px', borderRadius:3, fontFamily:ui,
  fontSize:10, fontWeight:700, letterSpacing:'.6px', color: solid ? C.base : c, background: solid ? c : 'transparent',
});

function whenLabel(iso: string | null) {
  if (!iso) return 'soon';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'now';
  const mins = Math.round(ms / 60000), hrs = Math.round(ms / 3600000), days = Math.round(ms / 86400000);
  if (mins < 60) return `in ${mins}m`;
  if (hrs < 24) return `in ${hrs}h`;
  if (days <= 7) return `in ${days}d`;
  return new Date(iso).toLocaleDateString([], { month:'short', day:'numeric' });
}
function formatLabel(f: Debate['format']) {
  return ({ oxford:'Oxford · Formal', cross_exam:'Cross-Examination', lincoln_douglas:'Lincoln–Douglas',
    town_hall:'Town Hall · Open', freestyle:'Freestyle' } as const)[f];
}
