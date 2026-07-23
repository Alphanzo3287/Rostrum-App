// =====================================================================
// The Rostrum · Sidebar.tsx
// Premium left-side navigation matching the 2026 redesign.
// Logo · nav items · live badge · Rostrum Pro card.
// On mobile collapses to a hamburger-driven sheet.
// =====================================================================
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { isPro } from '../lib/pro';
import { unreadTotal, subscribeInbox } from '../screens/MessagesScreen';
import { C, ui, display, mono, solidGold, a } from '../lib/theme';
import { Avatar } from './ui';
import { ThemeToggle } from './ThemeToggle';
import { useIsTablet } from '../lib/useMediaQuery';

// ── Tiny SVG icons (no external dep) ──────────────────────────────────
const Icon = ({ d, size = 18 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}>
    <path d={d} />
  </svg>
);
const HomeIcon = () => <Icon d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />;
const LiveIcon = () => <Icon d="M12 2v3M5 5l2 2M2 12h3M5 19l2-2M12 22v-3M19 19l-2-2M22 12h-3M19 5l-2 2M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />;
const DiscoverIcon = () => <Icon d="M21 21l-4.35-4.35M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z" />;
const CommunityIcon = () => <Icon d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />;
const LibraryIcon = () => <Icon d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />;
const RankingsIcon = () => <Icon d="M3 21h18M5 21V10l4-4 4 4v11M13 21V14l4-4 4 4v7" />;
const BellIcon = () => <Icon d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />;
const MessagesIcon = () => <Icon d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z" />;
const StoreIcon = () => <Icon d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" />;
const AnalyticsIcon = () => <Icon d="M3 3v18h18M7 15l4-4 3 3 5-6" />;
const MenuIcon = () => <Icon d="M3 6h18M3 12h18M3 18h18" size={20} />;
const CloseIcon = () => <Icon d="M18 6L6 18M6 6l12 12" size={20} />;
const TeamsIcon = () => <Icon d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M18 8l1.5 1.5L23 6" />;
const TournamentIcon = () => <Icon d="M6 3h12M6 3v4a6 6 0 0 0 12 0V3M6 3H3v2a4 4 0 0 0 4 4M18 3h3v2a4 4 0 0 1-4 4M9 13h6M12 13v5m-4 4h8" />;
const EarningsIcon = () => <Icon d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />;
const CrownIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M5 16L3 7l5.5 4L12 5l3.5 6L21 7l-2 9H5zm0 2h14v2H5v-2z" />
  </svg>
);

interface NavItem { to: string; label: string; icon: () => JSX.Element; badge?: 'live' | number; }

