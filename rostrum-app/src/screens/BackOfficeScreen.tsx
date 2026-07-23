// =====================================================================
// The Rostrum · src/screens/BackOfficeScreen.tsx
// Admin-only command center. Tabs: Financials (charts), plus the
// relocated Reports, Analytics and Moderation surfaces.
//
// There is no Payout Requests tab: creators are paid by direct charge
// straight to their own connected account, so the platform never holds a
// balance to approve a withdrawal against.
// =====================================================================
import { useEffect, useState, useCallback } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar,
} from 'recharts';
import {
  adminFinancialSummary, adminFinancialTimeseries,
  type FinancialSummary, type FinancialPoint,
} from '../lib/payments';
import {
  adminListBugReports, adminUpdateBugStatus, adminListAbuseReports,
  type BugReport, type AbuseReport,
} from '../lib/reports';
import { C, ui, display, mono, a } from '../lib/theme';
import { supabase } from '../lib/supabaseClient';
import { Scroll, Center } from '../components/ui';
import { AdminPortalScreen } from './AdminPortalScreen';
import { ModerationScreen } from './ModerationScreen';

type Tab = 'financials' | 'reports' | 'analytics' | 'moderation';
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'financials',   label: 'Financials',   icon: '📈' },
  { key: 'reports',      label: 'Reports',      icon: '🐞' },
  { key: 'analytics',    label: 'Analytics',    icon: '📊' },
  { key: 'moderation',   label: 'Moderation',   icon: '🛡️' },
];

const money = (c: number) => ((c ?? 0) / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export function BackOfficeScreen() {
  const [tab, setTab] = useState<Tab>('financials');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ padding: '22px 24px 0', borderBottom: `1px solid ${C.hair}`, flexShrink: 0 }}>
        <h2 style={{ fontFamily: display, fontSize: 27, fontWeight: 700, color: C.ink, margin: '0 0 4px', letterSpacing: '-.02em' }}>
          Back Office
        </h2>
        <p style={{ fontFamily: ui, fontSize: 13, color: C.faint, margin: '0 0 14px' }}>Owner controls · admin only</p>
        <div style={{ display: 'flex', gap: 4, overflowX: 'auto' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '10px 15px', border: 'none',
                background: 'none', cursor: 'pointer', fontFamily: ui, fontSize: 13.5, whiteSpace: 'nowrap',
                fontWeight: tab === t.key ? 700 : 500, color: tab === t.key ? C.gold : C.faint,
                borderBottom: `2.5px solid ${tab === t.key ? C.gold : 'transparent'}`,
              }}>
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        {tab === 'financials' && <FinancialsPanel />}
        {tab === 'reports' && <ReportsPanel />}
        {tab === 'analytics' && <AdminPortalScreen />}
        {tab === 'moderation' && <ModerationScreen />}
      </div>
    </div>
  );
}

/* ---------------- Financials ---------------- */
function FinancialsPanel() {
  const [sum, setSum] = useState<FinancialSummary | null>(null);
  const [series, setSeries] = useState<FinancialPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [s, t] = await Promise.all([adminFinancialSummary(), adminFinancialTimeseries(30)]);
        setSum(s); setSeries(t);
      } finally { setLoading(false); }
    })();
  }, []);

  const chartData = series.map(p => ({
    day: new Date(p.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    Revenue: (p.gift_cents ?? 0) / 100,
  }));

  return (
    <Scroll>
      {loading && <Center><span style={{ color: C.faint, fontFamily: ui }}>Loading…</span></Center>}
      {sum && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
            <Stat label="Gift revenue" value={money(sum.gift_revenue_cents)} color={C.jadeHi} />
            <Stat label="Platform fees kept" value={money(sum.platform_fees_cents)} color={C.cyan} />
          </div>

          <Panel title="Gift revenue · last 30 days">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.jadeHi} stopOpacity={0.4} /><stop offset="100%" stopColor={C.jadeHi} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.hair} vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: C.faint }} interval="preserveStartEnd" minTickGap={24} />
                <YAxis tick={{ fontSize: 11, fill: C.faint }} width={44} tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(v: any) => `$${Number(v).toFixed(2)}`} contentStyle={{ fontFamily: ui, fontSize: 12, borderRadius: 10, border: `1px solid ${C.hair}` }} />
                <Area type="monotone" dataKey="Revenue" stroke={C.jadeHi} strokeWidth={2} fill="url(#gRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Daily gift revenue · last 14 days">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData.slice(-14)} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.hair} vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: C.faint }} interval="preserveStartEnd" minTickGap={16} />
                <YAxis tick={{ fontSize: 11, fill: C.faint }} width={44} tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(v: any) => `$${Number(v).toFixed(2)}`} contentStyle={{ fontFamily: ui, fontSize: 12, borderRadius: 10, border: `1px solid ${C.hair}` }} cursor={{ fill: C.hair, opacity: 0.4 }} />
                <Bar dataKey="Revenue" fill={C.jadeHi} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>
        </>
      )}
    </Scroll>
  );
}

