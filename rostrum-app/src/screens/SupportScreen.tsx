// =====================================================================
// The Rostrum · SupportScreen.tsx
// Users: submit + track support tickets.
// FAQ section with published items grouped by category.
// =====================================================================
import { useState, useEffect } from 'react';
import { C, ui, display, mono, a } from '../lib/theme';
import { Scroll } from '../components/ui';
import {
  submitTicket, getMyTickets, getTicketMessages, replyTicket, getFaq,
  type SupportTicket, type TicketMessage, type FaqItem, type TicketCategory,
} from '../lib/api';

const CATEGORIES: { value: TicketCategory; label: string }[] = [
  { value: 'account',   label: 'Account' },
  { value: 'billing',   label: 'Billing' },
  { value: 'technical', label: 'Technical' },
  { value: 'content',   label: 'Content' },
  { value: 'other',     label: 'Other' },
];

const statusColor = (s: string) =>
  s === 'resolved' || s === 'closed' ? C.jade
  : s === 'in_progress' ? C.gold : C.faint;

export function SupportScreen() {
  const [tab, setTab] = useState<'faq' | 'tickets' | 'new'>('faq');
  const [faq, setFaq]             = useState<FaqItem[]>([]);
  const [tickets, setTickets]     = useState<SupportTicket[]>([]);
  const [openFaq, setOpenFaq]     = useState<string | null>(null);
  const [selected, setSelected]   = useState<SupportTicket | null>(null);
  const [messages, setMessages]   = useState<TicketMessage[]>([]);
  const [reply, setReply]         = useState('');
  const [busy, setBusy]           = useState(false);

  // New ticket form
  const [cat, setCat]     = useState<TicketCategory>('technical');
  const [subject, setSubject] = useState('');
  const [body, setBody]   = useState('');
  const [formErr, setFormErr] = useState('');
  const [formOk, setFormOk]   = useState(false);

  useEffect(() => { getFaq().then(setFaq); getMyTickets().then(setTickets); }, []);
  useEffect(() => {
    if (selected) getTicketMessages(selected.id).then(setMessages);
  }, [selected]);

  const faqGroups = faq.reduce<Record<string, FaqItem[]>>((acc, f) => {
    (acc[f.category] = acc[f.category] ?? []).push(f); return acc;
  }, {});

  async function submitNew() {
    if (!subject.trim() || !body.trim()) { setFormErr('Subject and description are required.'); return; }
    setBusy(true); setFormErr('');
    try {
      await submitTicket(cat, subject, body);
      setFormOk(true); setSubject(''); setBody('');
      const updated = await getMyTickets(); setTickets(updated);
    } catch (e: any) { setFormErr(e?.message ?? 'Could not submit'); }
    finally { setBusy(false); }
  }

  async function sendReply() {
    if (!selected || !reply.trim()) return;
    setBusy(true);
    try {
      await replyTicket(selected.id, reply); setReply('');
      setMessages(await getTicketMessages(selected.id));
    } catch { }
    finally { setBusy(false); }
  }

  const Chip = ({ on, onClick, children }: any) => (
    <button onClick={onClick} style={{ padding:'7px 16px', borderRadius:20, border:`1px solid ${on ? C.gold : C.hair}`,
      background: on ? `${a(C.gold,'18')}` : 'transparent', color: on ? C.gold : C.dim,
      fontFamily:ui, fontSize:13, fontWeight: on ? 700 : 400, cursor:'pointer', transition:'all .15s' }}>
      {children}
    </button>
  );

  return (
    <Scroll style={{ padding:'28px 24px', maxWidth:720, margin:'0 auto' }}>
      <div style={{ fontFamily:display, fontSize:26, fontWeight:800, color:C.ink, marginBottom:4 }}>Help & Support</div>
      <div style={{ fontFamily:ui, fontSize:13, color:C.faint, marginBottom:24 }}>
        Browse our FAQ or open a support ticket.
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:24 }}>
        <Chip on={tab==='faq'} onClick={() => setTab('faq')}>FAQ</Chip>
        <Chip on={tab==='tickets'} onClick={() => { setTab('tickets'); setSelected(null); }}>My tickets</Chip>
        <Chip on={tab==='new'} onClick={() => { setTab('new'); setFormOk(false); }}>New ticket</Chip>
      </div>

      {/* ── FAQ ── */}
      {tab === 'faq' && (
        <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
          {Object.entries(faqGroups).map(([cat, items]) => (
            <div key={cat}>
              <div style={{ fontFamily:display, fontSize:16, fontWeight:700, color:C.dim,
                textTransform:'uppercase', letterSpacing:'.08em', marginBottom:10 }}>{cat}</div>
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {items.map(f => (
                  <div key={f.id} style={{ borderRadius:10, border:`1px solid ${C.hair}`, background:C.panel, overflow:'hidden' }}>
                    <button onClick={() => setOpenFaq(openFaq === f.id ? null : f.id)}
                      style={{ width:'100%', textAlign:'left', padding:'14px 16px', background:'none', border:'none',
                        cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
                      <span style={{ fontFamily:ui, fontSize:14, fontWeight:600, color:C.ink }}>{f.question}</span>
                      <span style={{ color:C.faint, flexShrink:0 }}>{openFaq === f.id ? '▲' : '▼'}</span>
                    </button>
                    {openFaq === f.id && (
                      <div style={{ padding:'0 16px 16px', fontFamily:ui, fontSize:13, color:C.dim, lineHeight:1.7 }}>
                        {f.answer}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {faq.length === 0 && <div style={{ fontFamily:ui, fontSize:13, color:C.faint }}>No FAQ items yet.</div>}
        </div>
      )}

      {/* ── Tickets list ── */}
      {tab === 'tickets' && !selected && (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {tickets.length === 0 && (
            <div style={{ fontFamily:ui, fontSize:13, color:C.faint }}>
              You haven't opened any tickets yet. <button onClick={() => setTab('new')}
                style={{ background:'none', border:'none', color:C.gold, fontFamily:ui, fontSize:13, cursor:'pointer', padding:0, fontWeight:700 }}>
                Open one now →
              </button>
            </div>
          )}
          {tickets.map(t => (
            <div key={t.id} onClick={() => setSelected(t)}
              style={{ padding:'13px 16px', borderRadius:10, border:`1px solid ${C.hair}`, background:C.panel,
                cursor:'pointer', display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily:ui, fontSize:14, fontWeight:600, color:C.ink,
                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.subject}</div>
                <div style={{ fontFamily:ui, fontSize:11, color:C.faint, marginTop:2 }}>
                  {t.category} · {new Date(t.updated_at).toLocaleDateString()}
                </div>
              </div>
              <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20,
                background:`${statusColor(t.status)}22`, color:statusColor(t.status),
                textTransform:'uppercase', letterSpacing:'.06em', flexShrink:0 }}>
                {t.status.replace('_', ' ')}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Ticket thread ── */}
      {tab === 'tickets' && selected && (
        <div>
          <button onClick={() => setSelected(null)}
            style={{ background:'none', border:'none', fontFamily:ui, fontSize:13, color:C.gold,
              cursor:'pointer', padding:'0 0 16px', fontWeight:600 }}>
            ← Back to tickets
          </button>
          <div style={{ fontFamily:display, fontSize:18, fontWeight:700, color:C.ink, marginBottom:4 }}>
            {selected.subject}
          </div>
          <div style={{ fontFamily:ui, fontSize:12, color:C.faint, marginBottom:20 }}>
            {selected.category} · opened {new Date(selected.created_at).toLocaleDateString()}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:20 }}>
            {messages.map(m => (
              <div key={m.id} style={{ padding:'11px 14px', borderRadius:10,
                background: m.is_admin ? `${a(C.gold,'14')}` : C.panel,
                border:`1px solid ${m.is_admin ? a(C.gold,'44') : C.hair}`, alignSelf: m.is_admin ? 'flex-start':'flex-end', maxWidth:'90%' }}>
                <div style={{ fontFamily:ui, fontSize:11, fontWeight:700, color: m.is_admin ? C.gold : C.dim,
                  marginBottom:4 }}>{m.is_admin ? 'Support' : 'You'}</div>
                <div style={{ fontFamily:ui, fontSize:13, color:C.ink, lineHeight:1.6 }}>{m.body}</div>
              </div>
            ))}
            {messages.length === 0 && (
              <div style={{ fontFamily:ui, fontSize:13, color:C.faint }}>No replies yet — we'll get back to you soon.</div>
            )}
          </div>
          {selected.status !== 'resolved' && selected.status !== 'closed' && (
            <div style={{ display:'flex', gap:10 }}>
              <textarea value={reply} onChange={e => setReply(e.target.value)} placeholder="Add a reply…"
                style={{ flex:1, padding:'9px 11px', borderRadius:8, border:`1px solid ${C.hair}`,
                  background:C.base, color:C.ink, fontFamily:ui, fontSize:13, resize:'vertical', minHeight:60 }} />
              <button onClick={sendReply} disabled={busy || !reply.trim()}
                style={{ padding:'0 18px', borderRadius:8, background:C.gold, color:'#000',
                  fontFamily:ui, fontWeight:700, fontSize:13, border:'none',
                  cursor: busy||!reply.trim()?'default':'pointer', opacity: busy||!reply.trim()?.6:1, alignSelf:'stretch' }}>
                Send
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── New ticket ── */}
      {tab === 'new' && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {formOk ? (
            <div style={{ padding:20, borderRadius:12, background:`${a(C.jade,'18')}`, border:`1px solid ${a(C.jade,'44')}`,
              fontFamily:ui, fontSize:14, color:C.jadeHi }}>
              ✓ Ticket submitted! We'll respond as soon as possible.{' '}
              <button onClick={() => { setTab('tickets'); setFormOk(false); }}
                style={{ background:'none', border:'none', color:C.gold, fontFamily:ui, fontSize:14, cursor:'pointer', fontWeight:700 }}>
                View tickets →
              </button>
            </div>
          ) : (
            <>
              <div>
                <label style={{ fontFamily:ui, fontSize:12, fontWeight:700, color:C.dim,
                  textTransform:'uppercase', letterSpacing:'.07em', display:'block', marginBottom:6 }}>Category</label>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {CATEGORIES.map(c => (
                    <button key={c.value} onClick={() => setCat(c.value)}
                      style={{ padding:'6px 14px', borderRadius:20, border:`1px solid ${cat===c.value ? C.gold : C.hair}`,
                        background: cat===c.value ? `${a(C.gold,'18')}`:'transparent', color: cat===c.value ? C.gold:C.dim,
                        fontFamily:ui, fontSize:12, fontWeight: cat===c.value?700:400, cursor:'pointer' }}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontFamily:ui, fontSize:12, fontWeight:700, color:C.dim,
                  textTransform:'uppercase', letterSpacing:'.07em', display:'block', marginBottom:6 }}>Subject</label>
                <input value={subject} onChange={e => setSubject(e.target.value)} maxLength={200}
                  placeholder="Brief summary of the issue"
                  style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:`1px solid ${C.hair}`,
                    background:C.base, color:C.ink, fontFamily:ui, fontSize:13, boxSizing:'border-box' }} />
              </div>
              <div>
                <label style={{ fontFamily:ui, fontSize:12, fontWeight:700, color:C.dim,
                  textTransform:'uppercase', letterSpacing:'.07em', display:'block', marginBottom:6 }}>Description</label>
                <textarea value={body} onChange={e => setBody(e.target.value)} maxLength={3000}
                  placeholder="Describe what happened, any error messages you saw, and steps to reproduce…"
                  style={{ width:'100%', minHeight:120, resize:'vertical', padding:'10px 12px', borderRadius:8,
                    border:`1px solid ${C.hair}`, background:C.base, color:C.ink,
                    fontFamily:ui, fontSize:13, boxSizing:'border-box' }} />
              </div>
              {formErr && <div style={{ fontFamily:ui, fontSize:12, color:C.garnet }}>{formErr}</div>}
              <button onClick={submitNew} disabled={busy}
                style={{ alignSelf:'flex-start', padding:'10px 24px', borderRadius:8, background:C.gold,
                  color:'#000', fontFamily:ui, fontWeight:700, fontSize:13, border:'none',
                  cursor: busy?'default':'pointer', opacity: busy?.6:1 }}>
                {busy ? 'Submitting…' : 'Submit ticket'}
              </button>
            </>
          )}
        </div>
      )}
    </Scroll>
  );
}
