// =====================================================================
// The Rostrum · src/screens/StoreScreen.tsx
// The D-Bucks store: tiered gifts (sendable to creators) + perks.
// Wallet reads from the new dbucks_wallets table (two-color balance).
// =====================================================================
import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { listPerks, myPerkIds, redeemPerk } from '../lib/api';
import { getMyWallet, getGiftTiers, startDbucksCheckout, DBUCKS_PACKAGES, type Wallet, type GiftTier } from '../lib/payments';
import type { Perk } from '../lib/types';
import { C, ui, display, mono, solidGold, a } from '../lib/theme';
import { Scroll, Empty } from '../components/ui';

export function StoreScreen({ onBack }: { onBack?: () => void }) {
  const { refreshProfile } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [gifts, setGifts]   = useState<GiftTier[] | null>(null);
  const [perks, setPerks]   = useState<Perk[] | null>(null);
  const [owned, setOwned]   = useState<string[]>([]);
  const [busy, setBusy]     = useState<string | null>(null);

  useEffect(() => {
    getMyWallet().then(setWallet);
    getGiftTiers().then(setGifts);
    listPerks().then(setPerks);
    myPerkIds().then(setOwned);
  }, []);

  const total = wallet?.total ?? 0;

  async function buyPerk(p: Perk) {
    setBusy(p.id);
    try { await redeemPerk(p.id); setOwned(o => [...o, p.id]); await refreshProfile(); }
    catch (e: any) { alert(e?.message ?? 'Could not redeem'); }
    finally { setBusy(null); }
  }

  async function buyDbucks(packageId: string) {
    setBusy(packageId);
    try {
      const { url } = await startDbucksCheckout(packageId);
      window.location.href = url;
    } catch (e: any) { alert(e?.message ?? 'Could not start checkout'); setBusy(null); }
  }

  return (
    <Scroll title="The Store" onBack={onBack}
      right={
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 14px', borderRadius:999,
          border:`1px solid ${a(C.gold,'55')}`, background:a(C.gold,'14') }}>
          <span style={{ fontFamily:ui, fontSize:11, color:C.faint, textTransform:'uppercase', letterSpacing:'.5px' }}>D-Bucks</span>
          <span style={{ fontFamily:mono, fontSize:16, fontWeight:700, color:C.gold }}>{total.toLocaleString()}</span>
        </div>
      }>

      {/* Wallet breakdown */}
      {wallet && (
        <div style={{ display:'flex', gap:16, marginBottom:22, flexWrap:'wrap' }}>
          <WalletChip label="Spendable" value={wallet.promo} color={C.gold} />
          <WalletChip label="Redeemable" value={wallet.redeemable} color={C.jadeHi} />
        </div>
      )}

      {/* ---- Buy D-Bucks section ---- */}
      <SectionTitle>Buy D-Bucks</SectionTitle>
      <p style={{ fontFamily:ui, fontSize:12.5, color:C.faint, marginBottom:14, lineHeight:1.5 }}>
        Purchased D-Bucks are redeemable — they count toward a creator's real cash-out balance when you gift them.
      </p>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:12, marginBottom:28 }}>
        {DBUCKS_PACKAGES.map(p => (
          <div key={p.id} style={{ padding:'16px 14px', borderRadius:18, border:`1px solid ${C.hair}`,
            background:C.panel, textAlign:'center' }}>
            <div style={{ fontFamily:mono, fontSize:20, fontWeight:800, color:C.jadeHi }}>{p.dbucks.toLocaleString()}</div>
            <div style={{ fontFamily:ui, fontSize:11, color:C.faint, marginTop:2 }}>D-Bucks</div>
            <button onClick={() => buyDbucks(p.id)} disabled={busy === p.id}
              style={{ ...solidGold, width:'100%', marginTop:12, padding:'9px 0', fontSize:13,
                opacity: busy === p.id ? .6 : 1 }}>
              {busy === p.id ? '…' : `$${(p.priceCents / 100).toFixed(2)}`}
            </button>
          </div>
        ))}
      </div>

      {/* ---- Gifts section ---- */}
      <SectionTitle>Gifts</SectionTitle>
      <p style={{ fontFamily:ui, fontSize:12.5, color:C.faint, marginBottom:14, lineHeight:1.5 }}>
        Send gifts to creators you admire during live debates. Gifts transfer D-Bucks from your wallet to theirs.
      </p>
      {!gifts ? <Empty>Loading gifts...</Empty> :
       <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:12, marginBottom:28 }}>
         {gifts.map(g => (
           <div key={g.id} style={{ padding:'16px 14px', borderRadius:18, border:`1px solid ${C.hair}`,
             background:C.panel, textAlign:'center' }}>
             <div style={{ fontSize:32, lineHeight:1.2 }}>{g.icon}</div>
             <div style={{ fontFamily:display, fontSize:15, fontWeight:600, color:C.ink, marginTop:8 }}>{g.name}</div>
             <div style={{ fontFamily:mono, fontSize:13, color:C.gold, marginTop:4 }}>{g.price_dbucks.toLocaleString()} D-Bucks</div>
             <div style={{ fontFamily:ui, fontSize:10.5, color:C.faint, marginTop:2 }}>
               ${(g.price_dbucks / 100).toFixed(2)} value
             </div>
           </div>
         ))}
       </div>
      }

      {/* ---- Perks section ---- */}
      <SectionTitle>Perks</SectionTitle>
      {!perks ? <Empty>Loading perks...</Empty> :
       perks.length === 0 ? <Empty>Perks are being stocked.</Empty> :
       <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(230px,1fr))', gap:14 }}>
         {perks.map(p => {
           const have = owned.includes(p.id);
           const tooPoor = total < p.cost;
           return (
             <div key={p.id} style={{ display:'flex', flexDirection:'column', padding:'18px 18px', borderRadius:12,
               border:`1px solid ${have ? a(C.jade,'66') : C.hair}`, background:C.panel }}>
               <div style={{ fontFamily:ui, fontSize:11, fontWeight:700, letterSpacing:'1.2px',
                 textTransform:'uppercase', color:C.gold }}>{p.icon}</div>
               <div style={{ fontFamily:display, fontSize:19, fontWeight:600, color:C.ink, marginTop:10 }}>{p.name}</div>
               {p.description && <div style={{ fontFamily:ui, fontSize:12.5, color:C.faint, marginTop:5, lineHeight:1.45, flex:1 }}>{p.description}</div>}
               <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:16 }}>
                 <span style={{ fontFamily:mono, fontSize:15, fontWeight:700, color:C.gold }}>{p.cost.toLocaleString()} D-Bucks</span>
                 <button onClick={() => buyPerk(p)} disabled={have || tooPoor || busy === p.id}
                   style={{ marginLeft:'auto', ...solidGold, padding:'9px 14px', fontSize:13,
                     ...(have || tooPoor ? { background:'transparent', color: have ? C.jadeHi : C.faint, border:`1px solid ${C.hair}` } : {}),
                     cursor: have || tooPoor ? 'default' : 'pointer' }}>
                   {have ? 'Owned' : busy === p.id ? '...' : tooPoor ? 'Not enough' : 'Redeem'}
                 </button>
               </div>
             </div>
           );
         })}
       </div>}
    </Scroll>
  );
}

function WalletChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 12px', borderRadius:999,
      border:`1px solid ${color}44`, background:`${color}0a` }}>
      <span style={{ fontFamily:ui, fontSize:10.5, color:C.faint, textTransform:'uppercase' }}>{label}</span>
      <span style={{ fontFamily:mono, fontSize:14, fontWeight:600, color }}>{value.toLocaleString()}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ fontFamily:display, fontSize:17, fontWeight:700, color:C.ink, margin:'0 0 8px',
      letterSpacing:'-0.2px', textTransform:'uppercase' }}>{children}</h3>
  );
}
