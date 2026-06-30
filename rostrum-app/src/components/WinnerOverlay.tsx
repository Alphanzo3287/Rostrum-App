// =====================================================================
// The Rostrum · WinnerOverlay.tsx
// Live winner reveal shown to everyone when the host announces.
// Renders on top of the chamber canvas and the broadcast page.
// =====================================================================
import { useEffect, useState } from 'react';
import { C, display, ui, a } from '../lib/theme';

interface Props {
  winnerSide: 'prop' | 'opp' | null;
  winMode: string;
  peoplesChoice?: 'prop' | 'opp' | null;
  propScore?: number;
  oppScore?: number;
  propAudience?: number;
  oppAudience?: number;
}

const sideName = (s: string | null) => s === 'prop' ? 'Proposition' : s === 'opp' ? 'Opposition' : 'Draw';
const sideColor = (s: string | null) => s === 'prop' ? C.jade : s === 'opp' ? C.garnet : C.gold;

export function WinnerOverlay({ winnerSide, winMode, peoplesChoice, propScore, oppScore, propAudience, oppAudience }: Props) {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), 100); return () => clearTimeout(t); }, []);

  return (
    <div style={{
      position:'absolute', inset:0, zIndex:90, display:'grid', placeItems:'center',
      background:a(C.base,'EB'), backdropFilter:'blur(12px)',
      opacity: show ? 1 : 0, transition:'opacity .6s ease',
    }}>
      <div style={{ textAlign:'center', maxWidth:520, padding:32 }}>
        {/* Trophy */}
        <div style={{ fontSize:64, marginBottom:8 }}>🏆</div>

        {/* Main winner */}
        <div style={{ fontFamily:display, fontSize:15, fontWeight:600, color:C.faint,
          textTransform:'uppercase', letterSpacing:'.12em', marginBottom:8 }}>
          {winMode === 'hybrid' ? 'Official Winner' : 'The Winner Is'}
        </div>
        <div style={{ fontFamily:display, fontSize:38, fontWeight:800,
          color: sideColor(winnerSide), lineHeight:1.15, marginBottom:6 }}>
          {sideName(winnerSide)}
        </div>

        {/* Score line */}
        {winMode === 'academic' && propScore != null && oppScore != null && (
          <div style={{ fontFamily:ui, fontSize:16, color:C.dim, marginTop:4 }}>
            Judge score: {propScore} – {oppScore}
          </div>
        )}
        {winMode === 'public' && propAudience != null && oppAudience != null && (
          <div style={{ fontFamily:ui, fontSize:16, color:C.dim, marginTop:4 }}>
            Audience: {propAudience} – {oppAudience}
          </div>
        )}
        {winMode === 'hybrid' && (
          <>
            {propScore != null && oppScore != null && (
              <div style={{ fontFamily:ui, fontSize:14, color:C.dim, marginTop:4 }}>
                Judge score: {propScore} – {oppScore}
              </div>
            )}
            {/* People's Choice */}
            {peoplesChoice && (
              <div style={{ marginTop:24, paddingTop:18, borderTop:`1px solid ${C.hair}` }}>
                <div style={{ fontFamily:display, fontSize:13, fontWeight:600, color:C.faint,
                  textTransform:'uppercase', letterSpacing:'.1em', marginBottom:6 }}>
                  People's Choice
                </div>
                <div style={{ fontFamily:display, fontSize:24, fontWeight:700,
                  color: sideColor(peoplesChoice) }}>
                  {sideName(peoplesChoice)}
                </div>
                {propAudience != null && oppAudience != null && (
                  <div style={{ fontFamily:ui, fontSize:13, color:C.dim, marginTop:2 }}>
                    Audience: {propAudience} – {oppAudience}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