export function Sidebar() {
  const { profile, signOut } = useAuth();
  const { pathname } = useLocation();
  const nav = useNavigate();
  const isMobile = useIsTablet();
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [pathname]);

  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let on = true;
    const load = () => unreadTotal().then(n => { if (on) setUnread(n); }).catch(() => {});
    load();
    const off = subscribeInbox(load);
    window.addEventListener('rostrum:unread', load);
    return () => { on = false; off(); window.removeEventListener('rostrum:unread', load); };
  }, []);


  const isAdmin = !!(profile as any)?.is_admin;
  const active = (to: string) => to === '/' ? pathname === '/' : pathname.startsWith(to);

  const items: NavItem[] = [
    { to: '/',             label: 'Home',          icon: HomeIcon },
    { to: '/live',         label: 'Live Arenas',   icon: LiveIcon,        badge: 'live' },
    { to: '/discover',     label: 'Discover',      icon: DiscoverIcon },
    { to: '/communities',  label: 'Communities',   icon: CommunityIcon },
    { to: '/teams',        label: 'Teams',         icon: TeamsIcon },
    { to: '/library',      label: 'Library',       icon: LibraryIcon },
    ...(isPro(profile) ? [{ to: '/analytics', label: 'Analytics', icon: AnalyticsIcon }] as NavItem[] : []),
    { to: '/leaderboard',  label: 'Rankings',      icon: RankingsIcon },
    { to: '/messages',     label: 'Messages',      icon: MessagesIcon,    badge: unread || undefined },
  ];

  const sidebarBody = (
    <>
      {/* ── Logo ── */}
      <Link to="/" style={{ display:'flex', alignItems:'center', gap:11, padding:'4px 12px 24px',
        textDecoration:'none', color:C.ink }}>
        <div style={{ width:38, height:38, borderRadius:11, display:'grid', placeItems:'center',
          background:`linear-gradient(135deg, ${C.gold}, ${C.cyan})`,
          boxShadow:`0 8px 24px ${a(C.gold,'4D')}` }}>
          <img src="/logo-icon.png" alt="" style={{ width:24, height:24, objectFit:'contain' }} />
        </div>
        <div style={{ lineHeight:1.05 }}>
          <div style={{ fontFamily:display, fontSize:11, fontWeight:600, color:C.faint,
            letterSpacing:'.16em', textTransform:'uppercase' }}>THE</div>
          <div style={{ fontFamily:display, fontSize:18, fontWeight:700, color:C.ink, letterSpacing:'-.01em' }}>
            ROSTRUM
          </div>
        </div>
      </Link>

      {/* ── Nav ── */}
      <nav style={{ display:'flex', flexDirection:'column', gap:2, padding:'0 6px', flex:'1 1 auto', overflowY:'auto', minHeight:0 }}>
        {items.map(({ to, label, icon: I, badge }) => {
          const on = active(to);
          return (
            <Link key={to} to={to}
              style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 14px', borderRadius:12,
                textDecoration:'none', fontFamily:ui, fontSize:14, fontWeight: on ? 600 : 500,
                color: on ? C.ink : C.dim,
                background: on
                  ? `linear-gradient(135deg, ${a(C.gold,'26')}, ${a(C.cyan,'14')})`
                  : 'transparent',
                border: on ? `1px solid ${a(C.gold,'40')}` : '1px solid transparent',
                boxShadow: on ? `inset 0 1px 0 ${a('#FFFFFF','14')}` : 'none',
                transition:'all .15s ease' }}>
              <span style={{ color: on ? C.gold : C.faint, display:'flex' }}><I /></span>
              <span style={{ flex:1 }}>{label}</span>
              {badge === 'live' && (
                <span style={{ background:C.garnet, color:'#FFFFFF', borderRadius:5, padding:'2px 7px',
                  fontFamily:ui, fontSize:9, fontWeight:800, letterSpacing:'.08em' }}>LIVE</span>
              )}
              {typeof badge === 'number' && badge > 0 && (
                <span style={{ background:C.gold, color:'#FFFFFF', borderRadius:999, minWidth:20, height:20, padding:'0 6px',
                  display:'grid', placeItems:'center', fontFamily:ui, fontSize:11, fontWeight:700 }}>
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
        {/* Tournaments row */}
        <Link to="/tournaments"
          style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 14px', borderRadius:12,
            textDecoration:'none', fontFamily:ui, fontSize:14, fontWeight:500,
            color: active('/tournaments') ? C.ink : C.dim, background:'transparent',
            border:'1px solid transparent', transition:'all .15s ease' }}>
          <span style={{ color: active('/tournaments') ? C.gold : C.faint, display:'flex' }}><TournamentIcon /></span>
          <span style={{ flex:1 }}>Tournaments</span>
        </Link>
      </nav>

      {/* ── Rostrum Pro upsell ── */}
      {isPro(profile) ? (
        <div style={{ margin:'0 12px 14px', padding:'14px 16px', borderRadius:16,
          background: `linear-gradient(160deg, ${a(C.gold,'2E')}, ${a(C.cyan,'12')})`,
          border: `1px solid ${a(C.gold,'40')}`, display:'flex', alignItems:'center', gap:11, cursor:'pointer' }}
          onClick={() => nav('/pro')}>
          <div style={{ width:34, height:34, borderRadius:10, flexShrink:0,
            background: `linear-gradient(135deg, ${C.gold}, ${C.cyan})`,
            display:'grid', placeItems:'center', color:'#FFFFFF' }}>
            <CrownIcon size={18} />
          </div>
          <div>
            <div style={{ fontFamily:display, fontSize:14, fontWeight:700, color:C.ink }}>Pro member</div>
            <div style={{ fontFamily:ui, fontSize:11, color:C.dim }}>Perks active · manage plan</div>
          </div>
        </div>
      ) : (
      <div style={{ margin:'0 12px 14px', padding:'16px 16px 14px', borderRadius:16,
        background: `linear-gradient(160deg, ${a(C.gold,'38')}, ${a(C.cyan,'14')}, ${a(C.gold,'07')})`,
        border: `1px solid ${a(C.gold,'33')}`,
        boxShadow: `0 10px 30px ${a(C.gold,'1F')}`,
        textAlign:'center', position:'relative', overflow:'hidden' }}>
        <div style={{ width:42, height:42, margin:'0 auto 10px', borderRadius:12,
          background: `linear-gradient(135deg, ${C.gold}, ${C.cyan})`,
          display:'grid', placeItems:'center', color:'#FFFFFF',
          boxShadow:`0 6px 20px ${a(C.gold,'4D')}` }}>
          <CrownIcon size={22} />
        </div>
        <div style={{ fontFamily:display, fontSize:16, fontWeight:700, color:C.ink, marginBottom:4 }}>
          Rostrum Pro
        </div>
        <div style={{ fontFamily:ui, fontSize:11.5, color:C.dim, lineHeight:1.4, marginBottom:12 }}>
          Unlock exclusive perks and grow your influence.
        </div>
        <button onClick={() => nav('/pro')}
          style={{ ...solidGold, padding:'8px 14px', fontSize:12, width:'100%', borderRadius:10 }}>
          Upgrade Now
        </button>
      </div>
      )}
    </>
  );

  // ── MOBILE: hamburger top bar + slide-down sheet ──
  if (isMobile) {
    return (
      <>
        <header style={{ position:'sticky', top:0, zIndex:100, display:'flex',
          alignItems:'center', gap:12, padding:'10px 16px',
          borderBottom:`1px solid ${C.hair}`,
          background:a(C.base,'EB'), backdropFilter:'blur(20px)' }}>
          <Link to="/" style={{ display:'flex', alignItems:'center', gap:9, textDecoration:'none' }}>
            <div style={{ width:30, height:30, borderRadius:8, display:'grid', placeItems:'center',
              background:`linear-gradient(135deg, ${C.gold}, ${C.cyan})` }}>
              <img src="/logo-icon.png" alt="" style={{ width:19, height:19, objectFit:'contain' }} />
            </div>
            <span style={{ fontFamily:display, fontSize:17, fontWeight:700, color:C.ink, letterSpacing:'-.01em' }}>
              THE ROSTRUM
            </span>
          </Link>
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
            <button onClick={() => nav('/host')} style={{ ...solidGold, padding:'7px 12px', fontSize:12 }}>＋</button>
            <Link to="/notifications" aria-label="Notifications"
              style={{ width:38, height:38, borderRadius:10, border:`1px solid ${C.hair}`,
                background:'transparent', color: active('/notifications') ? C.gold : C.ink,
                display:'grid', placeItems:'center', textDecoration:'none' }}>
              <BellIcon />
            </Link>
            <button onClick={() => setOpen(o => !o)} aria-label="Menu"
              style={{ width:38, height:38, borderRadius:10, border:`1px solid ${C.hair}`,
                background:'transparent', color:C.ink, cursor:'pointer', display:'grid', placeItems:'center' }}>
              {open ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </header>
        {open && (
          <div style={{ position:'fixed', inset:'56px 0 0 0', zIndex:99, display:'flex', flexDirection:'column',
            background:a(C.base,'F0'), backdropFilter:'blur(20px)', overflowY:'auto', padding:'12px 0' }}>
            {sidebarBody}
            {/* Mobile-only Earnings (desktop uses the TopBar dropdown) */}
            <button onClick={() => nav('/earnings')}
              style={{ display:'flex', alignItems:'center', gap:12, width:'100%', textAlign:'left',
                borderTop:`1px solid ${C.hair}`, padding:'12px 18px', background:'transparent',
                border:'none', cursor:'pointer', fontFamily:ui, fontSize:14, fontWeight:500, color:C.dim }}>
              <span style={{ display:'flex', color:C.faint }}><EarningsIcon /></span> Earnings
            </button>
            {/* Mobile-only Back Office (desktop uses the TopBar dropdown) */}
            {isAdmin && (
              <button onClick={() => nav('/backoffice')}
                style={{ display:'flex', alignItems:'center', gap:10, width:'100%', textAlign:'left',
                  borderTop:`1px solid ${C.hair}`, padding:'13px 18px', background:'transparent',
                  border:'none', cursor:'pointer', fontFamily:ui, fontSize:14, fontWeight:600, color:C.gold }}>
                <span style={{ fontSize:15 }}>🗂️</span> Back Office
              </button>
            )}
            {/* Mobile-only profile + theme + sign out (no TopBar on mobile) */}
            <div style={{ borderTop:`1px solid ${C.hair}`, padding:'14px 18px', display:'flex',
              alignItems:'center', gap:12 }}>
              <button onClick={() => nav('/me')} style={{ display:'flex', alignItems:'center', gap:10,
                background:'none', border:'none', cursor:'pointer', flex:1, minWidth:0, padding:0, textAlign:'left' }}>
                <Avatar url={profile?.avatar_url} name={profile?.display_name} size={36} />
                <div style={{ minWidth:0 }}>
                  <div style={{ fontFamily:ui, fontSize:14, fontWeight:600, color:C.ink,
                    whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                    {profile?.display_name ?? 'You'}
                  </div>
                  <div style={{ fontFamily:ui, fontSize:11, color:C.faint }}>View profile</div>
                </div>
              </button>
              <ThemeToggle compact />
              <button onClick={signOut} title="Sign out"
                style={{ width:36, height:36, borderRadius:9, border:`1px solid ${C.hair}`,
                  background:'transparent', color:C.faint, cursor:'pointer', fontSize:15,
                  display:'grid', placeItems:'center' }}>↪</button>
            </div>
          </div>
        )}
      </>
    );
  }

  // ── DESKTOP: fixed left sidebar ──
  return (
    <aside style={{ width:268, flexShrink:0, height:'100vh', position:'sticky', top:0,
      display:'flex', flexDirection:'column', padding:'18px 0 0',
      background: a(C.base,'CC'),
      borderRight: `1px solid ${C.hair}`,
      backdropFilter:'blur(20px)' }}>
      {sidebarBody}
    </aside>
  );
}
