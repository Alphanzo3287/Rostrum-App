// =====================================================================
// The Rostrum · src/screens/NotificationsScreen.tsx
// Full notifications list — the bell dropdown shows a preview of the same
// data; this is the "see everything" page.
// =====================================================================
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listNotifications, markNotificationsRead, type AppNotification } from '../lib/api';
import { C, ui, display, mono } from '../lib/theme';
import { Scroll, Empty, Center } from '../components/ui';

const ICON: Record<string, string> = {
  message: '💬', gift: '🎁', team_invite: '🤝', debate_starting: '🔔', rsvp: '🙋',
};

export function NotificationsScreen() {
  const nav = useNavigate();
  const [items, setItems] = useState<AppNotification[] | null>(null);

  useEffect(() => {
    let alive = true;
    listNotifications().then(n => { if (alive) setItems(n); });
    markNotificationsRead().catch(() => {});
    return () => { alive = false; };
  }, []);

  if (items === null) return <Center>Loading…</Center>;

  return (
    <Scroll title="Notifications" maxWidth={680}>
      {items.length === 0 ? (
        <Empty>You're all caught up.</Empty>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {items.map(n => (
            <button key={n.id} onClick={() => n.link && nav(n.link)} style={{ display:'flex', gap:12,
              alignItems:'flex-start', padding:'14px 16px', borderRadius:14, textAlign:'left', width:'100%',
              cursor: n.link ? 'pointer' : 'default', background: n.read ? C.panel : `${C.gold}0F`,
              border:`1px solid ${n.read ? C.hair : `${C.gold}33`}` }}>
              <span style={{ fontSize:20, flexShrink:0 }}>{ICON[n.type] ?? '📣'}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
                  <span style={{ fontFamily:ui, fontSize:14, fontWeight:700, color:C.ink, flex:1 }}>{n.title}</span>
                  <span style={{ fontFamily:mono, fontSize:10.5, color:C.faint, whiteSpace:'nowrap' }}>{ago(n.created_at)}</span>
                </div>
                {n.body && <div style={{ fontFamily:ui, fontSize:13, color:C.dim, marginTop:3, lineHeight:1.4 }}>{n.body}</div>}
              </div>
            </button>
          ))}
        </div>
      )}
    </Scroll>
  );
}

function ago(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
