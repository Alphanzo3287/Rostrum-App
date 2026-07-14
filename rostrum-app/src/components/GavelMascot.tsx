// =====================================================================
// The Rostrum · src/components/GavelMascot.tsx
// The Gavel character. Art is SEPARATE from the widget (per the design):
// swap the files in GAVEL_ART and the mascot updates everywhere. Until you
// add the PNGs, a clean fallback renders so nothing looks broken.
//
// To use your artwork, drop transparent PNGs into  public/gavel/  named:
//   gavel-avatar.png · gavel-idle.png · gavel-thinking.png ·
//   gavel-happy.png · gavel-unsure.png · gavel-error.png · gavel-wave.png
// (or point GAVEL_ART at wherever you host them).
// =====================================================================
import { useState } from 'react';
import { C, a } from '../lib/theme';

export type MascotState = 'avatar' | 'idle' | 'thinking' | 'happy' | 'unsure' | 'error' | 'wave';

export const GAVEL_ART: Record<MascotState, string> = {
  avatar:   '/gavel/gavel-avatar.png',
  idle:     '/gavel/gavel-idle.png',
  thinking: '/gavel/gavel-thinking.png',
  happy:    '/gavel/gavel-happy.png',
  unsure:   '/gavel/gavel-unsure.png',
  error:    '/gavel/gavel-error.png',
  wave:     '/gavel/gavel-wave.png',
};

// Inject subtle animations once.
if (typeof document !== 'undefined' && !document.getElementById('gavel-kf')) {
  const s = document.createElement('style');
  s.id = 'gavel-kf';
  s.textContent =
    '@keyframes gavelFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}' +
    '@keyframes gavelPulse{0%,100%{opacity:.55}50%{opacity:1}}' +
    '@keyframes gavelBounce{0%{transform:translateY(0)}25%{transform:translateY(-12px)}45%{transform:translateY(0)}62%{transform:translateY(-6px)}80%{transform:translateY(0)}100%{transform:translateY(0)}}';
  document.head.appendChild(s);
}

export function GavelMascot({ state = 'idle', size = 48, float = false }: {
  state?: MascotState; size?: number; float?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const anim = float ? 'gavelFloat 3.2s ease-in-out infinite' : (state === 'thinking' ? 'gavelPulse 1.4s ease-in-out infinite' : 'none');

  if (failed) return <FallbackGavel size={size} anim={anim} />;
  return (
    <img src={GAVEL_ART[state] ?? GAVEL_ART.idle} alt="Gavel" width={size} height={size}
      onError={() => setFailed(true)}
      style={{ width: size, height: size, objectFit: 'contain', animation: anim, display: 'block' }} />
  );
}

/** Clean placeholder used until the real artwork is added. */
function FallbackGavel({ size, anim }: { size: number; anim: string }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', display: 'grid', placeItems: 'center', animation: anim,
      background: `linear-gradient(135deg, ${C.gold}, ${C.cyan})`, color: '#fff', flexShrink: 0 }}>
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 13l-7.5 7.5a2.12 2.12 0 0 1-3-3L11 10" />
        <path d="M9.5 8.5l6 6M14 6l4 4M17.5 9.5l3-3-4-4-3 3M16 20h6" />
      </svg>
    </div>
  );
}

export const gavelRing = (size: number) => ({
  width: size, height: size, borderRadius: '50%', padding: 2, flexShrink: 0,
  background: `linear-gradient(135deg, ${a('#8B5CF6', 'FF')}, ${a(C.cyan, 'FF')})`,
  display: 'grid', placeItems: 'center',
});
