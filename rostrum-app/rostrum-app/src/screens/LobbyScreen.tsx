// =====================================================================
// The Rostrum · src/screens/LobbyScreen.tsx
// The prototype Lobby, wired to listLiveDebates(). Tiles show the uploaded
// thumbnail_url (gradient fallback) and the host joined from profiles.
// =====================================================================
import { useEffect, useState } from 'react';
import { listLiveDebates } from '../lib/api';
import type { Debate } from '../lib/types';
import { C, ui, display, mono, solidGold } from '../lib/theme';

export function LobbyScreen({ onOpenDebate, onHost }: {
  onOpenDebate?: (id: string) => void; onHost?: () => void;
}) {
  const [debates, setDebates] = useState<Debate[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    listLiveDebates().then(setDebates).catch(e => setErr(e?.message ?? 'Could not load debates'));
  }, []);

  return (
    <div style={{ position:'absolute', inset:0, overflowY:'auto', background:C.base }}>
      <div style={{ maxWidth:1120, margin:'0 auto', padding:'24px 24px 70px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:22 }}>
          <h2 style={{ fontFamily:display, fontSize:44, fontWeight:600, color:C.ink, margin:0 }}>Live debates</h2>
          {/* hook this to your CreateDebate route */}
          <button onClick={onHost} style={solidGold}>＋ Host a debate</button>
        </div>

        {err && <p style={{ fontFamily:ui, color:C.garnetHi }}>{err}</p>}
        {!debates && !err && <p style={{ fontFamily:ui, color:C.faint }}>Loading the floor…</p>}
        {debates && debates.length === 0 && (
          <p style={{ fontFamily:ui, color:C.faint }}>No debates live right now — host the first one.</p>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(310px,1fr))', gap:16 }}>
          {debates?.map(d => <Tile key={d.id} d={d} onOpen={() => onOpenDebate?.(d.id)} />)}
        </div>
      </div>
    </div>
  );
}

function Tile({ d, onOpen }: { d: Debate; onOpen?: () => void }) {
  const tone = d.is_paid ? C.garnet : C.jade;
  const host = d.host?.display_name ?? 'Host';
  return (
    <button onClick={onOpen} style={{ textAlign:'left', cursor:'pointer', padding:0, borderRadius:7, overflow:'hidden',
      border:`1px solid ${C.hair}`, background:C.panel }}>
      <div style={{ position:'relative', height:130, overflow:'hidden',
        background: d.thumbnail_url ? '#000' : `linear-gradient(150deg, ${tone}30, ${C.base} 72%)` }}>
        {d.thumbnail_url && <img src={d.thumbnail_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />}
        <div style={{ position:'absolute', inset:0, boxShadow:'inset 0 0 90px 10px rgba(0,0,0,0.6)' }} />
        <span style={{ position:'absolute', top:12, left:12, ...chip(C.ember, true) }}>● {d.status === 'live' ? 'ON AIR' : 'ASSEMBLING'}</span>
        <span style={{ position:'absolute', top:12, right:12, ...chip(d.is_paid ? C.gold : C.jade, true) }}>
          {d.is_paid ? `$${(d.price_cents / 100).toFixed(0)}` : 'Free'}</span>
        <span style={{ position:'absolute', bottom:11, right:13, fontFamily:mono, fontSize:12, color:C.ink }}>
          {d.viewer_count.toLocaleString()} watching</span>
      </div>
      <div style={{ padding:'15px 16px 17px' }}>
        <div style={{ fontFamily:ui, fontSize:11, fontWeight:700, letterSpacing:'.6px', textTransform:'uppercase', color:C.faint }}>
          {formatLabel(d.format)}</div>
        <h3 style={{ fontFamily:display, fontSize:22, lineHeight:1.12, color:C.ink, margin:'7px 0 13px', fontWeight:600 }}>{d.motion}</h3>
        <div style={{ fontFamily:ui, fontSize:13, color:C.dim }}>{host}</div>
      </div>
    </button>
  );
}

const chip = (c: string, solid?: boolean): React.CSSProperties => ({
  display:'inline-flex', alignItems:'center', gap:5, padding:'3px 8px', borderRadius:3, fontFamily:ui,
  fontSize:10, fontWeight:700, letterSpacing:'.6px', color: solid ? C.base : c, background: solid ? c : 'transparent',
});

function formatLabel(f: Debate['format']) {
  return ({ oxford:'Oxford · Formal', cross_exam:'Cross-Examination', lincoln_douglas:'Lincoln–Douglas',
    town_hall:'Town Hall · Open', freestyle:'Freestyle' } as const)[f];
}
