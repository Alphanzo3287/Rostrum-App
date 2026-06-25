// =====================================================================
// The Rostrum · src/screens/StoreScreen.tsx
// Spend virtual cash on perks. redeem_perk (server RPC) checks the balance
// and debits atomically; we refresh the wallet from useAuth afterward.
// =====================================================================
import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { listPerks, myPerkIds, redeemPerk } from '../lib/api';
import type { Perk } from '../lib/types';
import { C, ui, display, mono, solidGold } from '../lib/theme';
import { Scroll, Empty } from '../components/ui';

export function StoreScreen({ onBack }: { onBack?: () => void }) {
  const { profile: me, refreshProfile } = useAuth();
  const [perks, setPerks] = useState<Perk[] | null>(null);
  const [owned, setOwned] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => { listPerks().then(setPerks); myPerkIds().then(setOwned); }, []);
  const cash = me?.virtual_cash ?? 0;

  async function buy(p: Perk) {
    setBusy(p.id);
    try { await redeemPerk(p.id); setOwned(o => [...o, p.id]); await refreshProfile(); }
    catch (e: any) { alert(e?.message ?? 'Could not redeem'); }
    finally { setBusy(null); }
  }

  return (
    <Scroll title="The store" onBack={onBack}
      right={<div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px', borderRadius:999,
        border:`1px solid ${C.gold}55`, background:'rgba(217,180,92,0.08)' }}>
        <span style={{ fontFamily:ui, fontSize:11, color:C.faint, textTransform:'uppercase', letterSpacing:'.5px' }}>Wallet</span>
        <span style={{ fontFamily:mono, fontSize:16, fontWeight:700, color:C.gold }}>◈ {cash.toLocaleString()}</span>
      </div>}>

      {!perks ? <Empty>Loading the shelves…</Empty> :
       perks.length === 0 ? <Empty>The store is being stocked.</Empty> :
       <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(230px,1fr))', gap:14 }}>
         {perks.map(p => {
           const have = owned.includes(p.id);
           const tooPoor = cash < p.cost;
           return (
             <div key={p.id} style={{ display:'flex', flexDirection:'column', padding:'18px 18px', borderRadius:12,
               border:`1px solid ${have ? C.jade + '66' : C.hair}`, background:C.panel }}>
               <div style={{ fontFamily:ui, fontSize:11, fontWeight:700, letterSpacing:'1.2px',
                 textTransform:'uppercase', color:C.gold }}>{p.icon}</div>
               <div style={{ fontFamily:display, fontSize:19, fontWeight:600, color:C.ink, marginTop:10 }}>{p.name}</div>
               {p.description && <div style={{ fontFamily:ui, fontSize:12.5, color:C.faint, marginTop:5, lineHeight:1.45, flex:1 }}>{p.description}</div>}
               <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:16 }}>
                 <span style={{ fontFamily:mono, fontSize:15, fontWeight:700, color:C.gold }}>◈ {p.cost.toLocaleString()}</span>
                 <button onClick={() => buy(p)} disabled={have || tooPoor || busy === p.id}
                   style={{ marginLeft:'auto', ...solidGold, padding:'9px 14px', fontSize:13,
                     ...(have || tooPoor ? { background:'transparent', color: have ? C.jadeHi : C.faint, border:`1px solid ${C.hair}` } : {}),
                     cursor: have || tooPoor ? 'default' : 'pointer' }}>
                   {have ? 'Owned ✓' : busy === p.id ? '…' : tooPoor ? 'Not enough' : 'Redeem'}
                 </button>
               </div>
             </div>
           );
         })}
       </div>}
    </Scroll>
  );
}
