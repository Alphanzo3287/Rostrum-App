// =====================================================================
// The Rostrum · src/components/NavBar.tsx
// Persistent top nav for the non-immersive routes. The chamber renders
// without it (full-bleed broadcast).
// =====================================================================
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { unreadTotal, subscribeInbox } from '../screens/MessagesScreen';
import { C, ui, display, mono, solidGold, a } from '../lib/theme';
import { Avatar } from './ui';
import { NotificationsBell } from './NotificationsBell';
import { ThemeToggle } from './ThemeToggle';
import { useIsMobile } from '../lib/useMediaQuery';
import { getMyWallet } from '../lib/payments';

const LINKS: [string, string][] = [
  ['/', 'Lobby'], ['/leaderboard', 'Leaderboard'], ['/teams', 'Teams'],
  ['/store', 'Store'], ['/earnings', 'Earnings'], ['/support', 'Help'], ['/settings', 'Settings'],
];

export function NavBar() {
  const { profile, signOut } = useAuth();
  const { pathname } = useLocation();
  const nav = useNavigate();
  const active = (to: string) => (to === '/' ? pathname === '/' : pathname.startsWith(to));
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile menu whenever the route changes.
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let on = true;
    const load = () => unreadTotal().then(n => { if (on) setUnread(n); }).catch(() => {});
    load();
    const off = subscribeInbox(load);
    window.addEventListener('rostrum:unread', load);
    return () => { on = false; off(); window.removeEventListener('rostrum:unread', load); };
  }, []);

  const [dbucks, setDbucks] = useState<number | null>(null);
  useEffect(() => { getMyWallet().then(w => setDbucks(w.total)).catch(() => {}); }, []);

  const isAdmin = !!(profile as any)?.is_admin;
  const allLinks: [string, string][] = [
    ...LINKS,
    ['/messages', 'Messages'],
    ...(isAdmin ? ([['/admin','Analytics'],['/moderation','Mod']] as [string,string][]) : []),
  ];

  // ── MOBILE: brand + hamburger, with a slide-down sheet ──
  if (isMobile) {
    return (
      <header style={{ position:'relative', zIndex:100, display:'flex', alignItems:'center', gap:12,
        padding:'10px 16px', borderBottom:`1px solid ${C.hair}`,
        background:a(C.base,'EE'), backdropFilter:'blur(8px)' }}>
        <Link to="/" style={{ fontFamily:display, fontSize:18, fontWeight:600, color:C.ink, textDecoration:'none' }}>
          The Rostrum
        </Link>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:10 }}>
          <button onClick={() => nav('/host')} style={{ ...solidGold, padding:'7px 12px', fontSize:12 }}>＋</button>
          <NotificationsBell />
          <button onClick={() => setMenuOpen(o => !o)} aria-label="Menu"
            style={{ width:36, height:36, borderRadius:8, border:`1px solid ${C.hair}`, background:'transparent',
              color:C.ink, cursor:'pointer', fontSize:18, display:'grid', placeItems:'center' }}>
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>

        {menuOpen && (
          <div style={{ position:'absolute', top:'100%', left:0, right:0, background:C.panel,
            borderBottom:`1px solid ${C.hair}`, boxShadow:'0 12px 32px rgba(0,0,0,0.3)',
            display:'flex', flexDirection:'column', padding:'8px 12px 14px', gap:2 }}>
            {/* profile row */}
            <button onClick={() => nav('/me')} style={{ display:'flex', alignItems:'center', gap:10,
              padding:'10px 8px', background:'none', border:'none', cursor:'pointer', textAlign:'left' }}>
              <Avatar url={profile?.avatar_url} name={profile?.display_name} size={34} />
              <div>
                <div style={{ fontFamily:ui, fontSize:14, fontWeight:700, color:C.ink }}>{profile?.display_name ?? 'You'}</div>
                <div style={{ fontFamily:ui, fontSize:11, color:C.faint }}>View profile</div>
              </div>
              {dbucks !== null && (
                <span style={{ marginLeft:'auto', fontFamily:mono, fontSize:13, fontWeight:700, color:C.gold }}>
                  {dbucks.toLocaleString()} <span style={{ fontSize:9, color:C.faint }}>D-BUCKS</span>
                </span>
              )}
            </button>
            <div style={{ height:1, background:C.hair, margin:'4px 0' }} />
            {allLinks.map(([to, label]) => (
              <Link key={to} to={to} style={{ textDecoration:'none', padding:'11px 8px', borderRadius:8,
                fontFamily:ui, fontSize:15, fontWeight:600, display:'flex', alignItems:'center', gap:8,
                color: active(to) ? C.ink : C.dim, background: active(to) ? C.panel2 : 'transparent' }}>
                {label}
                {to === '/messages' && unread > 0 && (
                  <span style={{ background:C.gold, color:C.base, borderRadius:999, minWidth:18, height:18,
                    padding:'0 5px', display:'grid', placeItems:'center', fontSize:11, fontWeight:700 }}>{unread}</span>
                )}
              </Link>
            ))}
            <div style={{ height:1, background:C.hair, margin:'4px 0' }} />
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 8px' }}>
              <ThemeToggle />
              <button onClick={signOut} style={{ fontFamily:ui, fontSize:13, color:C.faint,
                background:'none', border:`1px solid ${C.hair}`, borderRadius:8, padding:'7px 14px', cursor:'pointer' }}>
                Sign out
              </button>
            </div>
          </div>
        )}
      </header>
    );
  }

  // ── DESKTOP / TABLET ──
  return (
    <header style={{ position:'relative', zIndex:100, display:'flex', alignItems:'center', gap:22, padding:'12px 20px',
      borderBottom:`1px solid ${C.hair}`, background:a(C.base,'EE'), backdropFilter:'blur(8px)' }}>
      <Link to="/" style={{ fontFamily:display, fontSize:21, fontWeight:600, color:C.ink, textDecoration:'none', letterSpacing:'-0.3px' }}>
        The Rostrum
      </Link>
      <nav style={{ display:'flex', gap:4, alignItems:'center', flexWrap:'wrap' }}>
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
            gap:6, padding:'5px 11px', borderRadius:999, border:`1px solid ${a(C.gold,'44')}`,
            background:a(C.gold,'14'), cursor:'pointer' }}>
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
        {isAdmin && (
          <button onClick={() => nav('/admin')}
            style={{ fontFamily:ui, fontSize:12, color: pathname==='/admin' ? C.gold : C.faint,
              background:'none', border:'none', cursor:'pointer', fontWeight: pathname==='/admin'?700:400 }}>
            Analytics
          </button>
        )}
        {isAdmin && (
          <button onClick={() => nav('/moderation')}
            style={{ fontFamily:ui, fontSize:12, color: pathname==='/moderation' ? C.garnet : C.faint,
              background:'none', border:'none', cursor:'pointer', fontWeight: pathname==='/moderation'?700:400 }}>
            Mod
          </button>
        )}
        <ThemeToggle compact />
        <button onClick={signOut} style={{ fontFamily:ui, fontSize:12, color:C.faint, background:'none', border:'none', cursor:'pointer' }}>
          Sign out
        </button>
      </div>
    </header>
  );
}
