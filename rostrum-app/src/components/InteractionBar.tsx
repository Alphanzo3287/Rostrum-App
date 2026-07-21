// =====================================================================
// The Rostrum · src/components/InteractionBar.tsx
// Batch C4 — Audience Interaction Bar (concept panel 5).
// Every reaction here is ephemeral (see lib/reactions.ts) except the
// wallet balance, which reads the real getMyWallet() RPC already used by
// GiftPanel. "Question" opens the existing, real Q&A tab rather than
// inventing a second question system.
// =====================================================================
import { useEffect, useState } from 'react';
import type { Room } from 'livekit-client';
import { useReactions, type ReactionKind } from '../lib/reactions';
import { getMyWallet } from '../lib/payments';
import { C, ui, a } from '../lib/theme';

const EMOJI_CHOICES = ['🔥', '💯', '🤔', '😂', '👏'];

export function InteractionBar({ room, identity, name, onAskQuestion }: {
  room: Room | null; identity: string; name: string; onAskQuestion?: () => void;
}) {
  const { toasts, raisedHands, iRaised, send, toggleHand } = useReactions(room, identity, name);
  const [pickerOpen, setPickerOpen] = useState(false);

  const handCount = raisedHands.size;

  return (
    // position:relative so the toast overlay below (position:absolute) is
    // contained here and can never escape to cover the rest of the page —
    // the exact trap the C3 hotfix fixed elsewhere in this codebase.
    <div style={{ position: 'relative', borderRadius: 16, padding: '10px 14px',
      background: C.panel, border: `1px solid ${C.hair}`,
      display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>

      {/* floating reaction toasts — contained within this bar's own box */}
      {toasts.length > 0 && (
        <div aria-hidden style={{ position: 'absolute', left: 10, right: 10, bottom: '100%', marginBottom: 8,
          display: 'flex', gap: 6, flexWrap: 'wrap', pointerEvents: 'none' }}>
          {toasts.map(t => (
            <span key={t.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px',
              borderRadius: 999, background: a(C.base, 'D9'), border: `1px solid ${C.hairHi}`,
              fontFamily: ui, fontSize: 12, color: C.ink, animation: 'reactionFloat 3.2s ease-out forwards' }}>
              <span>{reactionEmoji(t.type, t.emoji)}</span>
              <span style={{ color: C.dim }}>{t.name}</span>
            </span>
          ))}
        </div>
      )}

      <ReactBtn active={iRaised} label={iRaised ? 'Lower hand' : 'Raise Hand'} icon="✋" onClick={toggleHand}
        badge={handCount > 0 ? handCount : undefined} />
      <ReactBtn label="Agree" icon="👍" onClick={() => send('agree')} accent={C.jadeHi} />
      <ReactBtn label="Disagree" icon="👎" onClick={() => send('disagree')} accent={C.garnetHi} />
      <ReactBtn label="Clap" icon="👏" onClick={() => send('clap')} accent={C.warning} />
      {onAskQuestion && <ReactBtn label="Question" icon="❓" onClick={onAskQuestion} />}

      <div style={{ position: 'relative' }}>
        <ReactBtn label="React" icon="😊" onClick={() => setPickerOpen(v => !v)} active={pickerOpen} />
        {pickerOpen && (
          <div style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: 8, zIndex: 5,
            display: 'flex', gap: 4, padding: 6, borderRadius: 12, background: C.panel2, border: `1px solid ${C.hair}` }}>
            {EMOJI_CHOICES.map(e => (
              <button key={e} onClick={() => { send('emoji', e); setPickerOpen(false); }}
                style={{ border: 'none', background: 'transparent', fontSize: 18, cursor: 'pointer', padding: 4 }}>{e}</button>
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes reactionFloat { 0% { opacity:0; transform:translateY(6px);} 12% { opacity:1; transform:translateY(0);} 78% { opacity:1; } 100% { opacity:0; transform:translateY(-10px);} }`}</style>
    </div>
  );
}

function reactionEmoji(type: ReactionKind, emoji?: string) {
  if (type === 'emoji') return emoji ?? '💬';
  if (type === 'agree') return '👍';
  if (type === 'disagree') return '👎';
  if (type === 'clap') return '👏';
  return '💬';
}

function ReactBtn({ label, icon, onClick, active, accent, badge }: {
  label: string; icon: string; onClick: () => void; active?: boolean; accent?: string; badge?: number;
}) {
  return (
    <button onClick={onClick} title={label} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '7px 12px', borderRadius: 999, cursor: 'pointer', fontFamily: ui, fontSize: 12.5, fontWeight: 600,
      color: active ? (accent ?? C.goldHi) : C.dim,
      background: active ? a(accent ?? C.gold, '1A') : C.glass,
      border: `1px solid ${active ? a(accent ?? C.gold, '55') : C.hair}` }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <span>{label}</span>
      {!!badge && (
        <span style={{ position: 'absolute', top: -6, right: -6, minWidth: 16, height: 16, padding: '0 4px',
          borderRadius: 999, background: C.garnet, color: '#fff', fontSize: 9.5, fontWeight: 800,
          display: 'grid', placeItems: 'center' }}>{badge}</span>
      )}
    </button>
  );
}
