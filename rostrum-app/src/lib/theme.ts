// =====================================================================
// The Rostrum · src/lib/theme.ts
// CSS-variable-backed theme. Every C.* value resolves to a CSS variable,
// so flipping --theme on <html> instantly re-themes the whole app without
// touching any of the ~1,100 existing C.* references across the codebase.
// =====================================================================

// The token names — single source of truth.
const TOKENS = [
  'base','base2','panel','panel2','hair','hairHi',
  'ink','dim','faint','gold','goldHi','ember',
  'jade','jadeHi','garnet','garnetHi',
] as const;
type Token = typeof TOKENS[number];

// Dark palette (the original look).
export const DARK: Record<Token, string> = {
  base:'#0C0B0D', base2:'#141216', panel:'#18151B', panel2:'#1E1A22',
  hair:'rgba(255,255,255,0.07)', hairHi:'rgba(255,255,255,0.14)',
  ink:'#F3EFE7', dim:'#9D968A', faint:'#665F55',
  gold:'#D9B45C', goldHi:'#F1D58A', ember:'#E2503A',
  jade:'#2E9E86', jadeHi:'#4FC2A7', garnet:'#B23A55', garnetHi:'#DA5F7C',
};

// Light palette — warm parchment, tuned so accents still read clearly.
export const LIGHT: Record<Token, string> = {
  base:'#FBF8F2', base2:'#F3EEE3', panel:'#FFFFFF', panel2:'#F6F1E8',
  hair:'rgba(20,16,10,0.10)', hairHi:'rgba(20,16,10,0.20)',
  ink:'#1E1A16', dim:'#5C5346', faint:'#94897A',
  gold:'#9A7B25', goldHi:'#7A5E18', ember:'#C23A24',
  jade:'#1E7A64', jadeHi:'#14624F', garnet:'#9A2840', garnetHi:'#7E1E32',
};

// C proxy — C.gold returns "var(--gold)". Existing code keeps working verbatim.
export const C = TOKENS.reduce((acc, t) => {
  acc[t] = `var(--${t})`;
  return acc;
}, {} as Record<Token, string>);

export type ThemeMode = 'dark' | 'light';

// Apply a theme by writing the CSS variables onto <html>.
export function applyTheme(mode: ThemeMode) {
  if (typeof document === 'undefined') return;
  const palette = mode === 'light' ? LIGHT : DARK;
  const root = document.documentElement;
  for (const t of TOKENS) root.style.setProperty(`--${t}`, palette[t]);
  root.style.setProperty('color-scheme', mode);
  root.setAttribute('data-theme', mode);
}

// Resolve the initial theme: saved choice → system preference → dark.
export function initialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  const saved = localStorage.getItem('rostrum-theme');
  if (saved === 'light' || saved === 'dark') return saved;
  if (window.matchMedia?.('(prefers-color-scheme: light)').matches) return 'light';
  return 'dark';
}

export function saveTheme(mode: ThemeMode) {
  try { localStorage.setItem('rostrum-theme', mode); } catch { /* noop */ }
}

// Alpha helper: turns a CSS-variable color + 2-digit hex alpha into a
// theme-aware translucent color. Replaces the old `${a(C.gold,'18')}` pattern,
// which would produce invalid "var(--gold)18". Uses color-mix so it tracks
// the live theme value of the variable.
export function a(varColor: string, hex2: string): string {
  const pct = Math.round((parseInt(hex2, 16) / 255) * 100);
  return `color-mix(in srgb, ${varColor} ${pct}%, transparent)`;
}

// Fonts (unchanged).
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
