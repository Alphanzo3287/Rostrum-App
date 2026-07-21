// =====================================================================
// The Rostrum · src/components/GiftModal.tsx
// Send a real-money tip directly to a creator (the "Patreon" model).
// No D-Bucks: the payment goes straight to the creator's Stripe account,
// the platform keeps 20%, and Stripe's processing fee comes out of the
// creator's side. A clear breakdown shows exactly where the money goes.
// =====================================================================
import { useEffect, useState } from 'react';
import { getGiftTiers, startGiftCheckout, type GiftTier } from '../lib/payments';
import { C, ui, mono, display, a } from '../lib/theme';

const PLATFORM_PCT = 0.20;
const usd = (c: number) => `$${(c / 100).toFixed(2)}`;
// Stripe US card processing estimate: 2.9% + 30¢.
const estStripe = (c: number) => (c > 0 ? Math.round(c * 0.029 + 30) : 0);

export function GiftModal({ debateId, toUserId, toName, onClose }: {
  debateId: string; toUserId: string; toName: string; onClose: () => void;
}) {
  const [tiers, setTiers] = useState<GiftTier[]>([]);
  const [amount, setAmount] = useState<number>(0);   // selected preset, in cents
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { getGiftTiers().then(setTiers).catch(() => {}); }, []);

  const presets = Array.from(new Set(tiers.map(t => t.amount_cents))).filter(c => c > 0).sort((a, b) => a - b);
  const cents = custom.trim() ? Math.round(parseFloat(custom) * 100) : amount;
  const valid = Number.isFinite(cents) && cents >= 100 && cents <= 50000;

  const platform = Math.round(cents * PLATFORM_PCT);
  const stripe = estStripe(cents);
  const creator = Math.max(0, cents - platform - stripe);

  async function proceed() {
    if (!valid) return;
    setBusy(true);
    try {
      const { url } = await startGiftCheckout(toUserId, { amountCents: cents, debateId });
      window.location.href = url;
    } catch (e: any) { alert(e?.message ?? 'Could not start payment'); setBusy(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 260, display: 'grid', placeItems: 'center',
      background: a(C.base, 'CC'), backdropFilter: 'blur(6px)', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: 380, maxWidth: '100%', borderRadius: 16, background: C.panel, border: `1px solid ${C.hair}`,
        padding: 22, boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <h3 style={{ fontFamily: display, fontSize: 18, color: C.ink, margin: 0 }}>Send a tip</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.faint, fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ fontFamily: ui, fontSize: 12.5, color: C.dim, marginBottom: 16 }}>
          A direct tip to <span style={{ color: C.ink, fontWeight: 600 }}>{toName}</span> — paid straight to their account.
        </div>

        {/* preset amounts */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
          {(presets.length ? presets : [500, 1000, 2000]).map(c => {
            const on = !custom.trim() && amount === c;
            return (
              <button key={c} onClick={() => { setCustom(''); setAmount(c); }}
                style={{ padding: '12px 0', borderRadius: 10, cursor: 'pointer', fontFamily: display, fontSize: 15, fontWeight: 700,
                  color: on ? '#fff' : C.ink, border: `1px solid ${on ? 'transparent' : C.hair}`,
                  background: on ? `linear-gradient(135deg, ${C.gold}, ${C.cyan})` : C.panel2 }}>
                {usd(c)}
              </button>
            );
          })}
        </div>

        {/* custom amount */}
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontFamily: ui, fontSize: 14, color: C.faint }}>$</span>
          <input value={custom} onChange={e => { setCustom(e.target.value.replace(/[^0-9.]/g, '')); setAmount(0); }}
            inputMode="decimal" placeholder="Custom amount"
            style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px 11px 24px', borderRadius: 10,
              background: C.panel2, border: `1px solid ${custom.trim() ? a(C.gold, '55') : C.hair}`, color: C.ink,
              fontFamily: ui, fontSize: 14, outline: 'none' }} />
        </div>

        {/* breakdown */}
        {valid && (
          <div style={{ borderRadius: 12, background: C.panel2, border: `1px solid ${C.hair}`, padding: '12px 14px', marginBottom: 16 }}>
            <Row label={`${toName} receives`} value={`≈ ${usd(creator)}`} strong />
            <Row label="Platform fee (20%)" value={usd(platform)} />
            <Row label="Stripe processing (est.)" value={`≈ ${usd(stripe)}`} last />
            <div style={{ fontFamily: ui, fontSize: 10.5, color: C.faint, marginTop: 8, lineHeight: 1.4 }}>
              Stripe charges a processing fee (about 2.9% + 30¢) that comes out of the creator's portion. Final amounts are confirmed by Stripe at checkout.
            </div>
          </div>
        )}

        <button onClick={proceed} disabled={!valid || busy}
          style={{ width: '100%', padding: '13px', borderRadius: 11, border: 'none', cursor: valid && !busy ? 'pointer' : 'default',
            fontFamily: ui, fontSize: 14, fontWeight: 700, color: '#fff', opacity: valid && !busy ? 1 : 0.5,
            background: `linear-gradient(135deg, ${C.gold}, ${C.cyan})` }}>
          {busy ? 'Redirecting…' : valid ? `Tip ${usd(cents)}` : 'Choose an amount'}
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, strong, last }: { label: string; value: string; strong?: boolean; last?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: last ? 0 : 7 }}>
      <span style={{ fontFamily: ui, fontSize: 12.5, color: strong ? C.ink : C.dim, fontWeight: strong ? 700 : 400 }}>{label}</span>
      <span style={{ fontFamily: mono, fontSize: 12.5, color: strong ? C.jadeHi : C.dim, fontWeight: strong ? 700 : 400 }}>{value}</span>
    </div>
  );
}
