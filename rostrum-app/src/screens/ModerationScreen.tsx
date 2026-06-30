// =====================================================================
// The Rostrum · ModerationScreen.tsx
// Admin-only. Reports queue, ban list, appeals, support tickets.
// Only renders if profiles.is_admin = true — enforced server-side too.
// =====================================================================
import { useState, useEffect } from 'react';
import { C, ui, display, a } from '../lib/theme';
import { Scroll } from '../components/ui';
import {
  getAllReports, reviewReport, getAllBans, liftBan, getAllAppeals, ruleAppeal,
  getAllTickets, getTicketMessages, replyTicket, resolveTicket,
  type Report, type Ban, type Appeal, type SupportTicket, type TicketMessage,
  type ReportStatus, type AppealStatus,
} from '../lib/api';

type Tab = 'reports' | 'bans' | 'appeals' | 'tickets';

const statusBadge = (s: string, c: string) => (
  <span style={{ fontSize:10, fontWeight:800, padding:'2px 9px', borderRadius:20, textTransform:'uppercase',
    letterSpacing:'.07em', background:`${c}22`, color:c }}>{s.replace('_',' ')}</span>
);

export function ModerationScreen() {
  const [tab, setTab]         = useState<Tab>('reports');
  const [reports, setReports] = useState<Report[]>([]);
  const [bans, setBans]       = useState<Ban[]>([]);
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected items
  const [selReport, setSelReport] = useState<Report | null>(null);
  const [selTicket, setSelTicket] = useState<SupportTicket | null>(null);
  const [ticketMsgs, setTicketMsgs] = useState<TicketMessage[]>([]);

  // Report review form
  const [note, setNote]     = useState('');
  const [doBan, setDoBan]   = useState(false);
  const [banDays, setBanDays] = useState('');
  const [banNote, setBanNote] = useState('');
  const [busy, setBusy]     = useState(false);

  // Appeal form
  const [appealReply, setAppealReply] = useState('');

  // Ticket reply
  const [ticketReply, setTicketReply] = useState('');

  useEffect(() => { loadAll(); }, []);
  useEffect(() => {
    if (selTicket) getTicketMessages(selTicket.id).then(setTicketMsgs);
  }, [selTicket]);

  async function loadAll() {
    setLoading(true);
    const [r, b, a, t] = await Promise.all([getAllReports(), getAllBans(), getAllAppeals(), getAllTickets()]);
    setReports(r); setBans(b); setAppeals(a); setTickets(t);
    setLoading(false);
  }

  async function review(status: ReportStatus) {
    if (!selReport) return;
    setBusy(true);
    try {
      await reviewReport(selReport.id, status, note || undefined,
        doBan, banNote || undefined, banDays ? parseInt(banDays) : undefined);
      await loadAll(); setSelReport(null); setNote(''); setDoBan(false); setBanDays(''); setBanNote('');
    } catch (e: any) { alert(e?.message ?? 'Error'); }
    finally { setBusy(false); }
  }

  async function handleLiftBan(id: string) {
    if (!confirm('Lift this ban?')) return;
    await liftBan(id); await loadAll();
  }

  async function handleRuleAppeal(a: Appeal, status: AppealStatus) {
    setBusy(true);
    try { await ruleAppeal(a.id, status, appealReply || undefined); await loadAll(); setAppealReply(''); }
    catch (e: any) { alert(e?.message ?? 'Error'); }
    finally { setBusy(false); }
  }

  async function sendTicketReply() {
    if (!selTicket || !ticketReply.trim()) return;
    setBusy(true);
    try { await replyTicket(selTicket.id, ticketReply); setTicketReply(''); setTicketMsgs(await getTicketMessages(selTicket.id)); }
    catch { } finally { setBusy(false); }
  }

  async function handleResolveTicket() {
    if (!selTicket) return;
    await resolveTicket(selTicket.id); await loadAll(); setSelTicket(null);
  }

  const Chip = ({ t, count }: { t: Tab; count: number }) => (
    <button onClick={() => { setTab(t); setSelReport(null); setSelTicket(null); }}
      style={{ padding:'7px 16px', borderRadius:20, border:`1px solid ${tab===t ? C.gold : C.hair}`,
        background: tab===t ? `${a(C.gold,'18')}`:'transparent', color: tab===t ? C.gold:C.dim,
        fontFamily:ui, fontSize:13, fontWeight: tab===t?700:400, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
      {t.charAt(0).toUpperCase()+t.slice(1)}
      {count > 0 && <span style={{ fontSize:10, fontWeight:800, padding:'1px 6px', borderRadius:20,
        background: t==='reports'||t==='appeals'?C.garnet:C.gold, color:'#fff' }}>{count}</span>}
    </button>
  );

  if (loading) return <div style={{ padding:32, fontFamily:ui, color:C.faint }}>Loading…</div>;

  const pendingReports = reports.filter(r => r.status === 'pending').length;
  const openAppeals    = appeals.filter(a => a.status === 'open').length;
  const openTickets    = tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length;

  return (
    <Scroll style={{ padding:'28px 24px', maxWidth:820, margin:'0 auto' }}>
      <div style={{ fontFamily:display, fontSize:26, fontWeight:800, color:C.ink, marginBottom:4 }}>
        Moderation
      </div>
      <div style={{ fontFamily:ui, fontSize:13, color:C.faint, marginBottom:24 }}>
        Admin view — visible only to you.
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:24, flexWrap:'wrap' }}>
        <Chip t="reports" count={pendingReports} />
        <Chip t="bans" count={0} />
        <Chip t="appeals" count={openAppeals} />
        <Chip t="tickets" count={openTickets} />
      </div>

      {/* ── Reports ── */}
      {tab === 'reports' && !selReport && (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {reports.length === 0 && <div style={{ fontFamily:ui, fontSize:13, color:C.faint }}>No reports yet.</div>}
          {reports.map(r => (
            <div key={r.id} onClick={() => setSelReport(r)}
              style={{ padding:'12px 16px', borderRadius:10, border:`1px solid ${C.hair}`, background:C.panel,
                cursor:'pointer', display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily:ui, fontSize:13, fontWeight:600, color:C.ink }}>
                  {r.reason.replace('_',' ')} · {r.target_type.replace('_',' ')}
                </div>
                <div style={{ fontFamily:ui, fontSize:11, color:C.faint, marginTop:2 }}>
                  {new Date(r.created_at).toLocaleString()}
                  {r.body && <span> — {r.body.slice(0,60)}{r.body.length>60?'…':''}</span>}
                </div>
              </div>
              {statusBadge(r.status, r.status==='pending' ? C.gold : r.status==='actioned' ? C.garnet : C.jade)}
            </div>
          ))}
        </div>
      )}

      {tab === 'reports' && selReport && (
        <div>
          <button onClick={() => setSelReport(null)}
            style={{ background:'none', border:'none', fontFamily:ui, fontSize:13, color:C.gold, cursor:'pointer', padding:'0 0 16px', fontWeight:600 }}>
            ← Back
          </button>
          <div style={{ padding:18, borderRadius:12, border:`1px solid ${C.hair}`, background:C.panel, marginBottom:18 }}>
            <div style={{ display:'flex', gap:10, marginBottom:10, flexWrap:'wrap' }}>
              {statusBadge(selReport.reason.replace('_',' '), C.gold)}
              {statusBadge(selReport.target_type, C.dim)}
              {statusBadge(selReport.status, selReport.status==='pending'?C.gold:selReport.status==='actioned'?C.garnet:C.jade)}
            </div>
            <div style={{ fontFamily:ui, fontSize:12, color:C.faint, marginBottom:8 }}>
              Target ID: <span style={{ fontFamily:'monospace', color:C.dim }}>{selReport.target_id}</span>
            </div>
            {selReport.body && (
              <div style={{ fontFamily:ui, fontSize:13, color:C.dim, padding:'10px 12px',
                borderRadius:8, background:C.base, lineHeight:1.6 }}>{selReport.body}</div>
            )}
          </div>

          {selReport.status === 'pending' && (
            <div style={{ display:'flex', flexDirection:'column', gap:12, padding:18, borderRadius:12,
              border:`1px solid ${C.hair}`, background:C.panel }}>
              <div style={{ fontFamily:display, fontSize:16, fontWeight:700, color:C.ink }}>Review this report</div>
              <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Mod note (optional)"
                style={{ padding:'9px 11px', borderRadius:8, border:`1px solid ${C.hair}`, background:C.base,
                  color:C.ink, fontFamily:ui, fontSize:13, resize:'vertical', minHeight:60 }} />
              <label style={{ display:'flex', alignItems:'center', gap:10, fontFamily:ui, fontSize:13, color:C.ink, cursor:'pointer' }}>
                <input type="checkbox" checked={doBan} onChange={e => setDoBan(e.target.checked)} style={{ accentColor:C.garnet }} />
                Also ban this user
              </label>
              {doBan && (
                <div style={{ display:'flex', gap:10 }}>
                  <input value={banDays} onChange={e => setBanDays(e.target.value)} placeholder="Days (blank = permanent)"
                    type="number" min={1}
                    style={{ flex:1, padding:'8px 11px', borderRadius:8, border:`1px solid ${C.hair}`, background:C.base, color:C.ink, fontFamily:ui, fontSize:13 }} />
                  <input value={banNote} onChange={e => setBanNote(e.target.value)} placeholder="Ban reason"
                    style={{ flex:2, padding:'8px 11px', borderRadius:8, border:`1px solid ${C.hair}`, background:C.base, color:C.ink, fontFamily:ui, fontSize:13 }} />
                </div>
              )}
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={() => review('actioned')} disabled={busy}
                  style={{ padding:'9px 18px', borderRadius:8, background:C.garnet, color:'#fff',
                    fontFamily:ui, fontWeight:700, fontSize:13, border:'none', cursor:'pointer', opacity:busy?.6:1 }}>
                  Action
                </button>
                <button onClick={() => review('dismissed')} disabled={busy}
                  style={{ padding:'9px 18px', borderRadius:8, background:'transparent',
                    border:`1px solid ${C.hair}`, color:C.dim, fontFamily:ui, fontSize:13, cursor:'pointer' }}>
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Bans ── */}
      {tab === 'bans' && (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {bans.length === 0 && <div style={{ fontFamily:ui, fontSize:13, color:C.faint }}>No active bans.</div>}
          {bans.map(b => (
            <div key={b.id} style={{ padding:'12px 16px', borderRadius:10, border:`1px solid ${C.hair}`,
              background:C.panel, display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily:'monospace', fontSize:11, color:C.dim }}>{b.user_id}</div>
                <div style={{ fontFamily:ui, fontSize:13, color:C.ink, marginTop:2 }}>{b.reason}</div>
                <div style={{ fontFamily:ui, fontSize:11, color:C.faint, marginTop:2 }}>
                  {b.expires_at ? `Expires ${new Date(b.expires_at).toLocaleDateString()}` : 'Permanent'}
                  {b.lifted_at && ' · Lifted'}
                </div>
              </div>
              {!b.lifted_at && (
                <button onClick={() => handleLiftBan(b.id)}
                  style={{ padding:'7px 14px', borderRadius:8, background:'transparent',
                    border:`1px solid ${C.jade}`, color:C.jadeHi, fontFamily:ui, fontSize:12, cursor:'pointer', fontWeight:700 }}>
                  Lift ban
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Appeals ── */}
      {tab === 'appeals' && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {appeals.length === 0 && <div style={{ fontFamily:ui, fontSize:13, color:C.faint }}>No appeals yet.</div>}
          {appeals.map(a => (
            <div key={a.id} style={{ padding:16, borderRadius:12, border:`1px solid ${C.hair}`, background:C.panel }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                {statusBadge(a.status, a.status==='open'?C.gold:a.status==='approved'?C.jade:C.garnet)}
                <span style={{ fontFamily:'monospace', fontSize:11, color:C.faint }}>{a.ban_id.slice(0,8)}</span>
              </div>
              <div style={{ fontFamily:ui, fontSize:13, color:C.dim, lineHeight:1.6, marginBottom:12 }}>{a.body}</div>
              {a.status === 'open' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <textarea value={appealReply} onChange={e => setAppealReply(e.target.value)}
                    placeholder="Reply to appellant (optional)" rows={2}
                    style={{ padding:'8px 11px', borderRadius:8, border:`1px solid ${C.hair}`, background:C.base,
                      color:C.ink, fontFamily:ui, fontSize:13, resize:'vertical' }} />
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={() => handleRuleAppeal(a, 'approved')} disabled={busy}
                      style={{ padding:'8px 16px', borderRadius:8, background:C.jade, color:'#fff',
                        fontFamily:ui, fontWeight:700, fontSize:12, border:'none', cursor:'pointer' }}>
                      Approve (lift ban)
                    </button>
                    <button onClick={() => handleRuleAppeal(a, 'denied')} disabled={busy}
                      style={{ padding:'8px 16px', borderRadius:8, background:C.garnet, color:'#fff',
                        fontFamily:ui, fontWeight:700, fontSize:12, border:'none', cursor:'pointer' }}>
                      Deny
                    </button>
                  </div>
                </div>
              )}
              {a.admin_reply && (
                <div style={{ fontFamily:ui, fontSize:12, color:C.dim, fontStyle:'italic', marginTop:8 }}>
                  Your reply: "{a.admin_reply}"
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Support tickets ── */}
      {tab === 'tickets' && !selTicket && (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {tickets.length === 0 && <div style={{ fontFamily:ui, fontSize:13, color:C.faint }}>No tickets yet.</div>}
          {tickets.map(t => (
            <div key={t.id} onClick={() => setSelTicket(t)}
              style={{ padding:'12px 16px', borderRadius:10, border:`1px solid ${C.hair}`, background:C.panel,
                cursor:'pointer', display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily:ui, fontSize:14, fontWeight:600, color:C.ink,
                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.subject}</div>
                <div style={{ fontFamily:ui, fontSize:11, color:C.faint, marginTop:2 }}>
                  {t.category} · {new Date(t.updated_at).toLocaleString()}
                </div>
              </div>
              {statusBadge(t.status.replace('_',' '),
                t.status==='resolved'||t.status==='closed'?C.jade:t.status==='in_progress'?C.gold:C.faint)}
            </div>
          ))}
        </div>
      )}
      {tab === 'tickets' && selTicket && (
        <div>
          <button onClick={() => setSelTicket(null)}
            style={{ background:'none', border:'none', fontFamily:ui, fontSize:13, color:C.gold, cursor:'pointer', padding:'0 0 16px', fontWeight:600 }}>
            ← Back
          </button>
          <div style={{ fontFamily:display, fontSize:18, fontWeight:700, color:C.ink, marginBottom:4 }}>{selTicket.subject}</div>
          <div style={{ fontFamily:ui, fontSize:12, color:C.faint, marginBottom:20 }}>
            {selTicket.category} · {new Date(selTicket.created_at).toLocaleString()}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:18 }}>
            {ticketMsgs.map(m => (
              <div key={m.id} style={{ padding:'11px 14px', borderRadius:10,
                background: m.is_admin ? `${a(C.gold,'14')}` : C.panel,
                border:`1px solid ${m.is_admin ? a(C.gold,'44') : C.hair}`,
                alignSelf: m.is_admin?'flex-start':'flex-end', maxWidth:'90%' }}>
                <div style={{ fontFamily:ui, fontSize:11, fontWeight:700, color: m.is_admin?C.gold:C.dim, marginBottom:4 }}>
                  {m.is_admin ? 'Support (you)' : 'User'}
                </div>
                <div style={{ fontFamily:ui, fontSize:13, color:C.ink, lineHeight:1.6 }}>{m.body}</div>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <textarea value={ticketReply} onChange={e => setTicketReply(e.target.value)}
              placeholder="Reply to user…" rows={2}
              style={{ flex:1, padding:'9px 11px', borderRadius:8, border:`1px solid ${C.hair}`,
                background:C.base, color:C.ink, fontFamily:ui, fontSize:13, resize:'vertical' }} />
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <button onClick={sendTicketReply} disabled={busy||!ticketReply.trim()}
                style={{ padding:'8px 16px', borderRadius:8, background:C.gold, color:'#000',
                  fontFamily:ui, fontWeight:700, fontSize:12, border:'none', cursor:'pointer' }}>
                Send
              </button>
              <button onClick={handleResolveTicket}
                style={{ padding:'8px 16px', borderRadius:8, background:'transparent',
                  border:`1px solid ${C.jade}`, color:C.jadeHi, fontFamily:ui, fontSize:12, cursor:'pointer' }}>
                Resolve
              </button>
            </div>
          </div>
        </div>
      )}
    </Scroll>
  );
}
