// =====================================================================
// The Rostrum · AdminPortalScreen.tsx
// Owner-only business intelligence dashboard.
// Charts are hand-built SVG (no external deps) WITH labeled axes,
// date ticks, gridlines, value labels, and hover tooltips.
// =====================================================================
import { useEffect, useState, useCallback, useRef } from 'react';
import { C, ui, display, mono, a } from '../lib/theme';
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

const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
const cents = (c: number) => `$${(c / 100).toFixed(2)}`;
const statusColor = (s: string) =>
  s === 'pending' ? C.gold : s === 'actioned' ? C.garnet : s === 'dismissed' ? C.jade : C.faint;

function fmtDay(d: string) {
  try { return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
  catch { return d; }
}

// "nice" axis max + step so Y ticks are round numbers
function niceScale(max: number, ticks = 4) {
  if (max <= 0) return { max: ticks, step: 1 };
  const rawStep = max / ticks;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  const niceStep = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const niceMax = Math.ceil(max / niceStep) * niceStep;
  return { max: niceMax, step: niceStep };
}

// ── reusable SVG line/area chart with axes ────────────────────────────
function LineChart({ data, color, label }: {
  data: { x: string; y: number }[]; color: string; label: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 760, H = 240;
  const padL = 40, padR = 16, padT = 14, padB = 34;
  const plotW = W - padL - padR, plotH = H - padT - padB;

  if (data.length === 0) {
    return <div style={{ height: H, display: 'grid', placeItems: 'center', fontFamily: ui, fontSize: 13, color: C.faint }}>No data in this range</div>;
  }

  const maxY = Math.max(...data.map(d => d.y), 1);
  const { max: yMax, step: yStep } = niceScale(maxY);
  const yTicks: number[] = [];
  for (let v = 0; v <= yMax; v += yStep) yTicks.push(v);

  const xFor = (i: number) => padL + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
  const yFor = (v: number) => padT + plotH - (v / yMax) * plotH;

  const linePts = data.map((d, i) => `${xFor(i)},${yFor(d.y)}`).join(' ');
  const areaPts = `${padL},${padT + plotH} ${linePts} ${padL + plotW},${padT + plotH}`;

  // X tick density: show ~6 labels max
  const xEvery = Math.max(1, Math.ceil(data.length / 6));

  return (
    <div style={{ position: 'relative' }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'visible' }}
        onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {/* Y gridlines + labels */}
        {yTicks.map(v => (
          <g key={v}>
            <line x1={padL} y1={yFor(v)} x2={padL + plotW} y2={yFor(v)} stroke={C.hair} strokeWidth={1} strokeDasharray="3 3" />
            <text x={padL - 8} y={yFor(v) + 3} textAnchor="end"
              fontFamily={mono} fontSize={10} fill={C.faint}>{v}</text>
          </g>
        ))}

        {/* area + line */}
        <polygon points={areaPts} fill={`url(#grad-${label})`} />
        <polyline points={linePts} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

        {/* points + X labels */}
        {data.map((d, i) => (
          <g key={i}>
            <circle cx={xFor(i)} cy={yFor(d.y)} r={hover === i ? 5 : 3} fill={color}
              stroke={C.base} strokeWidth={hover === i ? 2 : 0} />
            {/* invisible wide hit area */}
            <rect x={xFor(i) - (plotW / data.length) / 2} y={padT} width={plotW / data.length} height={plotH}
              fill="transparent" onMouseEnter={() => setHover(i)} />
            {(i % xEvery === 0 || i === data.length - 1) && (
              <text x={xFor(i)} y={H - 12} textAnchor="middle" fontFamily={mono} fontSize={10} fill={C.faint}>
                {fmtDay(d.x)}
              </text>
            )}
          </g>
        ))}

        {/* hover tooltip */}
        {hover !== null && (
          <g>
            <line x1={xFor(hover)} y1={padT} x2={xFor(hover)} y2={padT + plotH} stroke={color} strokeWidth={1} strokeOpacity={0.4} />
            <g transform={`translate(${Math.min(Math.max(xFor(hover), padL + 50), padL + plotW - 50)}, ${padT + 8})`}>
              <rect x={-48} y={0} width={96} height={38} rx={6} fill={C.panel2 ?? C.panel} stroke={C.hair} />
              <text x={0} y={15} textAnchor="middle" fontFamily={ui} fontSize={10} fill={C.faint}>{fmtDay(data[hover].x)}</text>
              <text x={0} y={30} textAnchor="middle" fontFamily={display} fontSize={14} fontWeight="700" fill={color}>
                {data[hover].y} {label}
              </text>
            </g>
          </g>
        )}
      </svg>
    </div>
  );
}

// ── grouped bar chart with axes ───────────────────────────────────────
function BarChart({ data, series }: {
  data: { x: string;[k: string]: string | number }[];
  series: { key: string; label: string; color: string }[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 760, H = 240;
  const padL = 40, padR = 16, padT = 14, padB = 34;
  const plotW = W - padL - padR, plotH = H - padT - padB;

  if (data.length === 0) {
    return <div style={{ height: H, display: 'grid', placeItems: 'center', fontFamily: ui, fontSize: 13, color: C.faint }}>No data in this range</div>;
  }

  const maxY = Math.max(...data.flatMap(d => series.map(s => Number(d[s.key]) || 0)), 1);
  const { max: yMax, step: yStep } = niceScale(maxY);
  const yTicks: number[] = [];
  for (let v = 0; v <= yMax; v += yStep) yTicks.push(v);

  const groupW = plotW / data.length;
  const barW = Math.min(18, (groupW * 0.6) / series.length);
  const yFor = (v: number) => padT + plotH - (v / yMax) * plotH;
  const xEvery = Math.max(1, Math.ceil(data.length / 6));

  return (
    <div style={{ position: 'relative' }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'visible' }}
        onMouseLeave={() => setHover(null)}>
        {/* Y gridlines + labels */}
        {yTicks.map(v => (
          <g key={v}>
            <line x1={padL} y1={yFor(v)} x2={padL + plotW} y2={yFor(v)} stroke={C.hair} strokeWidth={1} strokeDasharray="3 3" />
            <text x={padL - 8} y={yFor(v) + 3} textAnchor="end" fontFamily={mono} fontSize={10} fill={C.faint}>{v}</text>
          </g>
        ))}

        {/* bars */}
        {data.map((d, i) => {
          const cx = padL + i * groupW + groupW / 2;
          const totalW = barW * series.length + 2 * (series.length - 1);
          return (
            <g key={i}>
              <rect x={padL + i * groupW} y={padT} width={groupW} height={plotH}
                fill={hover === i ? C.hair : 'transparent'} fillOpacity={0.3}
                onMouseEnter={() => setHover(i)} />
              {series.map((s, si) => {
                const v = Number(d[s.key]) || 0;
                const bx = cx - totalW / 2 + si * (barW + 2);
                const bh = (v / yMax) * plotH;
                return <rect key={s.key} x={bx} y={padT + plotH - bh} width={barW} height={bh}
                  rx={2} fill={s.color} />;
              })}
              {(i % xEvery === 0 || i === data.length - 1) && (
                <text x={cx} y={H - 12} textAnchor="middle" fontFamily={mono} fontSize={10} fill={C.faint}>
                  {fmtDay(String(d.x))}
                </text>
              )}
            </g>
          );
        })}

        {/* hover tooltip */}
        {hover !== null && (
          <g transform={`translate(${Math.min(Math.max(padL + hover * groupW + groupW / 2, padL + 55), padL + plotW - 55)}, ${padT + 6})`}>
            <rect x={-52} y={0} width={104} height={20 + series.length * 15} rx={6} fill={C.panel2 ?? C.panel} stroke={C.hair} />
            <text x={0} y={14} textAnchor="middle" fontFamily={ui} fontSize={10} fill={C.faint}>{fmtDay(String(data[hover].x))}</text>
            {series.map((s, si) => (
              <text key={s.key} x={0} y={30 + si * 15} textAnchor="middle" fontFamily={ui} fontSize={11} fontWeight="700" fill={s.color}>
                {s.label}: {Number(data[hover][s.key]) || 0}
              </text>
            ))}
          </g>
        )}
      </svg>
    </div>
  );
}

// ── small UI helpers ──────────────────────────────────────────────────
function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ borderRadius: 12, border: `1px solid ${C.hair}`, background: C.panel, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <div style={{ fontFamily: ui, fontSize: 11, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '.09em' }}>{label}</div>
      <div style={{ fontFamily: display, fontSize: 30, fontWeight: 800, color: color ?? C.ink, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontFamily: ui, fontSize: 11, color: C.faint }}>{sub}</div>}
    </div>
  );
}
function SectionHead({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <div style={{ fontFamily: display, fontSize: 17, fontWeight: 700, color: C.ink }}>{title}</div>
      {action && <button onClick={onAction} style={{ background: 'none', border: 'none', fontFamily: ui, fontSize: 12, color: C.gold, cursor: 'pointer', fontWeight: 600 }}>{action}</button>}
    </div>
  );
}
function ChartCard({ title, legend, children }: { title: string; legend?: { label: string; color: string }[]; children: React.ReactNode }) {
  return (
    <div style={{ borderRadius: 12, border: `1px solid ${C.hair}`, background: C.panel, padding: '18px 18px 12px', marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontFamily: ui, fontSize: 12, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '.09em' }}>{title}</div>
        {legend && (
          <div style={{ display: 'flex', gap: 14 }}>
            {legend.map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
                <span style={{ fontFamily: ui, fontSize: 11, color: C.dim }}>{l.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

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
        supabase.rpc('admin_user_growth', { p_days: range }),
        supabase.rpc('admin_debate_activity', { p_days: range }),
        supabase.rpc('admin_top_users', { p_limit: 10 }),
        supabase.rpc('admin_top_debates', { p_limit: 10 }),
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
    <button onClick={() => setRange(v)} style={{ padding: '5px 14px', borderRadius: 20, border: `1px solid ${range === v ? C.gold : C.hair}`, background: range === v ? `${a(C.gold,'18')}` : 'transparent', color: range === v ? C.gold : C.dim, fontFamily: ui, fontSize: 12, fontWeight: range === v ? 700 : 400, cursor: 'pointer' }}>{label}</button>
  );
  const TabChip = ({ t, label }: { t: typeof tab; label: string }) => (
    <button onClick={() => setTab(t)} style={{ padding: '7px 18px', borderRadius: 20, border: `1px solid ${tab === t ? C.gold : C.hair}`, background: tab === t ? `${a(C.gold,'18')}` : 'transparent', color: tab === t ? C.gold : C.dim, fontFamily: ui, fontSize: 13, fontWeight: tab === t ? 700 : 400, cursor: 'pointer' }}>{label}</button>
  );

  const growthData   = growth.map(r => ({ x: r.day, y: r.signups }));
  const activityData = activity.map(r => ({ x: r.day, created: r.created, ended: r.ended }));

  return (
    <Scroll style={{ padding: '28px 24px', maxWidth: 1000, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: display, fontSize: 28, fontWeight: 800, color: C.ink, marginBottom: 2 }}>Admin Portal</div>
          <div style={{ fontFamily: ui, fontSize: 12, color: C.faint }}>Last updated: {lastRefresh.toLocaleTimeString()}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <RangeChip v={7} label="7 days" />
          <RangeChip v={30} label="30 days" />
          <RangeChip v={90} label="90 days" />
          <button onClick={load} style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${C.hair}`, background: 'transparent', color: C.dim, fontFamily: ui, fontSize: 12, cursor: 'pointer' }}>↻ Refresh</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
        <TabChip t="overview" label="Overview" />
        <TabChip t="users" label="Users" />
        <TabChip t="debates" label="Debates" />
        <TabChip t="moderation" label="Moderation" />
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '60px 0', fontFamily: ui, fontSize: 13, color: C.faint }}>Loading…</div>}

      {!loading && summary && (
        <>
          {/* OVERVIEW */}
          {tab === 'overview' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 12, marginBottom: 28 }}>
                <StatCard label="Total users" value={fmt(summary.total_users)} sub={`+${summary.new_users_7d} this week`} color={C.jade} />
                <StatCard label="Total debates" value={fmt(summary.total_debates)} sub={`+${summary.debates_7d} this week`} color={C.gold} />
                <StatCard label="Live now" value={summary.live_debates} color={C.garnet} />
                <StatCard label="Votes cast" value={fmt(summary.total_votes)} />
                <StatCard label="Chat messages" value={fmt(summary.total_chat)} />
                <StatCard label="Gifts sent" value={fmt(summary.total_gifts)} sub={cents(summary.gifts_value_cents) + ' value'} color={C.gold} />
              </div>

              <ChartCard title={`User signups — last ${range} days`}>
                <LineChart data={growthData} color={C.jade} label="signups" />
              </ChartCard>

              <ChartCard title={`Debates created & ended — last ${range} days`}
                legend={[{ label: 'Created', color: C.gold }, { label: 'Ended', color: C.jade }]}>
                <BarChart data={activityData} series={[{ key: 'created', label: 'Created', color: C.gold }, { key: 'ended', label: 'Ended', color: C.jade }]} />
              </ChartCard>

              <SectionHead title="Moderation flags" action="Open queue →" onAction={() => setTab('moderation')} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10 }}>
                {[
                  { label: 'Pending reports', value: summary.pending_reports, color: C.gold },
                  { label: 'Open appeals', value: summary.open_appeals, color: C.ember },
                  { label: 'Open tickets', value: summary.open_tickets, color: C.dim },
                  { label: 'Active bans', value: summary.active_bans, color: C.garnet },
                ].map(s => <StatCard key={s.label} {...s} />)}
              </div>
            </>
          )}

          {/* USERS */}
          {tab === 'users' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12, marginBottom: 24 }}>
                <StatCard label="Total users" value={fmt(summary.total_users)} color={C.jade} />
                <StatCard label="New (7 days)" value={summary.new_users_7d} color={C.jade} />
                <StatCard label="New (30 days)" value={summary.new_users_30d} />
              </div>
              <ChartCard title={`Daily signups — last ${range} days`}>
                <LineChart data={growthData} color={C.jade} label="signups" />
              </ChartCard>
              <SectionHead title="Top debaters by wins" />
              <div style={{ borderRadius: 12, border: `1px solid ${C.hair}`, background: C.panel, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.hair}` }}>
                      {['#', 'Name', 'Handle', 'Wins', 'Losses', 'W/L', 'Level', 'Rank', 'Debates'].map(h => (
                        <th key={h} style={{ fontFamily: ui, fontSize: 10, color: C.dim, fontWeight: 700, textAlign: 'left', padding: '10px 12px', textTransform: 'uppercase', letterSpacing: '.07em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {topUsers.map((u, i) => {
                      const total = u.wins + u.losses || 1;
                      const wr = Math.round((u.wins / total) * 100);
                      return (
                        <tr key={u.id} style={{ borderBottom: `1px solid ${a(C.hair,'44')}` }}>
                          <td style={{ padding: '9px 12px', fontFamily: mono, fontSize: 11, color: C.faint }}>{i + 1}</td>
                          <td style={{ padding: '9px 12px', fontFamily: ui, fontSize: 13, color: C.ink, fontWeight: 600, whiteSpace: 'nowrap' }}>{u.display_name}</td>
                          <td style={{ padding: '9px 12px', fontFamily: mono, fontSize: 11, color: C.dim }}>@{u.handle}</td>
                          <td style={{ padding: '9px 12px', fontFamily: mono, fontSize: 13, color: C.jade, fontWeight: 700 }}>{u.wins}</td>
                          <td style={{ padding: '9px 12px', fontFamily: mono, fontSize: 13, color: C.garnet }}>{u.losses}</td>
                          <td style={{ padding: '9px 12px', fontFamily: mono, fontSize: 12, color: C.dim }}>{wr}%</td>
                          <td style={{ padding: '9px 12px', fontFamily: mono, fontSize: 13, color: C.gold }}>{u.level}</td>
                          <td style={{ padding: '9px 12px', fontFamily: ui, fontSize: 11, color: C.faint, whiteSpace: 'nowrap' }}>{u.rank}</td>
                          <td style={{ padding: '9px 12px', fontFamily: mono, fontSize: 13, color: C.ink }}>{u.debates}</td>
                        </tr>
                      );
                    })}
                    {topUsers.length === 0 && <tr><td colSpan={9} style={{ padding: '20px 12px', fontFamily: ui, fontSize: 13, color: C.faint }}>No users yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* DEBATES */}
          {tab === 'debates' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12, marginBottom: 24 }}>
                <StatCard label="Total" value={fmt(summary.total_debates)} color={C.gold} />
                <StatCard label="Ended" value={summary.ended_debates} />
                <StatCard label="Live now" value={summary.live_debates} color={C.garnet} />
                <StatCard label="New (7d)" value={summary.debates_7d} color={C.gold} />
                <StatCard label="Votes cast" value={fmt(summary.total_votes)} />
                <StatCard label="Chat msgs" value={fmt(summary.total_chat)} />
              </div>
              <ChartCard title={`Daily debate activity — last ${range} days`}
                legend={[{ label: 'Created', color: C.gold }, { label: 'Ended', color: C.jade }]}>
                <BarChart data={activityData} series={[{ key: 'created', label: 'Created', color: C.gold }, { key: 'ended', label: 'Ended', color: C.jade }]} />
              </ChartCard>
              <SectionHead title="Most-watched debates" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {topDebates.map((d, i) => (
                  <div key={d.id} style={{ padding: '13px 16px', borderRadius: 10, border: `1px solid ${C.hair}`, background: C.panel, display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ fontFamily: mono, fontSize: 13, color: C.faint, flexShrink: 0, width: 22 }}>{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: ui, fontSize: 14, fontWeight: 600, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.motion}</div>
                      <div style={{ fontFamily: ui, fontSize: 11, color: C.faint, marginTop: 2 }}>{new Date(d.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 18, flexShrink: 0 }}>
                      {[{ v: d.viewer_count, label: 'Views', c: C.ink }, { v: d.votes, label: 'Votes', c: C.jade }, { v: d.chat, label: 'Chat', c: C.gold }].map(({ v, label, c }) => (
                        <div key={label} style={{ textAlign: 'center' }}>
                          <div style={{ fontFamily: mono, fontSize: 15, fontWeight: 700, color: c }}>{fmt(v)}</div>
                          <div style={{ fontFamily: ui, fontSize: 9, color: C.faint, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
                        </div>
                      ))}
                      <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20, alignSelf: 'center', background: d.status === 'live' ? `${a(C.garnet,'22')}` : `${a(C.jade,'22')}`, color: d.status === 'live' ? C.garnet : C.jade, textTransform: 'uppercase', letterSpacing: '.07em', whiteSpace: 'nowrap' }}>{d.status}</span>
                    </div>
                  </div>
                ))}
                {topDebates.length === 0 && <div style={{ fontFamily: ui, fontSize: 13, color: C.faint }}>No debates yet.</div>}
              </div>
            </>
          )}

          {/* MODERATION */}
          {tab === 'moderation' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 12, marginBottom: 24 }}>
                <StatCard label="Pending reports" value={summary.pending_reports} color={C.gold} />
                <StatCard label="Open appeals" value={summary.open_appeals} color={C.ember} />
                <StatCard label="Open tickets" value={summary.open_tickets} color={C.dim} />
                <StatCard label="Active bans" value={summary.active_bans} color={C.garnet} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontFamily: display, fontSize: 17, fontWeight: 700, color: C.ink }}>Recent reports</div>
                <button onClick={() => nav('/moderation')} style={{ background: 'none', border: `1px solid ${C.hair}`, borderRadius: 8, fontFamily: ui, fontSize: 12, color: C.gold, cursor: 'pointer', padding: '6px 14px', fontWeight: 600 }}>Open full queue →</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {reports.map(r => (
                  <div key={r.id} style={{ padding: '11px 14px', borderRadius: 10, border: `1px solid ${C.hair}`, background: C.panel, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: ui, fontSize: 13, color: C.ink, fontWeight: 500 }}>{r.reason.replace(/_/g, ' ')}<span style={{ color: C.faint, fontWeight: 400 }}> · {r.target_type.replace(/_/g, ' ')}</span></div>
                      <div style={{ fontFamily: mono, fontSize: 10, color: C.faint, marginTop: 2 }}>{new Date(r.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 9px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '.07em', background: `${statusColor(r.status)}22`, color: statusColor(r.status), flexShrink: 0 }}>{r.status}</span>
                  </div>
                ))}
                {reports.length === 0 && <div style={{ fontFamily: ui, fontSize: 13, color: C.faint }}>No reports yet.</div>}
              </div>
            </>
          )}
        </>
      )}
    </Scroll>
  );
}
