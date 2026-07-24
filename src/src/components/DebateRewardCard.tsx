// =====================================================================
// The Rostrum · src/components/DebateRewardCard.tsx
// Celebratory end-of-debate summary: XP earned, progress to next level,
// level-ups, and any milestone rewards. Shown once, then dismissed.
// =====================================================================
import type { DebateReward } from '../lib/rewards';
import { C, ui, display, mono, a, solidGold } from '../lib/theme';

export function DebateRewardCard({ reward, onContinue }: { reward: DebateReward; onContinue: () => void }) {
  const span = Math.max(1, reward.next_level_xp - reward.level_floor_xp);
  const pct = Math.min(100, Math.max(0, Math.round(((reward.current_xp - reward.level_floor_xp) / span) * 100)));
  const toNext = Math.max(0, reward.next_level_xp - reward.current_xp);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1300, background: a(C.base, 'D8'),
      display: 'grid', placeItems: 'center', padding: 18, backdropFilter: 'blur(6px)' }}>
      <div style={{ width: '100%', maxWidth: 400, background: C.panel, border: `1px solid ${C.hairHi}`,
        borderRadius: 20, padding: '30px 28px 24px', textAlign: 'center',
        boxShadow: '0 30px 90px rgba(0,0,0,0.6)' }}>

        <div style={{ fontFamily: ui, fontSize: 11, fontWeight: 800, letterSpacing: '.14em',
          textTransform: 'uppercase', color: C.gold, marginBottom: 14 }}>Debate complete</div>

        {/* XP earned */}
        <div style={{ fontFamily: display, fontSize: 46, fontWeight: 800, lineHeight: 1,
          background: `linear-gradient(135deg, ${C.gold}, ${C.cyan})`, WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
          +{reward.xp_awarded.toLocaleString()}
        </div>
        <div style={{ fontFamily: ui, fontSize: 13, fontWeight: 700, color: C.dim, marginTop: 4, letterSpacing: '.05em' }}>XP EARNED</div>

        {/* level-up banner */}
        {reward.leveled_up && (
          <div style={{ margin: '18px 0 4px', padding: '11px 14px', borderRadius: 12,
            background: a(C.gold, '14'), border: `1px solid ${a(C.gold, '4D')}` }}>
            <span style={{ fontFamily: display, fontSize: 15, fontWeight: 700, color: C.ink }}>
              🎉 Level {reward.old_level} → {reward.new_level}
            </span>
          </div>
        )}

        {/* progress to next level */}
        <div style={{ marginTop: 20, textAlign: 'left' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: ui, fontSize: 11.5,
            color: C.faint, marginBottom: 6 }}>
            <span>Level {reward.new_level}</span>
            <span>{toNext.toLocaleString()} XP to Level {reward.new_level + 1}</span>
          </div>
          <div style={{ height: 9, borderRadius: 999, background: C.panel2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999,
              background: `linear-gradient(90deg, ${C.gold}, ${C.cyan})`, transition: 'width .6s ease' }} />
          </div>
        </div>

        {/* milestone rewards */}
        {reward.milestones.length > 0 && (
          <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {reward.milestones.map((m, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 13px', borderRadius: 10, background: a(C.jade, '10'), border: `1px solid ${a(C.jade, '3A')}` }}>
                <span style={{ fontFamily: ui, fontSize: 12.5, color: C.ink }}>🏆 Level {m.level} badge</span>
                <span style={{ fontFamily: ui, fontSize: 11.5, fontWeight: 700, color: C.jadeHi }}>Unlocked</span>
              </div>
            ))}
          </div>
        )}

        <button onClick={onContinue} style={{ ...solidGold, width: '100%', marginTop: 24, padding: '12px' }}>
          Continue
        </button>
      </div>
    </div>
  );
}
