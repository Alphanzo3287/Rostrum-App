// =====================================================================
// The Rostrum · src/components/NavBar.tsx
// Persistent top nav for the non-immersive routes. The chamber renders
// without it (full-bleed broadcast).
// =====================================================================
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { unreadTotal, subscribeInbox } from '../screens/MessagesScreen';
import { C, ui, display, mono, solidGold } from '../lib/theme';
import { Avatar } from './ui';
import { NotificationsBell } from './NotificationsBell';
import { getMyWallet } from '../lib/payments';

const LINKS: [string, string][] = [
  ['/', 'Lobby'], ['/leaderboard', 'Leaderboard'], ['/teams', 'Teams'],
  ['/store', 'Store'], ['/earnings', 'Earnings'], ['/settings', 'Settings'],
];

export function NavBar() {
  const { profile, signOut } = useAuth();
  const { pathname } = useLocation();
  const nav = useNavigate();
  const active = (to: string) => (to === '/' ? pathname === '/' : pathname.startsWith(to));

  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let on = true;
    const load = () => unreadTotal().then(n => { if (on) setUnread(n); }).catch(() => {});
    load();
    const off = subscribeInbox(load);                 // new message arrives → re-count
    window.addEventListener('rostrum:unread', load);   // a thread was read → re-count
    return () => { on = false; off(); window.removeEventListener('rostrum:unread', load); };
  }, []);

  const [dbucks, setDbucks] = useState<number | null>(null);
  useEffect(() => { getMyWallet().then(w => setDbucks(w.total)).catch(() => {}); }, []);

  return (
    <header style={{ position:'relative', zIndex:100, display:'flex', alignItems:'center', gap:22, padding:'12px 20px',
      borderBottom:`1px solid ${C.hair}`, background:'rgba(12,11,13,0.92)', backdropFilter:'blur(8px)' }}>
      <Link to="/" style={{ fontFamily:display, fontSize:21, fontWeight:600, color:C.ink, textDecoration:'none', letterSpacing:'-0.3px' }}>
        The Rostrum
      </Link>
      <nav style={{ display:'flex', gap:4, alignItems:'center' }}>
        {LINKS.map(([to, label]) => (
          <Link key={to} to={to} style={{ textDecoration:'none', padding:'7px 13px', borderRadius:6, fontFamily:ui,
            fontSize:13.5, fontWeight:600, color: active(to) ? C.ink : C.dim, background: active(to) ? C.panel : 'transparent' }}>
            {label}
          </Link>
        ))}
        <Link to="/messages" style={{ textDecoration:'none', padding:'7px 13px', borderRadius:6, fontFamily:ui,
          fontSize:13.5, fontWeight:600, display:'inline-flex', alignItems:'center', gap:7,
          color: active('/messages') ? C.ink : C.dim, background: active('/messages') ? C.panel : 'transparent' }}>
          Messages
          {unread > 0 && <span style={{ background:C.gold, color:C.base, borderRadius:999, minWidth:18, height:18,
            padding:'0 5px', display:'grid', placeItems:'center', fontFamily:ui, fontSize:11, fontWeight:700 }}>{unread}</span>}
        </Link>
      </nav>
      <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:14 }}>
        {dbucks !== null && (
          <button onClick={() => nav('/store')} title="Your D-Bucks" style={{ display:'flex', alignItems:'center',
            gap:6, padding:'5px 11px', borderRadius:999, border:`1px solid ${C.gold}44`,
            background:'rgba(217,180,92,0.08)', cursor:'pointer' }}>
            <span style={{ fontFamily:ui, fontSize:10, color:C.faint, textTransform:'uppercase' }}>D-Bucks</span>
            <span style={{ fontFamily:mono, fontSize:13, fontWeight:700, color:C.gold }}>{dbucks.toLocaleString()}</span>
          </button>
        )}
        <NotificationsBell />
        <button onClick={() => window.dispatchEvent(new Event('rostrum:tour'))} title="Take the tour"
          style={{ width:30, height:30, borderRadius:'50%', border:`1px solid ${C.hair}`, background:'transparent',
            color:C.dim, cursor:'pointer', fontFamily:ui, fontWeight:700, fontSize:14 }}>?</button>
        <button onClick={() => nav('/host')} style={{ ...solidGold, padding:'9px 15px', fontSize:13 }}>＋ Host</button>
        <button onClick={() => nav('/me')} title="Your profile"
          style={{ background:'none', border:'none', cursor:'pointer', padding:0, borderRadius:'50%',
            outline: pathname === '/me' ? `2px solid ${C.gold}` : 'none' }}>
          <Avatar url={profile?.avatar_url} name={profile?.display_name} size={34} />
        </button>
        <button onClick={signOut} style={{ fontFamily:ui, fontSize:12, color:C.faint, background:'none', border:'none', cursor:'pointer' }}>
          Sign out
        </button>
      </div>
    </header>
  );
}