/* ---------------- Reports (bugs + abuse) ---------------- */
const BUG_STATES = ['open', 'investigating', 'resolved', 'closed'];
function ReportsPanel() {
  const [sub, setSub] = useState<'bugs' | 'abuse'>('bugs');
  const [bugs, setBugs] = useState<BugReport[]>([]);
  const [abuse, setAbuse] = useState<AbuseReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [b, a] = await Promise.all([adminListBugReports(null), adminListAbuseReports(80)]);
      setBugs(b); setAbuse(a);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function setStatus(id: string, status: string) {
    setBusy(id);
    try { await adminUpdateBugStatus(id, status); setBugs(bs => bs.map(b => b.id === id ? { ...b, status } : b)); }
    finally { setBusy(null); }
  }

  const openBugs = bugs.filter(b => b.status === 'open' || b.status === 'investigating').length;

  return (
    <Scroll>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        <Chip active={sub === 'bugs'} onClick={() => setSub('bugs')}>🐞 Bugs{openBugs ? ` · ${openBugs}` : ''}</Chip>
        <Chip active={sub === 'abuse'} onClick={() => setSub('abuse')}>🛡️ Abuse reports</Chip>
      </div>

      {loading ? <Center><span style={{ color: C.faint, fontFamily: ui }}>Loading…</span></Center>
        : sub === 'bugs' ? (
          bugs.length === 0 ? <Empty label="No bug reports yet." />
          : bugs.map(b => (
            <div key={b.id} style={{ background: C.panel, border: `1px solid ${C.hair}`, borderRadius: 14, padding: 16, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: ui, fontSize: 14, color: C.ink, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{b.body}</div>
                  <div style={{ fontFamily: mono, fontSize: 11, color: C.faint, marginTop: 6 }}>
                    {b.reporter_handle ? `@${b.reporter_handle}` : 'unknown'} · {b.page ?? '—'} · {new Date(b.created_at).toLocaleString()}
                  </div>
                </div>
                <BugBadge status={b.status} />
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                {BUG_STATES.map(s => (
                  <button key={s} onClick={() => setStatus(b.id, s)} disabled={busy === b.id || b.status === s}
                    style={{ padding: '6px 11px', borderRadius: 8, cursor: b.status === s ? 'default' : 'pointer',
                      fontFamily: ui, fontSize: 12, fontWeight: 600, textTransform: 'capitalize',
                      border: `1px solid ${b.status === s ? C.gold : C.hair}`,
                      background: b.status === s ? a(C.gold, '18') : 'transparent',
                      color: b.status === s ? C.gold : C.dim, opacity: busy === b.id ? 0.5 : 1 }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ))
        ) : (
          abuse.length === 0 ? <Empty label="No abuse reports." />
          : (
            <>
              <p style={{ fontFamily: ui, fontSize: 12.5, color: C.faint, margin: '0 0 12px' }}>
                Awareness feed — take action from the Moderation tab.
              </p>
              {abuse.map(r => (
                <div key={r.id} style={{ background: C.panel, border: `1px solid ${C.hair}`, borderRadius: 14, padding: 14, marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ fontFamily: ui, fontSize: 13.5, color: C.ink }}>
                      <b style={{ textTransform: 'capitalize' }}>{r.reason?.replace(/_/g, ' ')}</b>
                      <span style={{ color: C.faint }}> · {r.target_type}{r.target_handle ? ` @${r.target_handle}` : ''}</span>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  {r.body && <div style={{ fontFamily: ui, fontSize: 13, color: C.dim, marginTop: 6, lineHeight: 1.5 }}>{r.body}</div>}
                  <div style={{ fontFamily: mono, fontSize: 10.5, color: C.faint, marginTop: 6 }}>
                    by {r.reporter_handle ? `@${r.reporter_handle}` : 'unknown'} · {new Date(r.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </>
          )
        )}
    </Scroll>
  );
}
function BugBadge({ status }: { status: string }) {
  const c: Record<string, string> = { open: C.warning, investigating: C.cyan, resolved: C.jadeHi, closed: C.faint };
  return (
    <span style={{ fontFamily: ui, fontSize: 11, fontWeight: 700, textTransform: 'capitalize', whiteSpace: 'nowrap',
      color: c[status] ?? C.faint, border: `1px solid ${c[status] ?? C.hair}`, borderRadius: 20, padding: '3px 10px' }}>
      {status}
    </span>
  );
}

/* ---------------- shared bits ---------------- */
function Stat({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.hair}`, borderRadius: 14, padding: '14px 16px' }}>
      <div style={{ fontFamily: ui, fontSize: 11, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontFamily: display, fontSize: 22, fontWeight: 700, color: color ?? C.ink, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontFamily: ui, fontSize: 12, color: C.faint, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.hair}`, borderRadius: 16, padding: 16, marginBottom: 16 }}>
      <div style={{ fontFamily: ui, fontSize: 12.5, color: C.faint, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}
function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: '7px 13px', borderRadius: 20, cursor: 'pointer', fontFamily: ui, fontSize: 12.5, fontWeight: 600,
      border: `1px solid ${active ? C.gold : C.hair}`, background: active ? C.gold : 'transparent',
      color: active ? '#fff' : C.dim,
    }}>{children}</button>
  );
}
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = { requested: C.warning, paid: C.jadeHi, declined: C.garnetHi, failed: C.garnetHi, pending: C.warning };
  const label: Record<string, string> = { requested: 'Pending', paid: 'Paid', declined: 'Declined', failed: 'Failed', pending: 'Pending' };
  return (
    <span style={{ fontFamily: ui, fontSize: 11, fontWeight: 700, color: map[status] ?? C.faint,
      border: `1px solid ${map[status] ?? C.hair}`, borderRadius: 20, padding: '3px 10px' }}>
      {label[status] ?? status}
    </span>
  );
}
function Empty({ label }: { label: string }) {
  return <div style={{ textAlign: 'center', padding: '48px 0', fontFamily: ui, fontSize: 14, color: C.faint }}>{label}</div>;
}
