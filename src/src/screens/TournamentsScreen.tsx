// =====================================================================
// The Rostrum · src/screens/TournamentsScreen.tsx
// Placeholder for the Tournaments feature (replaces the Notifications
// sidebar slot per request). There's no tournament backend yet — brackets,
// registration, and multi-round scheduling are a real feature to design,
// not something to fake with placeholder data. This is an honest "on the
// roadmap" page, matching the existing Rostrum Pro coming-soon pattern.
// =====================================================================
import { C, ui, display, a, solidGold } from '../lib/theme';
import { Scroll } from '../components/ui';

export function TournamentsScreen({ onBack }: { onBack?: () => void }) {
  return (
    <Scroll title="Tournaments" onBack={onBack} maxWidth={720}>
      <div style={{ textAlign:'center', padding:'56px 24px', borderRadius:20,
        background:C.panel, border:`1px solid ${C.hair}` }}>
        <div style={{ width:64, height:64, margin:'0 auto 18px', borderRadius:16, display:'grid', placeItems:'center',
          background:`linear-gradient(135deg, ${C.gold}, ${C.cyan})`, boxShadow:`0 10px 30px ${a(C.gold,'4D')}` }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 3h12M6 3v4a6 6 0 0 0 12 0V3M6 3H3v2a4 4 0 0 0 4 4M18 3h3v2a4 4 0 0 1-4 4M9 13h6M12 13v5m-4 4h8" />
          </svg>
        </div>
        <h2 style={{ fontFamily:display, fontSize:26, fontWeight:700, color:C.ink, margin:'0 0 10px' }}>
          Bracketed tournaments are coming
        </h2>
        <p style={{ fontFamily:ui, fontSize:14.5, color:C.dim, lineHeight:1.6, maxWidth:460, margin:'0 auto 24px' }}>
          Multi-round brackets, team registration, and scheduled elimination rounds are on the
          roadmap. We didn't want to ship a page full of fake matchups in the meantime —
          this space is reserved for when it's real.
        </p>
        <button onClick={() => alert('Thanks — we\'ll let you know when tournaments launch!')} style={solidGold}>
          Notify me when it's ready
        </button>
      </div>
    </Scroll>
  );
}
