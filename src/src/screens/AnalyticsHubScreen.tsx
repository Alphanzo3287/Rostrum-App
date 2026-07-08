// =====================================================================
// The Rostrum · src/screens/AnalyticsHubScreen.tsx
// The Pro analytics home: lifetime rollup + every debate you've hosted
// (recorded or not), each linking to its per-debate analytics.
// Route: /analytics
// =====================================================================
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { isPro } from '../lib/pro';
import {
  getHostAnalyticsSummary, myHostedDebates, type HostSummary, type HostedDebate,
} from '../lib/analytics';
import { C, ui, display, mono, a, solidGold } from '../lib/theme';

const FORMAT_LABEL: Record<string, string> = {
  oxford: 'Oxford', lecture: 'Lecture', legacy: 'Legacy', speakers_corner: "Speaker's Corner",
};
const money = (c: number) => `$${(c / 100).toFixed(2)}`;

export function AnalyticsHubScreen() {
  const nav = useNavigate();
  const { profile } = useAuth();
  const pro = isPro(profile);
  const [summary, setSummary] = useState<HostSummary | null>(null);
  const [debates, setDebates] = useState<HostedDebate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pro) { setLoading(false); return; }
    Promise.all([getHostAnalyticsSummary(), myHostedDebates()])
      .then(([s, d]) => { setSummary(s); setDebates(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [pro]);

  if (!pro) {
    return (
      <div style={{ maxWidth: 620, margin: '0 auto', padding: '60px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 34 }}>📊</div>
        <h1 style={{ fontFamily: display, fontSize: 26, fontWeight: 700, color: C.ink, margin: '12px 0 8px' }}>
          Analytics is a Pro feature
        </h1>
        <p style={{ fontFamily: ui, fontSize: 14.5, color: C.faint, lineHeight: 1.6, margin: '0 auto 22px', maxWidth: 440 }}>
          Track your audience across every debate you host — viewers and drop-off, speaking time, the audience vote,
          and gift earnings, plus lifetime totals. Upgrade to unlock your analytics dashboard.
        </p>
        <button onClick={() => nav('/pro')} style={{ ...solidGold, padding: '12px 30px', fontSize: 14.5 }}>
          Upgrade to Rostrum Pro
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '26px 20px 70px' }}>
      <h1 style={{ fontFamily: display, fontSize: 28, fontWeight: 700, color: C.ink, margin: '0 0 4px' }}>Analytics</h1>
      <p style={{ fontFamily: ui, fontSize: 13.5, color: C.faint, margin: '0 0 22px' }}>
        Your lifetime totals and per-debate breakdowns for every event you've hosted.
      </p>

      {/* lifetime rollup */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 26 }}>
          <Stat label="Debates hosted" value={summary.debates_hosted.toLocaleString()} />
          <Stat label="Total attendees" value={summary.total_attendees.toLocaleString()} color={C.cyan} />
          <Stat label="Peak in one debate" value={summary.peak_single.toLocaleString()} />
          <Stat label="Total votes" value={summary.total_votes.toLocaleString()} color={C.jadeHi} />
          <Stat label="Gifts earned" value={money(summary.total_gift_cents)} color={C.gold} />
        </div>
      )}

      <div style={{ fontFamily: display, fontSize: 17, fontWeight: 700, color: C.ink, margin: '0 0 12px' }}>Your debates</div>

      {loading ? (
        <div style={{ fontFamily: ui, fontSize: 14, color: C.faint }}>Loading…</div>
      ) : debates.length === 0 ? (
        <div style={{ padding: '34px 22px', borderRadius: 16, textAlign: 'center', background: C.panel, border: `1px solid ${C.hair}` }}>
          <div style={{ fontFamily: ui, fontSize: 14, color: C.faint }}>You haven't hosted any debates yet.</div>
        </div>
      ) : (
        debates.map(d => (
          <div key={d.id} onClick={() => nav(`/debate/${d.id}/analytics`)}
            style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', cursor: 'pointer',
              background: C.panel, border: `1px solid ${C.hair}`, borderRadius: 14, padding: '14px 17px', marginBottom: 10 }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.hairHi; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.hair; }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontFamily: ui, fontSize: 14.5, fontWeight: 700, color: C.ink }}>{d.motion ?? 'Debate'}</div>
              <div style={{ fontFamily: ui, fontSize: 11.5, color: C.faint, marginTop: 3 }}>
                {FORMAT_LABEL[d.format ?? ''] ?? d.format} · {new Date(d.created_at).toLocaleDateString()}
                {d.status === 'live' && <span style={{ color: C.garnetHi }}> · LIVE</span>}
              </div>
            </div>
            <span style={{ fontFamily: ui, fontSize: 12.5, fontWeight: 700, color: C.gold }}>📊 View analytics →</span>
          </div>
        ))
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ padding: '15px 17px', borderRadius: 14, background: C.panel, border: `1px solid ${C.hair}` }}>
      <div style={{ fontFamily: ui, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', color: C.faint, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: display, fontSize: 22, fontWeight: 700, color: color ?? C.ink }}>{value}</div>
    </div>
  );
}
