// =====================================================================
// The Rostrum · src/components/NavBar.tsx
// Persistent top nav for the non-immersive routes. The chamber renders
// without it (full-bleed broadcast).
// =====================================================================
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { unreadTotal, subscribeInbox } from '../screens/MessagesScreen';
import { C, ui, display, solidGold } from '../lib/theme';
import { Avatar } from './ui';

const LINKS: [string, string][] = [
  ['/', 'Lobby'], ['/leaderboard', 'Leaderboard'], ['/teams', 'Teams'], ['/store', 'Store'],
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
    const off = subscribeInbox(load);
    return () => { on = false; off(); };
  }, []);

  return (
    <header style={{ display:'flex', alignItems:'center', gap:22, padding:'12px 20px',
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
