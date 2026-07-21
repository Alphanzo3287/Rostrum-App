// =====================================================================
// The Rostrum · src/screens/AnalyticsScreen.tsx
// Host-facing analytics for a single debate. Rostrum Pro perk — free
// hosts see an upgrade prompt. Route: /debate/:id/analytics
// =====================================================================
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { useAuth } from '../lib/auth';
import { isPro } from '../lib/pro';
import { getDebateAnalytics, type DebateAnalytics } from '../lib/analytics';
import { C, ui, display, mono, a, solidGold } from '../lib/theme';

const fmtDur = (s: number | null) => {
  if (!s || s <= 0) return '—';
  const m = Math.floor(s / 60), sec = s % 60;
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m ${sec}s`;
};
const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function AnalyticsScreen() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { profile } = useAuth();
  const pro = isPro(profile);
  const [data, setData] = useState<DebateAnalytics | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!id || !pro) return;
    getDebateAnalytics(id).then(setData).catch(e => setErr(e?.message ?? 'Could not load analytics'));
  }, [id, pro]);

  if (!pro) {
    return (
      <div style={{ maxWidth: 620, margin: '0 auto', padding: '60px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 34 }}>📊</div>
        <h1 style={{ fontFamily: display, fontSize: 26, fontWeight: 700, color: C.ink, margin: '12px 0 8px' }}>
          Debate analytics is a Pro feature
        </h1>
        <p style={{ fontFamily: ui, fontSize: 14.5, color: C.faint, lineHeight: 1.6, margin: '0 auto 22px', maxWidth: 440 }}>
          See who watched, when they dropped off, speaking-time breakdowns, the audience vote, and gift totals for every
          debate you host. Upgrade to unlock analytics across all your events.
        </p>
        <button onClick={() => nav('/pro')} style={{ ...solidGold, padding: '12px 30px', fontSize: 14.5 }}>
          Upgrade to Rostrum Pro
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '26px 20px 70px' }}>
      <button onClick={() => nav(-1)} style={{ background: 'transparent', border: 'none', cursor: 'pointer',
        fontFamily: ui, fontSize: 13, color: C.dim, padding: 0, marginBottom: 14 }}>← Back</button>

      {err ? (
        <div style={{ padding: 16, borderRadius: 12, background: a(C.garnet, '14'), border: `1px solid ${a(C.garnet, '40')}`,
          fontFamily: ui, fontSize: 14, color: C.garnetHi }}>{err}</div>
      ) : !data ? (
        <div style={{ fontFamily: ui, fontSize: 14, color: C.faint }}>Loading analytics…</div>
      ) : (
        <>
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontFamily: ui, fontSize: 11.5, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: C.gold, marginBottom: 4 }}>Debate analytics</div>
            <h1 style={{ fontFamily: display, fontSize: 25, fontWeight: 700, color: C.ink, margin: 0, lineHeight: 1.15 }}>{data.motion ?? 'Debate'}</h1>
          </div>

          {/* headline stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
            <Stat label="Peak viewers" value={data.peak_viewers.toLocaleString()} color={C.cyan} />
            <Stat label="Total attendees" value={data.total_attendees.toLocaleString()} />
            <Stat label="Duration" value={fmtDur(data.duration_secs)} />
            <Stat label="Audience votes" value={data.votes.total.toLocaleString()} color={C.jadeHi} />
            <Stat label="Gifts received" value={money(data.gifts.total_cents)} sub={`${data.gifts.count} gift${data.gifts.count === 1 ? '' : 's'}`} color={C.gold} />
          </div>

          {/* viewers over time */}
          <Panel title="Viewers over time">
            {data.viewer_series.length < 2 ? (
              <Empty>Not enough data yet — the drop-off chart fills in as people join and leave live debates.</Empty>
            ) : (
              <ResponsiveContainer width="100%" height={230}>
                <AreaChart data={data.viewer_series.map(p => ({ t: new Date(p.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), count: p.count }))}>
                  <defs>
                    <linearGradient id="vg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.cyan} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={C.cyan} stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={a(C.hair, '80')} vertical={false} />
                  <XAxis dataKey="t" tick={{ fill: C.faint, fontSize: 11 }} stroke={C.hair} />
                  <YAxis allowDecimals={false} tick={{ fill: C.faint, fontSize: 11 }} stroke={C.hair} width={30} />
                  <Tooltip contentStyle={{ background: C.panel2, border: `1px solid ${C.hair}`, borderRadius: 10, fontFamily: ui, fontSize: 12 }} />
                  <Area type="monotone" dataKey="count" stroke={C.cyan} strokeWidth={2} fill="url(#vg)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Panel>

          {/* audience vote */}
          <Panel title="Audience verdict">
            {data.votes.total === 0 ? <Empty>No audience votes were cast.</Empty> : (
              <VoteBar prop={data.votes.prop} opp={data.votes.opp} />
            )}
          </Panel>

          {/* speaking time */}
          <Panel title="Speaking time">
            {data.speaking.length === 0 ? <Empty>No speaking time was recorded.</Empty> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data.speaking.map((s, i) => {
                  const max = Math.max(...data.speaking.map(x => x.seconds), 1);
                  return (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: ui, fontSize: 12.5, color: C.ink, marginBottom: 4 }}>
                        <span>{s.name}{s.role && s.role !== 'audience' ? ` · ${s.role}` : ''}</span>
                        <span style={{ fontFamily: mono, color: C.dim }}>{mmss(s.seconds)}</span>
                      </div>
                      <div style={{ height: 8, borderRadius: 999, background: C.panel2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(s.seconds / max) * 100}%`,
                          background: s.side === 'opp' ? '#DA5F7C' : s.side === 'prop' ? '#4FC2A7' : C.cyan, borderRadius: 999 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          {/* top gift recipients */}
          {data.gift_top.length > 0 && (
            <Panel title="Top gift recipients">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.gift_top.map((g, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: ui, fontSize: 13, color: C.ink }}>
                    <span>{g.name}</span><span style={{ fontFamily: mono, color: C.gold }}>{money(g.cents)}</span>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ padding: '15px 17px', borderRadius: 14, background: C.panel, border: `1px solid ${C.hair}` }}>
      <div style={{ fontFamily: ui, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', color: C.faint, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: display, fontSize: 23, fontWeight: 700, color: color ?? C.ink }}>{value}</div>
      {sub && <div style={{ fontFamily: ui, fontSize: 11, color: C.faint, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '18px 20px', borderRadius: 16, background: C.panel, border: `1px solid ${C.hair}`, marginBottom: 16 }}>
      <div style={{ fontFamily: display, fontSize: 16, fontWeight: 700, color: C.ink, marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: ui, fontSize: 13, color: C.faint, lineHeight: 1.5 }}>{children}</div>;
}
function VoteBar({ prop, opp }: { prop: number; opp: number }) {
  const total = prop + opp || 1;
  const pp = Math.round((prop / total) * 100);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: ui, fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>
        <span style={{ color: '#4FC2A7' }}>Proposition {pp}%</span>
        <span style={{ color: '#DA5F7C' }}>{100 - pp}% Opposition</span>
      </div>
      <div style={{ display: 'flex', height: 12, borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${pp}%`, background: '#2E9E86' }} />
        <div style={{ width: `${100 - pp}%`, background: '#B23A55' }} />
      </div>
      <div style={{ fontFamily: ui, fontSize: 11.5, color: C.faint, marginTop: 6 }}>{prop} vs {opp} · {total} total votes</div>
    </div>
  );
}
