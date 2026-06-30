// =====================================================================
// The Rostrum · TopBar.tsx
// Top navigation strip that pairs with the left Sidebar:
// search · Create Debate · notifications · profile.
// Hidden on mobile (the Sidebar's hamburger header takes over there).
// =====================================================================
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { C, ui, solidGold, a } from '../lib/theme';
import { Avatar } from './ui';
import { NotificationsBell } from './NotificationsBell';
import { useIsTablet } from '../lib/useMediaQuery';

export function TopBar() {
  const { profile, signOut } = useAuth();
  const nav = useNavigate();
  const isMobile = useIsTablet();
  const [menuOpen, setMenuOpen] = useState(false);
  const [q, setQ] = useState('');

  // On mobile the Sidebar renders its own header bar, so skip this.
  if (isMobile) return null;

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim()) nav(`/discover?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <header style={{ display:'flex', alignItems:'center', gap:18, padding:'14px 28px',
      borderBottom:`1px solid ${C.hair}`, background:a(C.base,'CC'),
      backdropFilter:'blur(20px)', position:'sticky', top:0, zIndex:50 }}>

      {/* Search */}
      <form onSubmit={submitSearch} style={{ flex:1, maxWidth:560, position:'relative' }}>
        <span style={{ position:'absolute', left:16, top:'50%', transform:'translateY(-50%)',
          color:C.faint, fontSize:15, pointerEvents:'none' }}>⌕</span>
        <input value={q} onChange={e => setQ(e.target.value)}
          placeholder="Search debates, topics, creators..."
          style={{ width:'100%', padding:'11px 44px', borderRadius:999,
            background:C.glass, border:`1px solid ${C.hair}`,
            color:C.ink, fontFamily:ui, fontSize:13.5, outline:'none',
            transition:'border-color .15s ease' }}
          onFocus={e => e.currentTarget.style.borderColor = a(C.gold,'66')}
          onBlur={e => e.currentTarget.style.borderColor = C.hair} />
        <span style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)',
          color:C.faint, fontFamily:'monospace', fontSize:12, border:`1px solid ${C.hair}`,
          borderRadius:6, padding:'1px 7px', pointerEvents:'none' }}>/</span>
      </form>

      {/* Right cluster */}
      <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:14 }}>
        <button onClick={() => nav('/host')}
          style={{ ...solidGold, padding:'10px 18px', fontSize:13.5, borderRadius:12 }}>
          + Create Debate
        </button>

        <NotificationsBell />

        {/* Profile dropdown */}
        <div style={{ position:'relative' }}>
          <button onClick={() => setMenuOpen(o => !o)}
            style={{ display:'flex', alignItems:'center', gap:10, padding:'4px 6px 4px 10px',
              borderRadius:999, border:`1px solid ${C.hair}`, background:'transparent',
              cursor:'pointer' }}>
            <div style={{ textAlign:'right', lineHeight:1.2 }}>
              <div style={{ fontFamily:ui, fontSize:13, fontWeight:600, color:C.ink,
                maxWidth:130, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {profile?.display_name ?? 'You'}
              </div>
              <div style={{ fontFamily:ui, fontSize:10.5, color:C.faint }}>
                {(profile as any)?.rank ?? 'Debater'}
              </div>
            </div>
            <Avatar url={profile?.avatar_url} name={profile?.display_name} size={36} />
            <span style={{ color:C.faint, fontSize:11 }}>▾</span>
          </button>

          {menuOpen && (
            <>
              <div onClick={() => setMenuOpen(false)}
                style={{ position:'fixed', inset:0, zIndex:60 }} />
              <div style={{ position:'absolute', top:'calc(100% + 8px)', right:0, zIndex:61,
                width:200, borderRadius:14, background:C.panel,
                border:`1px solid ${C.hair}`, boxShadow:'0 20px 50px rgba(0,0,0,0.4)',
                padding:6, display:'flex', flexDirection:'column' }}>
                {[
                  { label:'My Profile', to:'/me' },
                  { label:'Wallet',     to:'/store' },
                  { label:'Settings',   to:'/settings' },
                  { label:'Help',       to:'/support' },
                ].map(i => (
                  <button key={i.to} onClick={() => { setMenuOpen(false); nav(i.to); }}
                    style={{ textAlign:'left', padding:'10px 12px', borderRadius:9,
                      background:'transparent', border:'none', cursor:'pointer',
                      fontFamily:ui, fontSize:13, color:C.dim, transition:'all .12s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = C.panel2; e.currentTarget.style.color = C.ink; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.dim; }}>
                    {i.label}
                  </button>
                ))}
                <div style={{ height:1, background:C.hair, margin:'4px 0' }} />
                <button onClick={() => { setMenuOpen(false); signOut(); }}
                  style={{ textAlign:'left', padding:'10px 12px', borderRadius:9,
                    background:'transparent', border:'none', cursor:'pointer',
                    fontFamily:ui, fontSize:13, color:C.garnet }}
                  onMouseEnter={e => e.currentTarget.style.background = a(C.garnet,'14')}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
