// =====================================================================
// The Rostrum · src/components/ProBadge.tsx
// The little gradient "PRO" badge shown next to a Pro member's name.
// =====================================================================
import { C, ui, a } from '../lib/theme';

export function ProBadge({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const sm = size === 'sm';
  return (
    <span title="Rostrum Pro member" style={{
      display: 'inline-flex', alignItems: 'center', gap: sm ? 3 : 4,
      padding: sm ? '2px 7px' : '3px 9px', borderRadius: 999,
      background: `linear-gradient(135deg, ${a(C.gold, '26')}, ${a(C.cyan, '18')})`,
      border: `1px solid ${a(C.gold, '66')}`,
      fontFamily: ui, fontSize: sm ? 9.5 : 10.5, fontWeight: 800, letterSpacing: '.06em',
      color: C.gold, textTransform: 'uppercase', lineHeight: 1, whiteSpace: 'nowrap',
    }}>
      <span style={{ fontSize: sm ? 9 : 10 }}>👑</span>Pro
    </span>
  );
}
