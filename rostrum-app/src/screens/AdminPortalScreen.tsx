// =====================================================================
// The Rostrum · AdminPortalScreen.tsx
// Owner-only business intelligence dashboard.
// Stat cards, growth charts, top debates, top users, moderation feed.
// =====================================================================
import { useEffect, useState, useCallback } from 'react';
import { C, ui, display, mono } from '../lib/theme';
import { Scroll } from '../components/ui';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';

// ── tiny types ───────────────────────────────────────────────────────
interface Summary {
  total_users: number; new_users_7d: number; new_users_30d: number;
  total_debates: number; live_debates: number; ended_debates: number; debates_7d: number;
  total_votes: number; total_chat: number; total_gifts: number; gifts_value_cents: number;
  pending_reports: number; open_appeals: number; open_tickets: number; active_bans: number;
}
interface GrowthRow  { day: string; signups: number; }
interface DebateRow  { day: string; created: number; ended: number; }
interface TopUser    { id: string; display_name: string; handle: string; wins: number; losses: number; level: number; rank: string; debates: number; }
interface TopDebate  { id: string; motion: string; status: string; viewer_count: number; votes: number; chat: number; created_at: string; }
interface ReportRow  { id: string; target_type: string; reason: string; status: string; created_at: string; }

// ── tiny chart (SVG spark-line) ───────────────────────────────────────
function SparkLine({ data, color, height = 56 }: { data: number[]; color: string; height?: number }) {
  if (data.length < 2) return <div style={{ height }} />;
  const max = Math.max(...data, 1);
  const w = 280; const h = height;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * (h - 4)}`).join(' ');
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display:'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={color} fillOpacity={0.12} />
    </svg>
  );
}

// ── stat card ─────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color, spark }: {
  label: string; value: string | number; sub?: string; color?: string; spark?: number[];
}) {
  return (
    <div style={{ borderRadius:12, border:`1px solid ${C.hair}`, background:C.panel,
      padding:'16px 18px', display:'flex', flexDirection:'column', gap:4, minWidth:0, overflow:'hidden' }}>
      <div style={{ fontFamily:ui, fontSize:11, fontWeight:700, color:C.dim,
        textTransform:'uppercase', letterSpacing:'.09em' }}>{label}</div>
      <div style={{ fontFamily:display, fontSize:28, fontWeight:800, color: color ?? C.ink, lineHeight:1 }}>
        {value}
      </div>
      {sub && <div style={{ fontFamily:ui, fontSize:11, color:C.faint }}>{sub}</div>}
      {spark && spark.length > 1 && (
        <div style={{ marginTop:8 }}>
          <SparkLine data={spark} color={color ?? C.gold} />
        </div>
      )}
    </div>
  );
}

// ── section header ────────────────────────────────────────────────────
function SectionHead({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
      <div style={{ fontFamily:display, fontSize:17, fontWeight:700, color:C.ink }}>{title}</div>
      {action && (
        <button onClick={onAction} style={{ background:'none', border:'none', fontFamily:ui,
          fontSize:12, color:C.gold, cursor:'pointer', fontWeight:600 }}>{action}</button>
      )}
    </div>
  );
}

const fmt = (n: number) => n >= 1000 ? `${(n/1000).toFixed(1)}k` : String(n);
const cents = (c: number) => `$${(c/100).toFixed(2)}`;
const statusColor = (s: string) =>
  s === 'pending' ? C.gold : s === 'actioned' ? C.garnet : s === 'dismissed' ? C.jade : C.faint;

export function AdminPortalScreen() {
  const nav = useNavigate();
  const [summary, setSummary]   = useState<Summary | null>(null);
  const [growth, setGrowth]     = useState<GrowthRow[]>([]);
  const [activity, setActivity] = useState<DebateRow[]>([]);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [topDebates, setTopDebates] = useState<TopDebate[]>([]);
  const [reports, setReports]   = useState<ReportRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [range, setRange]       = useState(30);
  const [tab, setTab]           = useState<'overview' | 'users' | 'debates' | 'moderation'>('overview');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, growRes, actRes, usrRes, debRes, repRes] = await Promise.all([
        supabase.rpc('admin_summary'),
        supabase.rpc('admin_user_growth', { p_days: range }),
        supabase.rpc('admin_debate_activity', { p_days: range }),
        supabase.rpc('admin_top_users', { p_limit: 10 }),
        supabase.rpc('admin_top_debates', { p_limit: 10 }),
        supabase.rpc('admin_recent_reports', { p_limit: 20 }),
      ]);
      if (sumRes.data) setSummary(sumRes.data as Summary);
      if (growRes.data) setGrowth(growRes.data as GrowthRow[]);
      if (actRes.data) setActivity(actRes.data as DebateRow[]);
      if (usrRes.data) setTopUsers(usrRes.data as TopUser[]);
      if (debRes.data) setTopDebates(debRes.data as TopDebate[]);
      if (repRes.data) setReports(repRes.data as ReportRow[]);
      setLastRefresh(new Date());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const Chip = ({ v, label }: { v: number; label: string }) => (
    <button onClick={() => setRange(v)}
      style={{ padding:'5px 14px', borderRadius:20, border:`1px solid ${range===v ? C.gold : C.hair}`,
        background: range===v ? `${C.gold}18`:'transparent', color: range===v ? C.gold : C.dim,
        fontFamily:ui, fontSize:12, fontWeight: range===v?700:400, cursor:'pointer' }}>
      {label}
    </button>
  );

  const NavChip = ({ t, label }: { t: typeof tab; label: string }) => (
    <button onClick={() => setTab(t)}
      style={{ padding:'7px 18px', borderRadius:20, border:`1px solid ${tab===t ? C.gold : C.hair}`,
        background: tab===t ? `${C.gold}18`:'transparent', color: tab===t ? C.gold : C.dim,
        fontFamily:ui, fontSize:13, fontWeight: tab===t?700:400, cursor:'pointer' }}>
      {label}
    </button>
  );

  return (
    <Scroll style={{ padding:'28px 24px', maxWidth:1000, margin:'0 auto' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontFamily:display, fontSize:28, fontWeight:800, color:C.ink, marginBottom:2 }}>
            Admin Portal
          </div>
          <div style={{ fontFamily:ui, fontSize:12, color:C.faint }}>
            Last updated: {lastRefresh.toLocaleTimeString()}
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <Chip v={7} label="7d" />
          <Chip v={30} label="30d" />
          <Chip v={90} label="90d" />
          <button onClick={load} style={{ padding:'7px 16px', borderRadius:20,
            border:`1px solid ${C.hair}`, background:'transparent', color:C.dim,
            fontFamily:ui, fontSize:12, cursor:'pointer' }}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Nav tabs */}
      <div style={{ display:'flex', gap:8, marginBottom:28, flexWrap:'wrap' }}>
        <NavChip t="overview" label="Overview" />
        <NavChip t="users" label="Users" />
        <NavChip t="debates" label="Debates" />
        <NavChip t="moderation" label="Moderation" />
      </div>

      {loading && (
        <div style={{ fontFamily:ui, fontSize:13, color:C.faint, padding:'40px 0', textAlign:'center' }}>
          Loading…
        </div>
      )}

      {!loading && summary && (
        <>
          {/* ── Overview ── */}
          {tab === 'overview' && (
            <>
              {/* KPI grid */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12, marginBottom:28 }}>
                <StatCard label="Total users" value={fmt(summary.total_users)}
                  sub={`+${summary.new_users_7d} this week`} color={C.jade}
                  spark={growth.map(g => g.signups)} />
                <StatCard label="Total debates" value={fmt(summary.total_debates)}
                  sub={`+${summary.debates_7d} this week`} color={C.gold}
                  spark={activity.map(a => a.created)} />
                <StatCard label="Live now" value={summary.live_debates} color={C.garnet} />
                <StatCard label="Votes cast" value={fmt(summary.total_votes)} />
                <StatCard label="Chat messages" value={fmt(summary.total_chat)} />
                <StatCard label="Gifts sent" value={fmt(summary.total_gifts)}
                  sub={cents(summary.gifts_value_cents) + ' total value'} color={C.gold} />
              </div>

              {/* Moderation flags */}
              <SectionHead title="Moderation flags" action="View queue →" onAction={() => setTab('moderation')} />
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:10, marginBottom:28 }}>
                {[
                  { label:'Pending reports', value:summary.pending_reports, color:C.gold },
                  { label:'Open appeals',    value:summary.open_appeals,    color:C.ember },
                  { label:'Open tickets',    value:summary.open_tickets,    color:C.dim },
                  { label:'Active bans',     value:summary.active_bans,     color:C.garnet },
                ].map(s => <StatCard key={s.label} {...s} />)}
              </div>

              {/* User growth sparkline */}
              <SectionHead title={`User signups — last ${range} days`} />
              <div style={{ borderRadius:12, border:`1px solid ${C.hair}`, background:C.panel,
                padding:'18px 18px 10px', marginBottom:28 }}>
                {growth.length === 0
                  ? <div style={{ fontFamily:ui, fontSize:13, color:C.faint }}>No signups in this range.</div>
                  : <>
                      <SparkLine data={growth.map(g => g.signups)} color={C.jade} height={80} />
                      <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}>
                        <span style={{ fontFamily:mono, fontSize:10, color:C.faint }}>{growth[0]?.day}</span>
                        <span style={{ fontFamily:mono, fontSize:10, color:C.faint }}>{growth[growth.length-1]?.day}</span>
                      </div>
                    </>
                }
              </div>

              {/* Debate activity sparkline */}
              <SectionHead title={`Debates created — last ${range} days`} />
              <div style={{ borderRadius:12, border:`1px solid ${C.hair}`, background:C.panel,
                padding:'18px 18px 10px', marginBottom:8 }}>
                {activity.length === 0
                  ? <div style={{ fontFamily:ui, fontSize:13, color:C.faint }}>No debates in this range.</div>
                  : <>
                      <SparkLine data={activity.map(a => a.created)} color={C.gold} height={80} />
                      <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}>
                        <span style={{ fontFamily:mono, fontSize:10, color:C.faint }}>{activity[0]?.day}</span>
                        <span style={{ fontFamily:mono, fontSize:10, color:C.faint }}>{activity[activity.length-1]?.day}</span>
                      </div>
                    </>
                }
              </div>
            </>
          )}

          {/* ── Users ── */}
          {tab === 'users' && (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:12, marginBottom:24 }}>
                <StatCard label="Total users" value={fmt(summary.total_users)} color={C.jade} />
                <StatCard label="New (7 days)" value={summary.new_users_7d} color={C.jade} />
                <StatCard label="New (30 days)" value={summary.new_users_30d} />
              </div>
              <SectionHead title="Top debaters" />
              <div style={{ borderRadius:12, border:`1px solid ${C.hair}`, background:C.panel, overflow:'hidden', marginBottom:24 }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom:`1px solid ${C.hair}` }}>
                      {['#','Name','Handle','Wins','Losses','Level','Rank','Debates'].map(h => (
                        <th key={h} style={{ fontFamily:ui, fontSize:11, color:C.dim, fontWeight:700,
                          textAlign:'left', padding:'10px 14px', textTransform:'uppercase', letterSpacing:'.07em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {topUsers.map((u, i) => (
                      <tr key={u.id} style={{ borderBottom:`1px solid ${C.hair}55` }}>
                        <td style={{ padding:'10px 14px', fontFamily:mono, fontSize:12, color:C.faint }}>{i+1}</td>
                        <td style={{ padding:'10px 14px', fontFamily:ui, fontSize:13, color:C.ink, fontWeight:600 }}>{u.display_name}</td>
                        <td style={{ padding:'10px 14px', fontFamily:mono, fontSize:11, color:C.dim }}>@{u.handle}</td>
                        <td style={{ padding:'10px 14px', fontFamily:mono, fontSize:13, color:C.jade, fontWeight:700 }}>{u.wins}</td>
                        <td style={{ padding:'10px 14px', fontFamily:mono, fontSize:13, color:C.garnet }}>{u.losses}</td>
                        <td style={{ padding:'10px 14px', fontFamily:mono, fontSize:13, color:C.gold }}>{u.level}</td>
                        <td style={{ padding:'10px 14px', fontFamily:ui, fontSize:11, color:C.dim }}>{u.rank}</td>
                        <td style={{ padding:'10px 14px', fontFamily:mono, fontSize:13, color:C.ink }}>{u.debates}</td>
                      </tr>
                    ))}
                    {topUsers.length === 0 && (
                      <tr><td colSpan={8} style={{ padding:'20px 14px', fontFamily:ui, fontSize:13, color:C.faint }}>No users yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* User growth table */}
              <SectionHead title={`Daily signups — last ${range} days`} />
              <div style={{ borderRadius:12, border:`1px solid ${C.hair}`, background:C.panel, overflow:'hidden' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom:`1px solid ${C.hair}` }}>
                      {['Date','Signups'].map(h => (
                        <th key={h} style={{ fontFamily:ui, fontSize:11, color:C.dim, fontWeight:700,
                          textAlign:'left', padding:'10px 14px', textTransform:'uppercase', letterSpacing:'.07em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...growth].reverse().map(r => (
                      <tr key={r.day} style={{ borderBottom:`1px solid ${C.hair}44` }}>
                        <td style={{ padding:'9px 14px', fontFamily:mono, fontSize:12, color:C.dim }}>{r.day}</td>
                        <td style={{ padding:'9px 14px', fontFamily:mono, fontSize:13, color:C.jade, fontWeight:700 }}>{r.signups}</td>
                      </tr>
                    ))}
                    {growth.length === 0 && (
                      <tr><td colSpan={2} style={{ padding:'20px 14px', fontFamily:ui, fontSize:13, color:C.faint }}>No signups in this range.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ── Debates ── */}
          {tab === 'debates' && (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:12, marginBottom:24 }}>
                <StatCard label="Total debates" value={fmt(summary.total_debates)} color={C.gold} />
                <StatCard label="Ended" value={summary.ended_debates} />
                <StatCard label="Live now" value={summary.live_debates} color={C.garnet} />
                <StatCard label="New (7 days)" value={summary.debates_7d} color={C.gold} />
                <StatCard label="Total votes" value={fmt(summary.total_votes)} />
                <StatCard label="Total chat" value={fmt(summary.total_chat)} />
              </div>

              <SectionHead title="Most-watched debates" />
              <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:24 }}>
                {topDebates.map((d, i) => (
                  <div key={d.id} style={{ padding:'13px 16px', borderRadius:10,
                    border:`1px solid ${C.hair}`, background:C.panel, display:'flex', alignItems:'center', gap:14 }}>
                    <div style={{ fontFamily:mono, fontSize:13, color:C.faint, flexShrink:0, width:20 }}>{i+1}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontFamily:ui, fontSize:14, fontWeight:600, color:C.ink,
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.motion}</div>
                      <div style={{ fontFamily:ui, fontSize:11, color:C.faint, marginTop:2 }}>
                        {new Date(d.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:16, flexShrink:0 }}>
                      <div style={{ textAlign:'center' }}>
                        <div style={{ fontFamily:mono, fontSize:14, fontWeight:700, color:C.ink }}>{d.viewer_count}</div>
                        <div style={{ fontFamily:ui, fontSize:9, color:C.faint, textTransform:'uppercase' }}>Views</div>
                      </div>
                      <div style={{ textAlign:'center' }}>
                        <div style={{ fontFamily:mono, fontSize:14, fontWeight:700, color:C.jade }}>{d.votes}</div>
                        <div style={{ fontFamily:ui, fontSize:9, color:C.faint, textTransform:'uppercase' }}>Votes</div>
                      </div>
                      <div style={{ textAlign:'center' }}>
                        <div style={{ fontFamily:mono, fontSize:14, fontWeight:700, color:C.gold }}>{d.chat}</div>
                        <div style={{ fontFamily:ui, fontSize:9, color:C.faint, textTransform:'uppercase' }}>Chat</div>
                      </div>
                      <span style={{ fontSize:10, fontWeight:800, padding:'3px 10px', borderRadius:20, alignSelf:'center',
                        background: d.status==='live' ? `${C.garnet}22` : `${C.jade}22`,
                        color: d.status==='live' ? C.garnet : C.jade,
                        textTransform:'uppercase', letterSpacing:'.07em' }}>{d.status}</span>
                    </div>
                  </div>
                ))}
                {topDebates.length === 0 && (
                  <div style={{ fontFamily:ui, fontSize:13, color:C.faint }}>No debates yet.</div>
                )}
              </div>

              {/* Debate activity table */}
              <SectionHead title={`Daily debate activity — last ${range} days`} />
              <div style={{ borderRadius:12, border:`1px solid ${C.hair}`, background:C.panel, overflow:'hidden' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom:`1px solid ${C.hair}` }}>
                      {['Date','Created','Ended'].map(h => (
                        <th key={h} style={{ fontFamily:ui, fontSize:11, color:C.dim, fontWeight:700,
                          textAlign:'left', padding:'10px 14px', textTransform:'uppercase', letterSpacing:'.07em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...activity].reverse().map(r => (
                      <tr key={r.day} style={{ borderBottom:`1px solid ${C.hair}44` }}>
                        <td style={{ padding:'9px 14px', fontFamily:mono, fontSize:12, color:C.dim }}>{r.day}</td>
                        <td style={{ padding:'9px 14px', fontFamily:mono, fontSize:13, color:C.gold, fontWeight:700 }}>{r.created}</td>
                        <td style={{ padding:'9px 14px', fontFamily:mono, fontSize:13, color:C.jade }}>{r.ended}</td>
                      </tr>
                    ))}
                    {activity.length === 0 && (
                      <tr><td colSpan={3} style={{ padding:'20px 14px', fontFamily:ui, fontSize:13, color:C.faint }}>No debates in this range.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ── Moderation ── */}
          {tab === 'moderation' && (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:12, marginBottom:24 }}>
                <StatCard label="Pending reports" value={summary.pending_reports} color={C.gold} />
                <StatCard label="Open appeals"    value={summary.open_appeals}    color={C.ember} />
                <StatCard label="Open tickets"    value={summary.open_tickets}    color={C.dim} />
                <StatCard label="Active bans"     value={summary.active_bans}     color={C.garnet} />
              </div>

              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <div style={{ fontFamily:display, fontSize:17, fontWeight:700, color:C.ink }}>Recent reports</div>
                <button onClick={() => nav('/moderation')}
                  style={{ background:'none', border:`1px solid ${C.hair}`, borderRadius:8,
                    fontFamily:ui, fontSize:12, color:C.gold, cursor:'pointer', padding:'6px 14px', fontWeight:600 }}>
                  Open moderation queue →
                </button>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {reports.map(r => (
                  <div key={r.id} style={{ padding:'11px 14px', borderRadius:10,
                    border:`1px solid ${C.hair}`, background:C.panel, display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontFamily:ui, fontSize:13, color:C.ink, fontWeight:500 }}>
                        {r.reason.replace(/_/g,' ')}
                        <span style={{ color:C.faint, fontWeight:400 }}> · {r.target_type.replace(/_/g,' ')}</span>
                      </div>
                      <div style={{ fontFamily:mono, fontSize:10, color:C.faint, marginTop:2 }}>
                        {new Date(r.created_at).toLocaleString()}
                      </div>
                    </div>
                    <span style={{ fontSize:10, fontWeight:800, padding:'2px 9px', borderRadius:20,
                      textTransform:'uppercase', letterSpacing:'.07em',
                      background:`${statusColor(r.status)}22`, color:statusColor(r.status), flexShrink:0 }}>
                      {r.status}
                    </span>
                  </div>
                ))}
                {reports.length === 0 && (
                  <div style={{ fontFamily:ui, fontSize:13, color:C.faint }}>No reports yet.</div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </Scroll>
  );
}
