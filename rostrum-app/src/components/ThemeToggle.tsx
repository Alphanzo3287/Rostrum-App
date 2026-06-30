// =====================================================================
// The Rostrum · src/components/ThemeToggle.tsx
// Sun/moon toggle. Drop anywhere; reads + flips the global theme.
// =====================================================================
import { C, ui } from '../lib/theme';
import { useTheme } from '../lib/themeContext';

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { mode, toggle } = useTheme();
  const isDark = mode === 'dark';

  return (
    <button onClick={toggle} title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label="Toggle theme"
      style={{
        display:'inline-flex', alignItems:'center', gap:7, cursor:'pointer',
        background:'transparent', border:`1px solid ${C.hair}`, borderRadius:999,
        padding: compact ? '6px 8px' : '6px 12px', color:C.dim,
        fontFamily:ui, fontSize:12.5, fontWeight:600, transition:'all .15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = C.hairHi; e.currentTarget.style.color = C.ink; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = C.hair; e.currentTarget.style.color = C.dim; }}>
      <span style={{ fontSize:14, lineHeight:1 }}>{isDark ? '☀️' : '🌙'}</span>
      {!compact && <span>{isDark ? 'Light' : 'Dark'}</span>}
    </button>
  );
}
