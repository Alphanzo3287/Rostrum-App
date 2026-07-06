// =====================================================================
// The Rostrum · src/components/GiftModal.tsx
// A gift picker pre-targeted at ONE recipient — opened from the person
// menu that appears when you hover/tap someone on stage. Replaces the
// old "Gift tab + recipient picker" flow: you already chose who by
// hovering them, so this just shows the tiers. If you can't afford one,
// it becomes a real-money "Buy & Send" in a single step.
// =====================================================================
import { useEffect, useState } from 'react';
import { getMyWallet, getGiftTiers, sendGift, startGiftCheckout, type Wallet, type GiftTier } from '../lib/payments';
import { C, ui, mono, display, a } from '../lib/theme';

export function GiftModal({ debateId, toUserId, toName, onClose }: {
  debateId: string; toUserId: string; toName: string; onClose: () => void;
}) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [tiers, setTiers]   = useState<GiftTier[]>([]);
  const [busy, setBusy]     = useState(false);
  const [sent, setSent]     = useState<string | null>(null);

  useEffect(() => {
    getMyWallet().then(setWallet);
    getGiftTiers().then(setTiers);
  }, []);

  const total = wallet?.total ?? 0;

  async function send(tier: GiftTier) {
    setBusy(true); setSent(null);
    try {
      await sendGift(tier.id, toUserId, debateId);
      setWallet(await getMyWallet());
      setSent(`${tier.icon} ${tier.name} sent to ${toName}!`);
      setTimeout(onClose, 1100);
    } catch (e: any) { alert(e?.message ?? 'Could not send gift'); }
    finally { setBusy(false); }
  }
  async function buyAndSend(tier: GiftTier) {
    setBusy(true);
    try {
      const { url } = await startGiftCheckout(tier.id, toUserId, debateId);
      window.location.href = url;
    } catch (e: any) { alert(e?.message ?? 'Could not start checkout'); setBusy(false); }
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:260, display:'grid', placeItems:'center',
      background:a(C.base,'CC'), backdropFilter:'blur(6px)', padding:20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width:360, maxWidth:'100%', borderRadius:16, background:C.panel, border:`1px solid ${C.hair}`,
        padding:22, boxShadow:'0 20px 60px rgba(0,0,0,.5)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
          <h3 style={{ fontFamily:display, fontSize:18, color:C.ink, margin:0 }}>Send a gift</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.faint, fontSize:20, cursor:'pointer' }}>×</button>
        </div>
        <div style={{ fontFamily:ui, fontSize:12.5, color:C.dim, marginBottom:4 }}>to <span style={{ color:C.ink, fontWeight:600 }}>{toName}</span></div>
        <div style={{ fontFamily:mono, fontSize:12.5, color:C.gold, marginBottom:14 }}>{total.toLocaleString()} D-Bucks in your wallet</div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          {tiers.map(t => {
            const canAfford = total >= t.price_dbucks;
            return (
              <button key={t.id} onClick={() => canAfford ? send(t) : buyAndSend(t)} disabled={busy}
                style={{ padding:'10px 8px', borderRadius:10, border:`1px solid ${canAfford ? C.hair : a(C.gold,'44')}`,
                  background: canAfford ? C.panel2 : a(C.gold,'0D'), cursor: busy ? 'default' : 'pointer', textAlign:'center',
                  opacity: busy ? .6 : 1 }}>
                <div style={{ fontSize:24 }}>{t.icon}</div>
                <div style={{ fontFamily:ui, fontSize:11, fontWeight:600, color:C.ink, marginTop:4 }}>{t.name}</div>
                {canAfford
                  ? <div style={{ fontFamily:mono, fontSize:10, color:C.gold, marginTop:2 }}>{t.price_dbucks.toLocaleString()}</div>
                  : <div style={{ fontFamily:ui, fontSize:9.5, fontWeight:700, color:C.goldHi, marginTop:2 }}>
                      Buy · ${(t.amount_cents / 100).toFixed(2)}</div>}
              </button>
            );
          })}
        </div>

        {sent && <div style={{ fontFamily:ui, fontSize:13, color:C.jadeHi, marginTop:12, textAlign:'center' }}>{sent}</div>}
      </div>
    </div>
  );
}
