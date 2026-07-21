// =====================================================================
// The Rostrum · src/lib/useDraggable.ts
// Makes any fixed-position floating element draggable, remembers where the
// user left it (per device), and distinguishes a drag from a click so the
// element still works as a button. Reusable by Gavel, the Bug widget, and
// any custom widget you add later.
//
//   const { pos, onPointerDown, wasDragged } = useDraggable('mywidget', bottomRight(130));
//   <button style={{ position:'fixed', left:pos.x, top:pos.y, touchAction:'none' }}
//     onPointerDown={onPointerDown}
//     onClick={() => { if (!wasDragged()) doThing(); }} />
// =====================================================================
import { useCallback, useRef, useState } from 'react';

export interface DragPos { x: number; y: number }

/** A sensible default: docked to the bottom-right, `w` px wide. */
export const bottomRight = (w = 130, bottomGap = 76): (() => DragPos) => () => ({
  x: Math.max(12, (typeof window !== 'undefined' ? window.innerWidth : 1000) - w),
  y: Math.max(12, (typeof window !== 'undefined' ? window.innerHeight : 800) - bottomGap),
});

export function useDraggable(storageKey: string, fallback: () => DragPos) {
  const [pos, setPos] = useState<DragPos>(() => {
    try {
      const s = localStorage.getItem(storageKey);
      if (s) { const p = JSON.parse(s); if (typeof p?.x === 'number' && typeof p?.y === 'number') return clamp(p); }
    } catch { /* ignore */ }
    return fallback();
  });
  const posRef = useRef(pos);
  const draggedRef = useRef(false);
  const set = (p: DragPos) => { posRef.current = p; setPos(p); };

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== undefined && e.button !== 0) return;   // primary/touch only
    const startX = e.clientX, startY = e.clientY;
    const origX = posRef.current.x, origY = posRef.current.y;
    draggedRef.current = false;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX, dy = ev.clientY - startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) draggedRef.current = true;
      set(clamp({ x: origX + dx, y: origY + dy }));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (draggedRef.current) { try { localStorage.setItem(storageKey, JSON.stringify(posRef.current)); } catch { /* ignore */ } }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, [storageKey]);

  return { pos, onPointerDown, wasDragged: () => draggedRef.current };
}

function clamp(p: DragPos): DragPos {
  const m = 8, w = 120, h = 132;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1000;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  return {
    x: Math.min(Math.max(p.x, m), Math.max(m, vw - w)),
    y: Math.min(Math.max(p.y, m), Math.max(m, vh - h)),
  };
}
