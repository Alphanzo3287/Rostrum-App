// =====================================================================
// The Rostrum · src/components/ui.tsx
// Small shared pieces for Profile / Leaderboard / Teams / Store.
// =====================================================================
import { C, ui, display, mono } from '../lib/theme';

export function Avatar({ url, name, size = 44 }: { url?: string | null; name?: string; size?: number }) {
  const initial = (name ?? '?').trim().charAt(0).toUpperCase();
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', overflow:'hidden', flexShrink:0,
      display:'grid', placeItems:'center', background:C.panel2, border:`1px solid ${C.hair}`,
      color:C.dim, fontFamily:display, fontSize:size * 0.42 }}>
      {url ? <img src={url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : initial}
    </div>
  );
}

export function RankBadge({ rank, level }: { rank: string; level: number }) {
  return <span style={{ fontFamily:ui, fontSize:11, fontWeight:700, letterSpacing:'.5px', color:C.gold,
    border:`1px solid ${C.gold}55`, borderRadius:999, padding:'3px 10px', whiteSpace:'nowrap' }}>{rank} · Lv {level}</span>;
}

export function Stat({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div>
      <div style={{ fontFamily:mono, fontSize:22, fontWeight:700, color: color ?? C.ink }}>{value}</div>
      <div style={{ fontFamily:ui, fontSize:11, color:C.faint, letterSpacing:'.5px', textTransform:'uppercase' }}>{label}</div>
    </div>
  );
}

export function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section style={{ marginTop:28 }}>
      <div style={{ display:'flex', alignItems:'center', marginBottom:14 }}>
        <h3 style={{ fontFamily:display, fontSize:22, fontWeight:600, color:C.ink, margin:0 }}>{title}</h3>
        <div style={{ marginLeft:'auto' }}>{right}</div>
      </div>
      {children}
    </section>
  );
}

export function Scroll({ title, onBack, right, children, maxWidth = 920 }: {
  title: string; onBack?: () => void; right?: React.ReactNode; children: React.ReactNode; maxWidth?: number;
}) {
  return (
    <div style={{ position:'absolute', inset:0, overflowY:'auto', background:C.base }}>
      <div style={{ maxWidth, margin:'0 auto', padding:'24px 24px 90px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
          {onBack && <button onClick={onBack} style={iconBtn}>‹</button>}
          <h2 style={{ fontFamily:display, fontSize:30, fontWeight:600, color:C.ink, margin:0 }}>{title}</h2>
          <div style={{ marginLeft:'auto' }}>{right}</div>
        </div>
        {children}
      </div>
    </div>
  );
}

export const Center = ({ children }: { children: React.ReactNode }) =>
  <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center', background:C.base,
    color:C.dim, fontFamily:ui, fontSize:14 }}>{children}</div>;

export const Empty = ({ children }: { children: React.ReactNode }) =>
  <div style={{ padding:'26px 20px', borderRadius:10, border:`1px dashed ${C.hairHi}`, textAlign:'center',
    fontFamily:ui, fontSize:13, color:C.faint }}>{children}</div>;

export const pill: React.CSSProperties = { padding:'5px 11px', borderRadius:999, fontFamily:ui, fontSize:12,
  fontWeight:600, color:C.dim, background:C.panel, border:`1px solid ${C.hair}` };
export const ghostBtn: React.CSSProperties = { display:'inline-flex', alignItems:'center', gap:7, padding:'10px 16px',
  borderRadius:6, border:`1px solid ${C.hairHi}`, background:'transparent', color:C.ink, fontFamily:ui,
  fontSize:13, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' };
export const iconBtn: React.CSSProperties = { width:32, height:32, borderRadius:5, border:`1px solid ${C.hair}`,
  background:'rgba(0,0,0,0.25)', color:C.dim, cursor:'pointer', fontSize:16, lineHeight:1 };

export function hrefFor(network: string, value: string) {
  if (/^https?:\/\//.test(value)) return value;
  const v = value.replace(/^@/, '');
  switch (network) {
    case 'instagram': return `https://instagram.com/${v}`;
    case 'x': return `https://x.com/${v}`;
    case 'tiktok': return `https://tiktok.com/@${v}`;
    case 'youtube': return `https://youtube.com/@${v}`;
    default: return `https://${v}`;
  }
}
