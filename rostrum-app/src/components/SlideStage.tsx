// =====================================================================
// The Rostrum · src/components/SlideStage.tsx
// The presentation panel, wired. The presenter (any on-mic participant)
// moves the deck forward/backward; everyone else's view follows in real
// time via subscribeSlide. Drop this in place of the prototype SlidePanel.
// =====================================================================
import { useCallback, useEffect, useState } from 'react';
import { getDeck, setSlide, subscribeSlide } from '../lib/api';
import { C, ui, mono } from '../lib/theme';

export function SlideStage({ debateId, canPresent, dim }: {
  debateId: string; canPresent: boolean; dim?: boolean;
}) {
  const [urls, setUrls] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    let alive = true;
    // Re-pull the whole deck (urls + position) on any debate change, so a deck
    // uploaded after this stage mounted shows up live for everyone.
    const refresh = () => getDeck(debateId).then(({ urls, current }) => {
      if (!alive) return;
      setUrls(urls); setIdx(current);
    }).catch(() => {});
    refresh();
    const off = subscribeSlide(debateId, refresh);
    return () => { alive = false; off(); };
  }, [debateId]);

  const go = useCallback(async (d: number) => {
    if (!canPresent || !urls.length) return;
    const next = Math.min(urls.length - 1, Math.max(0, idx + d));
    setIdx(next);                                // optimistic; realtime confirms
    try { await setSlide(debateId, next); } catch { /* server will re-broadcast truth */ }
  }, [canPresent, idx, urls.length, debateId]);

  // arrow keys for the presenter
  useEffect(() => {
    if (!canPresent) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && /input|textarea/i.test(t.tagName)) return;
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canPresent, go]);

  const atStart = idx <= 0, atEnd = idx >= urls.length - 1;

  return (
    <div style={{ position:'absolute', inset:0, background:C.base, opacity: dim ? 0.32 : 1, transition:'opacity .3s' }}>
      {urls.length
        ? <img src={urls[idx]} alt={`slide ${idx + 1}`}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0'; }}
            style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'contain' }} />
        : <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center', color:C.faint, fontFamily:ui, fontSize:13 }}>
            No deck uploaded — share slides from the dock</div>}

      <div style={{ position:'absolute', top:12, left:14, fontFamily:mono, fontSize:11, color:C.faint }}>
        deck · {urls.length ? `${idx + 1} / ${urls.length}` : '—'}
      </div>

      {urls.length > 0 && (
        <div style={{ position:'absolute', bottom:14, right:16, display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontFamily:ui, fontSize:10.5, color: canPresent ? C.jadeHi : C.faint, letterSpacing:'.4px' }}>
            {canPresent ? 'You’re presenting' : 'Presenter controls the deck'}
          </span>
          <NavBtn disabled={!canPresent || atStart} onClick={() => go(-1)} glyph="‹" />
          <NavBtn disabled={!canPresent || atEnd} onClick={() => go(1)} glyph="›" />
        </div>
      )}
    </div>
  );
}

function NavBtn({ disabled, onClick, glyph }: { disabled: boolean; onClick: () => void; glyph: string }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={glyph === '‹' ? 'Previous slide' : 'Next slide'}
      style={{ width:32, height:32, borderRadius:5, border:`1px solid ${C.hair}`, background:'rgba(0,0,0,0.3)',
        color:C.ink, fontSize:18, lineHeight:1, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.35 : 1 }}>
      {glyph}
    </button>
  );
}
