// =====================================================================
// The Rostrum · src/lib/theme.ts
// The tokens lifted from the prototype so wired screens share one look.
// =====================================================================
export const C = {
  base:'#0C0B0D', base2:'#141216', panel:'#18151B', panel2:'#1E1A22',
  hair:'rgba(255,255,255,0.07)', hairHi:'rgba(255,255,255,0.14)',
  ink:'#F3EFE7', dim:'#9D968A', faint:'#665F55',
  gold:'#D9B45C', goldHi:'#F1D58A', ember:'#E2503A',
  jade:'#2E9E86', jadeHi:'#4FC2A7', garnet:'#B23A55', garnetHi:'#DA5F7C',
};
export const ui = "'Hanken Grotesk', system-ui, sans-serif";
export const display = "'Fraunces', Georgia, serif";
export const mono = "'JetBrains Mono', ui-monospace, monospace";

export const solidGold: React.CSSProperties = {
  display:'inline-flex', alignItems:'center', justifyContent:'center', gap:7, padding:'11px 16px',
  border:'none', borderRadius:5, cursor:'pointer', fontFamily:ui, fontWeight:700, fontSize:14,
  color:C.base, background:`linear-gradient(180deg, ${C.goldHi}, ${C.gold})`,
};
export const field: React.CSSProperties = {
  width:'100%', padding:'11px 13px', borderRadius:5, background:C.base,
  border:`1px solid ${C.hair}`, color:C.ink, fontFamily:ui, fontSize:14, outline:'none',
};
