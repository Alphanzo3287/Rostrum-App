// =====================================================================
// The Rostrum · src/components/NotificationsBell.tsx
// Nav bell + dropdown notification center. Loads the latest notifications,
// streams new ones in real time, badges the unread count, and clears it
// when opened. Each item links into the app.
// =====================================================================
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { listNotifications, markNotificationsRead, subscribeNotifications, type AppNotification } from '../lib/api';
import { C, ui, display, mono } from '../lib/theme';

export function NotificationsBell() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    let on = true;
    listNotifications().then(n => { if (on) setItems(n); }).catch(() => {});
    const off = subscribeNotifications(user.id, (n) =>
      setItems(prev => prev.some(x => x.id === n.id) ? prev : [n, ...prev]));
    return () => { on = false; off(); };
  }, [user?.id]);

  const unread = items.filter(n => !n.read).length;

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      setItems(prev => prev.map(n => ({ ...n, read: true })));   // optimistic
      markNotificationsRead().catch(() => {});
    }
  }
  function openItem(n: AppNotification) {
    setOpen(false);
    if (n.link) nav(n.link);
  }

  if (!user) return null;

  return (
    <div style={{ position:'relative' }}>
      <button onClick={toggle} title="Notifications" style={{ position:'relative', width:30, height:30,
        borderRadius:'50%', border:`1px solid ${C.hair}`, background:'transparent', color:C.dim, cursor:'pointer',
        display:'grid', placeItems:'center' }}>
        <BellGlyph />
        {unread > 0 && (
          <span style={{ position:'absolute', top:-4, right:-4, minWidth:16, height:16, padding:'0 4px',
            borderRadius:8, background:C.ember, color:C.base, fontFamily:mono, fontSize:10, fontWeight:700,
            display:'grid', placeItems:'center', border:`2px solid ${C.base}` }}>{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position:'fixed', inset:0, zIndex:40 }} />
          <div style={{ position:'absolute', top:40, right:0, width:330, maxHeight:430, overflowY:'auto', zIndex:50,
            background:C.panel, border:`1px solid ${C.hairHi}`, borderRadius:12, boxShadow:'0 20px 60px rgba(0,0,0,0.35)' }}>
            <div style={{ padding:'13px 15px', borderBottom:`1px solid ${C.hair}`, position:'sticky', top:0,
              background:C.panel }}>
              <span style={{ fontFamily:display, fontSize:17, color:C.ink }}>Notifications</span>
            </div>
            {items.length === 0
              ? <p style={{ fontFamily:ui, fontSize:12.5, color:C.faint, padding:'22px 15px', textAlign:'center' }}>
                  You're all caught up.</p>
              : items.map(n => (
                <button key={n.id} onClick={() => openItem(n)} style={{ display:'block', width:'100%', textAlign:'left',
                  padding:'12px 15px', background:'transparent', border:'none', borderBottom:`1px solid ${C.hair}`,
                  cursor: n.link ? 'pointer' : 'default' }}>
                  <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
                    <span style={{ fontFamily:ui, fontSize:13, fontWeight:700, color:C.ink, flex:1 }}>{n.title}</span>
                    <span style={{ fontFamily:mono, fontSize:9.5, color:C.faint, whiteSpace:'nowrap' }}>{ago(n.created_at)}</span>
                  </div>
                  {n.body && <div style={{ fontFamily:ui, fontSize:12.5, color:C.dim, lineHeight:1.4, marginTop:3,
                    overflow:'hidden', textOverflow:'ellipsis', display:'-webkit-box', WebkitLineClamp:2,
                    WebkitBoxOrient:'vertical' as any }}>{n.body}</div>}
                </button>
              ))}
          </div>
        </>
      )}
    </div>
  );
}

function ago(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function BellGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}
