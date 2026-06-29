// =====================================================================
// The Rostrum · AdminPortalScreen.tsx
// Owner-only business intelligence dashboard.
// Proper labeled charts via Recharts — axes, gridlines, tooltips, ticks.
// =====================================================================
import { useEffect, useState, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { C, ui, display, mono } from '../lib/theme';
import { Scroll } from '../components/ui';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';

// ── types ─────────────────────────────────────────────────────────────
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

// ── shared chart config ───────────────────────────────────────────────
const CHART_STYLE = {
  fontSize: 11,
  fontFamily: ui,
};
const GRID_COLOR  = `${C.hair}`;
const AXIS_COLOR  = C.faint;
const TIP_STYLE   = {
  background: C.panel,
  border: `1px solid ${C.hair}`,
  borderRadius: 8,
  fontFamily: ui,
  fontSize: 12,
  color: C.ink,
};

// Shorten date labels: "2026-06-24" → "Jun 24"
function fmtDay(d: string) {
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric' });
  } catch { return d; }
}

// ── stat card ─────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }: {
  label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div style={{ borderRadius:12, border:`1px solid ${C.hair}`, background:C.panel,
      padding:'18px 20px', display:'flex', flexDirection:'column', gap:4, minWidth:0 }}>
      <div style={{ fontFamily:ui, fontSize:11, fontWeight:700, color:C.dim,
        textTransform:'uppercase', letterSpacing:'.09em' }}>{label}</div>
      <div style={{ fontFamily:display, fontSize:30, fontWeight:800, color: color ?? C.ink, lineHeight:1.1 }}>
        {value}
      </div>
      {sub && <div style={{ fontFamily:ui, fontSize:11, color:C.faint }}>{sub}</div>}
    </div>
  );
}

// ── section header ────────────────────────────────────────────────────
function SectionHead({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
      <div style={{ fontFamily:display, fontSize:17, fontWeight:700, color:C.ink }}>{title}</div>
      {action && (
        <button onClick={onAction} style={{ background:'none', border:'none', fontFamily:ui,
          fontSize:12, color:C.gold, cursor:'pointer', fontWeight:600 }}>{action}</button>
      )}
    </div>
  );
}

// ── chart wrapper ─────────────────────────────────────────────────────
function ChartCard({ title, children, height = 240 }: { title: string; children: React.ReactNode; height?: number }) {
  return (
    <div style={{ borderRadius:12, border:`1px solid ${C.hair}`, background:C.panel,
      padding:'18px 18px 10px', marginBottom:24 }}>
      <div style={{ fontFamily:ui, fontSize:12, fontWeight:700, color:C.dim,
        textTransform:'uppercase', letterSpacing:'.09em', marginBottom:14 }}>{title}</div>
      <div style={{ height }}>{children}</div>
    </div>
  );
}

// ── empty chart placeholder ───────────────────────────────────────────
function EmptyChart({ msg = 'No data in this range' }: { msg?: string }) {
  return (
    <div style={{ height:'100%', display:'grid', placeItems:'center',
      fontFamily:ui, fontSize:13, color:C.faint }}>{msg}</div>
  );
}

const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
const cents = (c: number) => `$${(c / 100).toFixed(2)}`;
const statusColor = (s: string) =>
  s === 'pending' ? C.gold : s === 'actioned' ? C.garnet : s === 'dismissed' ? C.jade : C.faint;

