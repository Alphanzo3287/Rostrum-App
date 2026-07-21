// =====================================================================
// The Rostrum · src/lib/themeContext.tsx
// Tiny theme store: current mode + toggle, persisted to localStorage,
// applied to <html> via CSS variables.
// =====================================================================
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { applyTheme, initialTheme, saveTheme, type ThemeMode } from './theme';

interface ThemeCtx { mode: ThemeMode; toggle: () => void; set: (m: ThemeMode) => void; }
const Ctx = createContext<ThemeCtx>({ mode: 'dark', toggle: () => {}, set: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => initialTheme());

  const set = useCallback((m: ThemeMode) => {
    setMode(m); applyTheme(m); saveTheme(m);
  }, []);
  const toggle = useCallback(() => {
    setMode(prev => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark';
      applyTheme(next); saveTheme(next);
      return next;
    });
  }, []);

  return <Ctx.Provider value={{ mode, toggle, set }}>{children}</Ctx.Provider>;
}

export function useTheme() { return useContext(Ctx); }
