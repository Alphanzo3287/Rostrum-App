// =====================================================================
// The Rostrum · src/components/WelcomeTour.tsx
// A first-run guided tour that teaches the core of the platform. Opens
// once for new users (remembered in localStorage) and can be replayed
// anytime via the "?" in the nav (window event 'rostrum:tour').
// =====================================================================
import { useEffect, useState } from 'react';
import { C, ui, display, solidGold } from '../lib/theme';

const KEY = 'rostrum:onboarded:v1';

type Step = { title: string; body: string };
const STEPS: Step[] = [
  { title: 'Welcome to The Rostrum',
    body: 'This is the stage for live, formal debate — real motions, real speaking turns, a real audience. Here’s the 60-second tour.' },
  { title: 'Browse & watch',
    body: 'The Lobby is where debates live. Open any one to drop into the hall as audience — you’ll see the speakers, the clock, the slides, and the room.' },
  { title: 'Host your own',
    body: 'Tap “＋ Host” to set your motion, pick a format, and lay out the run of show. Then invite debaters, a moderator, and judges with one-tap seat links.' },
  { title: 'Inside the chamber',
    body: 'Speakers sit around the floor. The host runs the clock and segments; debaters share their own slide decks; and everyone can use Chat and send questions to the floor.' },
  { title: 'Connect & share',
    body: 'Open anyone’s profile to message them, and use the Share button on any debate to send it out by link, social, or email.' },
  { title: 'You’re ready',
    body: 'Explore the Leaderboard, Teams, and Store from the nav. You can replay this tour anytime from the “?” up top. Now go take the floor.' },
];

export function WelcomeTour() {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);

  useEffect(() => {
    let seen = false;
    try { seen = localStorage.getItem(KEY) === '1'; } catch { /* ignore */ }
    if (!seen) setOpen(true);
    const reopen = () => { setI(0); setOpen(true); };
    window.addEventListener('rostrum:tour', reopen);
    return () => window.removeEventListener('rostrum:tour', reopen);
  }, []);

  function finish() {
    try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ }
    setOpen(false);
  }
  if (!open) return null;
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  return (
    <div style={{ position:'fixed', inset:0, zIndex:1200, background:'rgba(0,0,0,0.66)',
      display:'grid', placeItems:'center', padding:18, backdropFilter:'blur(4px)' }}>
      <div style={{ width:'100%', maxWidth:440, background:C.panel, border:`1px solid ${C.hairHi}`,
        borderRadius:16, padding:'26px 26px 22px', boxShadow:'0 30px 80px rgba(0,0,0,0.65)' }}>
        <div style={{ fontFamily:ui, fontSize:10.5, fontWeight:700, letterSpacing:'2.5px',
          textTransform:'uppercase', color:C.gold, marginBottom:10 }}>
          Tour · {i + 1} of {STEPS.length}
        </div>
        <h2 style={{ fontFamily:display, fontSize:27, color:C.ink, margin:'0 0 10px', lineHeight:1.12 }}>{step.title}</h2>
        <p style={{ fontFamily:ui, fontSize:14.5, color:C.dim, lineHeight:1.55, margin:'0 0 22px' }}>{step.body}</p>

        <div style={{ display:'flex', gap:6, marginBottom:20 }}>
          {STEPS.map((_, k) => (
            <span key={k} style={{ flex:1, height:3, borderRadius:2, background: k <= i ? C.gold : C.hairHi }} />
          ))}
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button onClick={finish} style={{ fontFamily:ui, fontSize:12.5, fontWeight:600, color:C.faint,
            background:'none', border:'none', cursor:'pointer', marginRight:'auto' }}>Skip</button>
          {i > 0 && (
            <button onClick={() => setI(i - 1)} style={{ fontFamily:ui, fontSize:13, fontWeight:700, color:C.ink,
              background:'transparent', border:`1px solid ${C.hairHi}`, borderRadius:6, padding:'9px 16px', cursor:'pointer' }}>Back</button>
          )}
          <button onClick={() => (last ? finish() : setI(i + 1))} style={{ ...solidGold, padding:'10px 20px' }}>
            {last ? 'Take the floor' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
