// =====================================================================
// The Rostrum · src/screens/MessagesScreen.tsx
// Direct messages: a 1:1 inbox and a live conversation thread. Data access
// lives here too (kept in one file to keep deploys small). A debate invite
// link pasted into a message renders as a tappable "Join on stage" card.
// =====================================================================
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getProfile } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { Profile } from '../lib/types';
import { C, ui, display, mono, solidGold, field } from '../lib/theme';
import { Avatar, Scroll, Empty, iconBtn } from '../components/ui';

/* ----------------------------- data ------------------------------ */
export interface ConversationSummary {
  id: string; other_id: string; handle: string; display_name: string;
  avatar_url: string | null; last_preview: string | null; last_message_at: string; unread: number;
}
export interface DMessage {
  id: string; conversation_id: string; sender_id: string; body: string; created_at: string;
}

export async function listConversations(): Promise<ConversationSummary[]> {
  const { data, error } = await supabase.rpc('list_my_conversations');
  if (error) throw error;
  return (data ?? []) as ConversationSummary[];
}
export async function openConversation(otherId: string): Promise<string> {
  const { data, error } = await supabase.rpc('open_conversation', { p_other: otherId });
  if (error) throw error;
  return data as string;
}
export async function getMessages(cid: string): Promise<DMessage[]> {
  const { data, error } = await supabase.from('messages').select('*')
    .eq('conversation_id', cid).order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as DMessage[];
}
export async function sendMessage(cid: string, body: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('not signed in');
  const text = body.trim();
  if (!text) return;
  const { error } = await supabase.from('messages').insert({ conversation_id: cid, sender_id: user.id, body: text });
  if (error) throw error;
}
export async function markRead(cid: string): Promise<void> { await supabase.rpc('mark_read', { p_convo: cid }); }
export async function unreadTotal(): Promise<number> {
  const { data } = await supabase.rpc('unread_total');
  return (data as number) ?? 0;
}
export function subscribeMessages(cid: string, onInsert: (m: DMessage) => void) {
  const ch = supabase.channel(`messages:${cid}`)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${cid}` },
      (p: any) => onInsert(p.new as DMessage))
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
export function subscribeInbox(onChange: () => void) {
  const ch = supabase.channel('inbox')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => onChange())
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}

/* --------------------------- helpers ----------------------------- */
function clock(iso: string) { return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'now';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  if (s < 86400) return Math.floor(s / 3600) + 'h';
  if (s < 604800) return Math.floor(s / 86400) + 'd';
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}
const INVITE_RE = /(?:https?:\/\/[^\s]+)?\/debate\/([0-9a-fA-F-]{36})\/join(\?[^\s]*)?/;
function roleLabel(role: string, side: string | null) {
  return role === 'debater' ? (side === 'opp' ? 'Opposition debater' : 'Proposition debater')
    : role === 'judge' ? 'Judge' : role === 'moderator' ? 'Moderator' : 'Guest';
}

/* ----------------------------- inbox ----------------------------- */
export function InboxScreen({ onOpen, onBack }: { onOpen: (handle: string) => void; onBack?: () => void }) {
  const [rows, setRows] = useState<ConversationSummary[] | null>(null);
  useEffect(() => {
    let on = true;
    const load = () => listConversations().then(r => { if (on) setRows(r); }).catch(() => { if (on) setRows([]); });
    load();
    const off = subscribeInbox(load);
    return () => { on = false; off(); };
  }, []);

  return (
    <Scroll title="Messages" onBack={onBack} maxWidth={620}>
      {rows === null ? <Empty>Loading…</Empty>
        : rows.length === 0
          ? <Empty>No conversations yet. Open someone's profile and tap <b>Message</b> to start one.</Empty>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rows.map(c => (
                <button key={c.id} onClick={() => onOpen(c.handle)} style={{ display: 'flex', alignItems: 'center', gap: 13,
                  textAlign: 'left', padding: '12px', borderRadius: 11, border: `1px solid ${C.hair}`, background: C.panel, cursor: 'pointer' }}>
                  <Avatar url={c.avatar_url} name={c.display_name} size={46} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: ui, fontSize: 15, fontWeight: 600, color: C.ink }}>{c.display_name}</span>
                      <span style={{ fontFamily: mono, fontSize: 11.5, color: C.faint }}>@{c.handle}</span>
                      <span style={{ marginLeft: 'auto', fontFamily: ui, fontSize: 11, color: C.faint }}>{timeAgo(c.last_message_at)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                      <span style={{ flex: 1, minWidth: 0, fontFamily: ui, fontSize: 13, color: c.unread ? C.ink : C.dim,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: c.unread ? 600 : 400 }}>
                        {c.last_preview ?? 'New conversation'}</span>
                      {c.unread > 0 && <span style={{ background: C.gold, color: C.base, borderRadius: 999, minWidth: 18, height: 18,
                        padding: '0 5px', display: 'grid', placeItems: 'center', fontFamily: ui, fontSize: 11, fontWeight: 700 }}>{c.unread}</span>}
                    </div>
                  </div>
                </button>
              ))}
            </div>}
    </Scroll>
  );
}

/* ---------------------------- thread ----------------------------- */
export function ThreadScreen({ handle, onBack, onOpenProfile, onOpenInvite }: {
  handle: string; onBack: () => void; onOpenProfile: (h: string) => void; onOpenInvite: (path: string) => void;
}) {
  const { user } = useAuth();
  const me = user?.id;
  const [other, setOther] = useState<Profile | null>(null);
  const [cid, setCid] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<DMessage[]>([]);
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const p = await getProfile(handle);
        if (!on) return;
        if (!p) { setErr('User not found'); return; }
        setOther(p);
        const id = await openConversation(p.id);
        if (!on) return;
        setCid(id);
        const m = await getMessages(id);
        if (!on) return;
        setMsgs(m);
        markRead(id);
      } catch (e: any) { if (on) setErr(e?.message ?? 'Could not open conversation'); }
    })();
    return () => { on = false; };
  }, [handle]);

  useEffect(() => {
    if (!cid) return;
    const off = subscribeMessages(cid, (m) => {
      setMsgs(prev => prev.some(x => x.id === m.id) ? prev : [...prev, m]);
      markRead(cid);
    });
    return off;
  }, [cid]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs.length]);

  async function send() {
    const body = text.trim();
    if (!body || !cid) return;
    setText(''); setErr(null);
    try { await sendMessage(cid, body); }
    catch (e: any) { setErr(e?.message ?? 'Send failed'); setText(body); }
  }

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: C.base }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: `1px solid ${C.hair}` }}>
        <button onClick={onBack} style={iconBtn}>‹</button>
        {other && (
          <button onClick={() => onOpenProfile(other.handle)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <Avatar url={other.avatar_url} name={other.display_name} size={36} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontFamily: display, fontSize: 17, fontWeight: 600, color: C.ink, lineHeight: 1.1 }}>{other.display_name}</div>
              <div style={{ fontFamily: mono, fontSize: 11.5, color: C.faint }}>@{other.handle}</div>
            </div>
          </button>
        )}
      </div>

      {/* messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {msgs.length === 0 && !err && (
          <div style={{ margin: 'auto', fontFamily: ui, fontSize: 13, color: C.faint, textAlign: 'center', maxWidth: 320, lineHeight: 1.5 }}>
            This is the start of your conversation{other ? ` with ${other.display_name}` : ''}. Say hello — or drop a debate invite link.</div>
        )}
        {msgs.map(m => <Bubble key={m.id} m={m} mine={m.sender_id === me} onOpenInvite={onOpenInvite} />)}
        <div ref={endRef} />
      </div>

      {err && <div style={{ padding: '6px 16px', fontFamily: ui, fontSize: 12, color: C.garnetHi }}>{err}</div>}

      {/* composer */}
      <div style={{ display: 'flex', gap: 10, padding: '12px 16px', borderTop: `1px solid ${C.hair}` }}>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={1} placeholder="Write a message…"
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          style={{ ...field, flex: 1, resize: 'none', maxHeight: 120, fontFamily: ui }} />
        <button onClick={send} disabled={!text.trim()} style={{ ...solidGold, opacity: text.trim() ? 1 : 0.5 }}>Send</button>
      </div>
    </div>
  );
}

function Bubble({ m, mine, onOpenInvite }: { m: DMessage; mine: boolean; onOpenInvite: (path: string) => void }) {
  const inv = m.body.match(INVITE_RE);
  let invite: { path: string; role: string; side: string | null } | null = null;
  if (inv) {
    const q = new URLSearchParams(inv[2] ?? '');
    invite = { path: `/debate/${inv[1]}/join${inv[2] ?? ''}`, role: q.get('role') ?? 'audience', side: q.get('side') };
  }
  const textOnly = invite ? m.body.replace(INVITE_RE, '').trim() : m.body;
  return (
    <div style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
      <div style={{ maxWidth: '78%', padding: '9px 13px', borderRadius: 14,
        background: mine ? C.panel2 : C.panel, border: `1px solid ${mine ? C.hairHi : C.hair}`,
        borderBottomRightRadius: mine ? 4 : 14, borderBottomLeftRadius: mine ? 14 : 4 }}>
        {textOnly && <div style={{ fontFamily: ui, fontSize: 14, color: C.ink, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{textOnly}</div>}
        {invite && (
          <button onClick={() => onOpenInvite(invite!.path)} style={{ marginTop: textOnly ? 9 : 0, display: 'flex', alignItems: 'center',
            gap: 9, width: '100%', textAlign: 'left', cursor: 'pointer', borderRadius: 9, padding: '10px 12px',
            border: `1px solid ${C.gold}`, background: 'rgba(217,180,92,0.08)' }}>
            <span style={{ fontSize: 16 }}>🎙️</span>
            <span style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontFamily: ui, fontSize: 13, fontWeight: 700, color: C.goldHi }}>Debate invite</span>
              <span style={{ fontFamily: ui, fontSize: 11.5, color: C.dim }}>Join on stage as {roleLabel(invite.role, invite.side)} →</span>
            </span>
          </button>
        )}
        <div style={{ fontFamily: mono, fontSize: 9.5, color: C.faint, marginTop: 5, textAlign: mine ? 'right' : 'left' }}>{clock(m.created_at)}</div>
      </div>
    </div>
  );
}