// ── main component ────────────────────────────────────────────────────
export function AdminPortalScreen() {
  const nav = useNavigate();
  const [summary, setSummary]       = useState<Summary | null>(null);
  const [growth, setGrowth]         = useState<GrowthRow[]>([]);
  const [activity, setActivity]     = useState<DebateRow[]>([]);
  const [topUsers, setTopUsers]     = useState<TopUser[]>([]);
  const [topDebates, setTopDebates] = useState<TopDebate[]>([]);
  const [reports, setReports]       = useState<ReportRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [range, setRange]           = useState(30);
  const [tab, setTab]               = useState<'overview' | 'users' | 'debates' | 'moderation'>('overview');
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, g, a, u, d, r] = await Promise.all([
        supabase.rpc('admin_summary'),
        supabase.rpc('admin_user_growth',    { p_days: range }),
        supabase.rpc('admin_debate_activity',{ p_days: range }),
        supabase.rpc('admin_top_users',      { p_limit: 10 }),
        supabase.rpc('admin_top_debates',    { p_limit: 10 }),
        supabase.rpc('admin_recent_reports', { p_limit: 20 }),
      ]);
      if (s.data) setSummary(s.data as Summary);
      if (g.data) setGrowth(g.data as GrowthRow[]);
      if (a.data) setActivity(a.data as DebateRow[]);
      if (u.data) setTopUsers(u.data as TopUser[]);
      if (d.data) setTopDebates(d.data as TopDebate[]);
      if (r.data) setReports(r.data as ReportRow[]);
      setLastRefresh(new Date());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const RangeChip = ({ v, label }: { v: number; label: string }) => (
    <button onClick={() => setRange(v)}
      style={{ padding:'5px 14px', borderRadius:20, border:`1px solid ${range===v ? C.gold : C.hair}`,
        background: range===v ? `${C.gold}18`:'transparent', color: range===v ? C.gold:C.dim,
        fontFamily:ui, fontSize:12, fontWeight:range===v?700:400, cursor:'pointer' }}>
      {label}
    </button>
  );

  const TabChip = ({ t, label }: { t: typeof tab; label: string }) => (
    <button onClick={() => setTab(t)}
      style={{ padding:'7px 18px', borderRadius:20, border:`1px solid ${tab===t ? C.gold : C.hair}`,
        background: tab===t ? `${C.gold}18`:'transparent', color: tab===t ? C.gold:C.dim,
        fontFamily:ui, fontSize:13, fontWeight:tab===t?700:400, cursor:'pointer' }}>
      {label}
    </button>
  );

  // Prepare chart data — fill missing days so x-axis is continuous
  const growthChart  = growth.map(r => ({ ...r, day: fmtDay(r.day) }));
  const activityChart = activity.map(r => ({ ...r, day: fmtDay(r.day) }));

  return (
    <Scroll style={{ padding:'28px 24px', maxWidth:1000, margin:'0 auto' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between',
        marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontFamily:display, fontSize:28, fontWeight:800, color:C.ink, marginBottom:2 }}>
            Admin Portal
          </div>
          <div style={{ fontFamily:ui, fontSize:12, color:C.faint }}>
            Last updated: {lastRefresh.toLocaleTimeString()}
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <RangeChip v={7}  label="7 days" />
          <RangeChip v={30} label="30 days" />
          <RangeChip v={90} label="90 days" />
          <button onClick={load} style={{ padding:'6px 14px', borderRadius:20,
            border:`1px solid ${C.hair}`, background:'transparent', color:C.dim,
            fontFamily:ui, fontSize:12, cursor:'pointer' }}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:8, marginBottom:28, flexWrap:'wrap' }}>
        <TabChip t="overview"   label="Overview" />
        <TabChip t="users"      label="Users" />
        <TabChip t="debates"    label="Debates" />
        <TabChip t="moderation" label="Moderation" />
      </div>

      {loading && (
        <div style={{ textAlign:'center', padding:'60px 0', fontFamily:ui, fontSize:13, color:C.faint }}>
          Loading…
        </div>
      )}

      {!loading && summary && (
        <>
          {/* ══════════ OVERVIEW ══════════ */}
          {tab === 'overview' && (
            <>
              {/* KPI cards */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))',
                gap:12, marginBottom:28 }}>
                <StatCard label="Total users"    value={fmt(summary.total_users)}
                  sub={`+${summary.new_users_7d} this week`}  color={C.jade} />
                <StatCard label="Total debates"  value={fmt(summary.total_debates)}
                  sub={`+${summary.debates_7d} this week`}    color={C.gold} />
                <StatCard label="Live now"        value={summary.live_debates}        color={C.garnet} />
                <StatCard label="Votes cast"      value={fmt(summary.total_votes)} />
                <StatCard label="Chat messages"   value={fmt(summary.total_chat)} />
                <StatCard label="Gifts sent"      value={fmt(summary.total_gifts)}
                  sub={cents(summary.gifts_value_cents) + ' value'} color={C.gold} />
              </div>

              {/* User growth area chart */}
              <ChartCard title={`User signups — last ${range} days`} height={260}>
                {growthChart.length === 0 ? <EmptyChart /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={growthChart} margin={{ top:8, right:16, left:0, bottom:0 }}>
                      <defs>
                        <linearGradient id="jadeGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={C.jade} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={C.jade} stopOpacity={0.03} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                      <XAxis dataKey="day" tick={{ ...CHART_STYLE, fill:AXIS_COLOR }}
                        tickLine={false} axisLine={{ stroke:GRID_COLOR }}
                        interval="preserveStartEnd" />
                      <YAxis allowDecimals={false} tick={{ ...CHART_STYLE, fill:AXIS_COLOR }}
                        tickLine={false} axisLine={false} width={32} />
                      <Tooltip contentStyle={TIP_STYLE}
                        formatter={(v: number) => [v, 'Signups']} />
                      <Area type="monotone" dataKey="signups" stroke={C.jade} strokeWidth={2}
                        fill="url(#jadeGrad)" dot={{ r:3, fill:C.jade, strokeWidth:0 }}
                        activeDot={{ r:5, fill:C.jade }} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              {/* Debate activity bar chart */}
              <ChartCard title={`Debates created & ended — last ${range} days`} height={260}>
                {activityChart.length === 0 ? <EmptyChart /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={activityChart} margin={{ top:8, right:16, left:0, bottom:0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                      <XAxis dataKey="day" tick={{ ...CHART_STYLE, fill:AXIS_COLOR }}
                        tickLine={false} axisLine={{ stroke:GRID_COLOR }}
                        interval="preserveStartEnd" />
                      <YAxis allowDecimals={false} tick={{ ...CHART_STYLE, fill:AXIS_COLOR }}
                        tickLine={false} axisLine={false} width={32} />
                      <Tooltip contentStyle={TIP_STYLE} />
                      <Legend iconType="square" wrapperStyle={{ ...CHART_STYLE, paddingTop:8 }} />
                      <Bar dataKey="created" name="Created" fill={C.gold}    radius={[3,3,0,0]} maxBarSize={28} />
                      <Bar dataKey="ended"   name="Ended"   fill={C.jade}    radius={[3,3,0,0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              {/* Moderation flags */}
              <SectionHead title="Moderation flags" action="Open queue →" onAction={() => setTab('moderation')} />
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:10 }}>
                {[
                  { label:'Pending reports', value:summary.pending_reports, color:C.gold },
                  { label:'Open appeals',    value:summary.open_appeals,    color:C.ember },
                  { label:'Open tickets',    value:summary.open_tickets,    color:C.dim },
                  { label:'Active bans',     value:summary.active_bans,     color:C.garnet },
                ].map(s => <StatCard key={s.label} {...s} />)}
              </div>
            </>
          )}

          {/* ══════════ USERS ══════════ */}
          {tab === 'users' && (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',
                gap:12, marginBottom:24 }}>
                <StatCard label="Total users"    value={fmt(summary.total_users)} color={C.jade} />
                <StatCard label="New (7 days)"   value={summary.new_users_7d}     color={C.jade} />
                <StatCard label="New (30 days)"  value={summary.new_users_30d} />
              </div>

              {/* Growth area chart */}
              <ChartCard title={`Daily signups — last ${range} days`} height={260}>
                {growthChart.length === 0 ? <EmptyChart /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={growthChart} margin={{ top:8, right:16, left:0, bottom:0 }}>
                      <defs>
                        <linearGradient id="jadeGrad2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={C.jade} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={C.jade} stopOpacity={0.03} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                      <XAxis dataKey="day" tick={{ ...CHART_STYLE, fill:AXIS_COLOR }}
                        tickLine={false} axisLine={{ stroke:GRID_COLOR }}
                        interval="preserveStartEnd" />
                      <YAxis allowDecimals={false} tick={{ ...CHART_STYLE, fill:AXIS_COLOR }}
                        tickLine={false} axisLine={false} width={32} />
                      <Tooltip contentStyle={TIP_STYLE}
                        formatter={(v: number) => [v, 'Signups']}
                        labelFormatter={(l) => `Date: ${l}`} />
                      <Area type="monotone" dataKey="signups" name="Signups" stroke={C.jade} strokeWidth={2}
                        fill="url(#jadeGrad2)" dot={{ r:3, fill:C.jade, strokeWidth:0 }}
                        activeDot={{ r:5, fill:C.jade }} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              {/* Top users table */}
              <SectionHead title="Top debaters by wins" />
              <div style={{ borderRadius:12, border:`1px solid ${C.hair}`, background:C.panel,
                overflow:'hidden', marginBottom:24 }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom:`1px solid ${C.hair}` }}>
                      {['#','Name','Handle','Wins','Losses','W/L','Level','Rank','Debates'].map(h => (
                        <th key={h} style={{ fontFamily:ui, fontSize:10, color:C.dim, fontWeight:700,
                          textAlign:'left', padding:'10px 12px', textTransform:'uppercase', letterSpacing:'.07em',
                          whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {topUsers.map((u, i) => {
                      const total = u.wins + u.losses || 1;
                      const wr = Math.round((u.wins / total) * 100);
                      return (
                        <tr key={u.id} style={{ borderBottom:`1px solid ${C.hair}44` }}>
                          <td style={{ padding:'9px 12px', fontFamily:mono, fontSize:11, color:C.faint }}>{i+1}</td>
                          <td style={{ padding:'9px 12px', fontFamily:ui, fontSize:13, color:C.ink, fontWeight:600, whiteSpace:'nowrap' }}>{u.display_name}</td>
                          <td style={{ padding:'9px 12px', fontFamily:mono, fontSize:11, color:C.dim }}>@{u.handle}</td>
                          <td style={{ padding:'9px 12px', fontFamily:mono, fontSize:13, color:C.jade, fontWeight:700 }}>{u.wins}</td>
                          <td style={{ padding:'9px 12px', fontFamily:mono, fontSize:13, color:C.garnet }}>{u.losses}</td>
                          <td style={{ padding:'9px 12px', fontFamily:mono, fontSize:12, color:C.dim }}>{wr}%</td>
                          <td style={{ padding:'9px 12px', fontFamily:mono, fontSize:13, color:C.gold }}>{u.level}</td>
                          <td style={{ padding:'9px 12px', fontFamily:ui, fontSize:11, color:C.faint, whiteSpace:'nowrap' }}>{u.rank}</td>
                          <td style={{ padding:'9px 12px', fontFamily:mono, fontSize:13, color:C.ink }}>{u.debates}</td>
                        </tr>
                      );
                    })}
                    {topUsers.length === 0 && (
                      <tr><td colSpan={9} style={{ padding:'20px 12px', fontFamily:ui, fontSize:13, color:C.faint }}>No users yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ══════════ DEBATES ══════════ */}
          {tab === 'debates' && (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',
                gap:12, marginBottom:24 }}>
                <StatCard label="Total"      value={fmt(summary.total_debates)} color={C.gold} />
                <StatCard label="Ended"      value={summary.ended_debates} />
                <StatCard label="Live now"   value={summary.live_debates}       color={C.garnet} />
                <StatCard label="New (7d)"   value={summary.debates_7d}         color={C.gold} />
                <StatCard label="Votes cast" value={fmt(summary.total_votes)} />
                <StatCard label="Chat msgs"  value={fmt(summary.total_chat)} />
              </div>

              {/* Debate activity chart */}
              <ChartCard title={`Daily debate activity — last ${range} days`} height={260}>
                {activityChart.length === 0 ? <EmptyChart /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={activityChart} margin={{ top:8, right:16, left:0, bottom:0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                      <XAxis dataKey="day" tick={{ ...CHART_STYLE, fill:AXIS_COLOR }}
                        tickLine={false} axisLine={{ stroke:GRID_COLOR }}
                        interval="preserveStartEnd" />
                      <YAxis allowDecimals={false} tick={{ ...CHART_STYLE, fill:AXIS_COLOR }}
                        tickLine={false} axisLine={false} width={32} />
                      <Tooltip contentStyle={TIP_STYLE}
                        labelFormatter={(l) => `Date: ${l}`} />
                      <Legend iconType="square" wrapperStyle={{ ...CHART_STYLE, paddingTop:8 }} />
                      <Bar dataKey="created" name="Created" fill={C.gold} radius={[3,3,0,0]} maxBarSize={28} />
                      <Bar dataKey="ended"   name="Ended"   fill={C.jade} radius={[3,3,0,0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              {/* Top debates */}
              <SectionHead title="Most-watched debates" />
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {topDebates.map((d, i) => (
                  <div key={d.id} style={{ padding:'13px 16px', borderRadius:10,
                    border:`1px solid ${C.hair}`, background:C.panel, display:'flex', alignItems:'center', gap:14 }}>
                    <div style={{ fontFamily:mono, fontSize:13, color:C.faint, flexShrink:0, width:22 }}>{i+1}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontFamily:ui, fontSize:14, fontWeight:600, color:C.ink,
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.motion}</div>
                      <div style={{ fontFamily:ui, fontSize:11, color:C.faint, marginTop:2 }}>
                        {new Date(d.created_at).toLocaleDateString('en-US',{ month:'short', day:'numeric', year:'numeric' })}
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:18, flexShrink:0 }}>
                      {[
                        { v:d.viewer_count, label:'Views',  c:C.ink },
                        { v:d.votes,        label:'Votes',  c:C.jade },
                        { v:d.chat,         label:'Chat',   c:C.gold },
                      ].map(({ v, label, c }) => (
                        <div key={label} style={{ textAlign:'center' }}>
                          <div style={{ fontFamily:mono, fontSize:15, fontWeight:700, color:c }}>{fmt(v)}</div>
                          <div style={{ fontFamily:ui, fontSize:9, color:C.faint, textTransform:'uppercase', letterSpacing:'.05em' }}>{label}</div>
                        </div>
                      ))}
                      <span style={{ fontSize:10, fontWeight:800, padding:'3px 10px', borderRadius:20, alignSelf:'center',
                        background: d.status==='live'?`${C.garnet}22`:`${C.jade}22`,
                        color: d.status==='live'?C.garnet:C.jade,
                        textTransform:'uppercase', letterSpacing:'.07em', whiteSpace:'nowrap' }}>
                        {d.status}
                      </span>
                    </div>
                  </div>
                ))}
                {topDebates.length === 0 && (
                  <div style={{ fontFamily:ui, fontSize:13, color:C.faint }}>No debates yet.</div>
                )}
              </div>
            </>
          )}

          {/* ══════════ MODERATION ══════════ */}
          {tab === 'moderation' && (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',
                gap:12, marginBottom:24 }}>
                <StatCard label="Pending reports" value={summary.pending_reports} color={C.gold} />
                <StatCard label="Open appeals"    value={summary.open_appeals}    color={C.ember} />
                <StatCard label="Open tickets"    value={summary.open_tickets}    color={C.dim} />
                <StatCard label="Active bans"     value={summary.active_bans}     color={C.garnet} />
              </div>

              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                <div style={{ fontFamily:display, fontSize:17, fontWeight:700, color:C.ink }}>Recent reports</div>
                <button onClick={() => nav('/moderation')}
                  style={{ background:'none', border:`1px solid ${C.hair}`, borderRadius:8,
                    fontFamily:ui, fontSize:12, color:C.gold, cursor:'pointer', padding:'6px 14px', fontWeight:600 }}>
                  Open full queue →
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
                        {new Date(r.created_at).toLocaleString('en-US',{
                          month:'short', day:'numeric', hour:'numeric', minute:'2-digit'
                        })}
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
