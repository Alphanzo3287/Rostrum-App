// =====================================================================
// The Rostrum · src/lib/theme.ts
// CSS-variable-backed theme with the 2026 redesign palette.
// Existing C.gold / C.jade / C.garnet calls keep working — they now
// resolve to the new royal-blue / emerald / coral palette.
// =====================================================================

// Token names — single source of truth.
const TOKENS = [
  'base','base2','panel','panel2','glass','hair','hairHi',
  'ink','dim','faint',
  // brand & accents (kept under legacy names for back-compat)
  'gold','goldHi',          // PRIMARY — royal blue
  'cyan','cyanHi',          // SECONDARY — electric cyan
  'jade','jadeHi',          // SUCCESS — emerald
  'warning','warningHi',    // WARNING — amber gold
  'garnet','garnetHi','ember', // DANGER — coral
] as const;
type Token = typeof TOKENS[number];

// DARK palette (the design's primary look).
export const DARK: Record<Token, string> = {
  base: '#090B10',
  base2: '#0D1118',
  panel: '#11151C',
  panel2: '#161B25',
  glass: 'rgba(255,255,255,0.05)',
  hair: 'rgba(255,255,255,0.08)',
  hairHi: 'rgba(255,255,255,0.14)',
  ink: '#FFFFFF',
  dim: '#B7C0CE',
  faint: '#7D8898',
  gold: '#4F7CFF',        // royal blue (was warm gold)
  goldHi: '#7194FF',
  cyan: '#49D6FF',
  cyanHi: '#7BE1FF',
  jade: '#00C98D',        // emerald
  jadeHi: '#3FDDA8',
  warning: '#F4B740',     // amber gold
  warningHi: '#FBC766',
  garnet: '#FF5B6A',      // danger coral
  garnetHi: '#FF7E8A',
  ember: '#FF5B6A',
};

// LIGHT palette — refined, premium, not just "inverted dark".
export const LIGHT: Record<Token, string> = {
  base: '#F7F8FB',
  base2: '#EEF1F6',
  panel: '#FFFFFF',
  panel2: '#F2F4F9',
  glass: 'rgba(15,20,30,0.04)',
  hair: 'rgba(15,20,30,0.10)',
  hairHi: 'rgba(15,20,30,0.18)',
  ink: '#0A0E16',
  dim: '#4A5366',
  faint: '#7D8898',
  gold: '#2B5BFF',
  goldHi: '#1841E0',
  cyan: '#0EA5C9',
  cyanHi: '#0888A8',
  jade: '#00956A',
  jadeHi: '#007553',
  warning: '#C68800',
  warningHi: '#A06D00',
  garnet: '#D63A4A',
  garnetHi: '#B11E2D',
  ember: '#D63A4A',
};

// C proxy — C.gold returns "var(--gold)". Existing code keeps working verbatim.
export const C = TOKENS.reduce((acc, t) => {
  acc[t] = `var(--${t})`;
  return acc;
}, {} as Record<Token, string>);

export type ThemeMode = 'dark' | 'light';

export function applyTheme(mode: ThemeMode) {
  if (typeof document === 'undefined') return;
  const palette = mode === 'light' ? LIGHT : DARK;
  const root = document.documentElement;
  for (const t of TOKENS) root.style.setProperty(`--${t}`, palette[t]);
  root.style.setProperty('color-scheme', mode);
  root.setAttribute('data-theme', mode);
}

export function initialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  const saved = localStorage.getItem('rostrum-theme');
  if (saved === 'light' || saved === 'dark') return saved;
  // Dark by default. A user's explicit choice is saved to localStorage and
  // persists across logins on this browser; we intentionally do NOT follow the
  // OS light/dark preference so the platform opens dark for everyone first.
  return 'dark';
}

export function saveTheme(mode: ThemeMode) {
  try { localStorage.setItem('rostrum-theme', mode); } catch { /* noop */ }
}

// Alpha helper: ${C.gold}18 → a(C.gold, '18') → theme-tracking translucent.
export function a(varColor: string, hex2: string): string {
  const pct = Math.round((parseInt(hex2, 16) / 255) * 100);
  return `color-mix(in srgb, ${varColor} ${pct}%, transparent)`;
}

// ── Fonts ─────────────────────────────────────────────────────────────
export const ui      = "'Inter', system-ui, -apple-system, sans-serif";
export const display = "'Fraunces', Georgia, serif";
export const mono    = "'JetBrains Mono', ui-monospace, monospace";

// ── Component primitives ──────────────────────────────────────────────
// solidGold is the historical name kept so existing buttons re-skin
// automatically. It now produces a royal-blue → cyan gradient.
export const solidGold: React.CSSProperties = {
  display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8,
  padding:'12px 20px', border:'none', borderRadius:14, cursor:'pointer',
  fontFamily:ui, fontWeight:600, fontSize:14, color:'#FFFFFF',
  background:`linear-gradient(135deg, ${C.gold}, ${C.cyan})`,
  boxShadow: `0 8px 30px ${a(C.gold,'66')}, inset 0 1px 0 rgba(255,255,255,0.2)`,
  transition: 'transform .2s ease, box-shadow .2s ease',
};
// Alias for clarity in new code.
export const solidPrimary = solidGold;

// Ghost / outline button.
export const ghostBtn: React.CSSProperties = {
  display:'inline-flex', alignItems:'center', justifyContent:'center', gap:7,
  padding:'10px 18px', borderRadius:14, cursor:'pointer',
  fontFamily:ui, fontWeight:600, fontSize:13, color: C.ink,
  background: 'transparent', border: `1px solid ${C.hair}`,
  transition: 'all .15s ease',
};

// Input field.
export const field: React.CSSProperties = {
  width:'100%', padding:'12px 14px', borderRadius:12,
  background: C.glass, border:`1px solid ${C.hair}`,
  color:C.ink, fontFamily:ui, fontSize:14, outline:'none',
  transition: 'border-color .15s ease, background .15s ease',
};

// Card / surface primitives.
export const card: React.CSSProperties = {
  background: C.panel,
  border: `1px solid ${C.hair}`,
  borderRadius: 20,
};
export const glass: React.CSSProperties = {
  background: C.glass,
  border: `1px solid ${C.hair}`,
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderRadius: 20,
};
