// =====================================================================
// The Rostrum · src/screens/EarningsScreen.tsx
// A creator's money home: lifetime earnings (net of platform fee) and the
// Stripe Connect payout-account status, with a button to set up / finish /
// manage payouts. Real transactions and the gift/access checkout arrive in
// the next slice; this screen is the payout foundation.
// =====================================================================
import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  getMyEarnings, getCreatorAccount, getPlatformConfig, startPayoutOnboarding, refreshPayoutStatus,
  type Earnings, type CreatorAccount, type PlatformConfig,
} from '../lib/payments';
import { C, ui, display, mono, solidGold } from '../lib/theme';
import { Scroll, Center, ghostBtn } from '../components/ui';

export function EarningsScreen({ onBack }: { onBack?: () => void }) {
  const [params, setParams] = useSearchParams();
  const [earn, setEarn] = useState<Earnings | null>(null);
  const [acct, setAcct] = useState<CreatorAccount | null>(null);
  const [cfg, setCfg] = useState<PlatformConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const justReturned = params.get('onboarding'); // 'done' | 'refresh' | null

  const load = useCallback(async () => {
    try {
      // If the user just came back from Stripe, pull live status first.
      if (justReturned) { try { await refreshPayoutStatus(); } catch { /* fall through */ } }
      const [e, a, c] = await Promise.all([getMyEarnings(), getCreatorAccount(), getPlatformConfig()]);
      setEarn(e); setAcct(a); setCfg(c);
    } catch (e: any) {
      setErr(e?.message ?? 'Could not load your earnings');
    } finally {
      if (justReturned) { params.delete('onboarding'); setParams(params, { replace: true }); }
    }
  }, [justReturned]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const money = (c: number) =>
    ((c ?? 0) / 100).toLocaleString('en-US', { style: 'currency', currency: (cfg?.currency ?? 'usd').toUpperCase() });
  const feePct = cfg ? (cfg.platform_fee_bps / 100).toFixed(cfg.platform_fee_bps % 100 ? 1 : 0) : '15';

  async function connect() {
    setBusy(true); setErr(null);
    try {
      const { url } = await startPayoutOnboarding();
      window.location.href = url;                 // hand off to Stripe's hosted onboarding
    } catch (e: any) {
      setErr(e?.message ?? 'Could not start payout setup');
      setBusy(false);
    }
  }

  const payoutState: 'none' | 'incomplete' | 'review' | 'active' =
    !acct || !acct.connected ? 'none'
    : acct.payouts_enabled ? 'active'
    : acct.details_submitted ? 'review'
    : 'incomplete';

  return (
    <Scroll title="Earnings & payouts" onBack={onBack} maxWidth={760}>
      {err && (
        <div style={{ ...card, borderColor: C.garnet, color: C.garnetHi, marginBottom: 18 }}>{err}</div>
      )}

      {/* ---- Earnings summary ---- */}
      <div style={{ ...card, marginBottom: 18 }}>
        <div style={{ fontFamily: ui, fontSize: 12.5, color: C.faint, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Your earnings (net)
        </div>
        <div style={{ fontFamily: display, fontSize: 44, fontWeight: 600, color: C.ink, margin: '6px 0 2px' }}>
          {earn ? money(earn.net_cents) : '—'}
        </div>
        <div style={{ display: 'flex', gap: 22, marginTop: 14, flexWrap: 'wrap' }}>
          <Mini label="Gross" value={earn ? money(earn.gross_cents) : '—'} />
          <Mini label={`Platform fee (${feePct}%)`} value={earn ? '–' + money(earn.fee_cents) : '—'} />
        </div>
        <p style={{ fontFamily: ui, fontSize: 12.5, color: C.faint, lineHeight: 1.5, margin: '16px 0 0' }}>
          You keep {100 - Number(feePct)}% of paid-debate entries, gifts, and tips. The Rostrum keeps {feePct}% to run
          the platform. Earnings appear here the moment a payment clears.
        </p>
      </div>

      {/* ---- Payout account ---- */}
      <div style={card}>
        <div style={{ fontFamily: ui, fontSize: 12.5, color: C.faint, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Payout account
        </div>

        {payoutState === 'active' && (
          <>
            <div style={{ ...statusRow, color: C.jadeHi }}>
              <Dot color={C.jade} /> Payouts active — Stripe will deposit your earnings automatically.
            </div>
            <button onClick={connect} disabled={busy} style={{ ...ghostBtn, marginTop: 14 }}>
              {busy ? 'Opening…' : 'Update payout details'}
            </button>
          </>
        )}

        {payoutState === 'review' && (
          <>
            <div style={{ ...statusRow, color: C.gold }}>
              <Dot color={C.gold} /> Stripe is verifying your details. This is usually quick.
            </div>
            <button onClick={load} style={{ ...ghostBtn, marginTop: 14 }}>Refresh status</button>
          </>
        )}

        {payoutState === 'incomplete' && (
          <>
            <div style={{ ...statusRow, color: C.gold }}>
              <Dot color={C.gold} /> Setup started but not finished.
            </div>
            <button onClick={connect} disabled={busy} style={{ ...solidGold, marginTop: 14 }}>
              {busy ? 'Opening…' : 'Finish payout setup'}
            </button>
          </>
        )}

        {payoutState === 'none' && (
          <>
            <p style={{ fontFamily: ui, fontSize: 14, color: C.dim, lineHeight: 1.55, margin: '10px 0 0' }}>
              Connect a payout account to receive money from paid debates, gifts, and tips. Stripe securely collects
              your bank details — The Rostrum never sees them.
            </p>
            <button onClick={connect} disabled={busy} style={{ ...solidGold, marginTop: 16 }}>
              {busy ? 'Opening…' : 'Set up payouts'}
            </button>
          </>
        )}
      </div>

      <p style={{ fontFamily: mono, fontSize: 11, color: C.faint, textAlign: 'center', marginTop: 22 }}>
        Powered by Stripe · test mode
      </p>
      {!earn && !err && <Center><span style={{ color: C.faint, fontFamily: ui }}>Loading…</span></Center>}
    </Scroll>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontFamily: ui, fontSize: 11.5, color: C.faint }}>{label}</div>
      <div style={{ fontFamily: mono, fontSize: 16, color: C.dim, marginTop: 3 }}>{value}</div>
    </div>
  );
}
const Dot = ({ color }: { color: string }) =>
  <span style={{ width: 8, height: 8, borderRadius: 999, background: color, display: 'inline-block' }} />;

const card: React.CSSProperties = {
  background: C.panel, border: `1px solid ${C.hair}`, borderRadius: 12, padding: '20px 22px',
};
const statusRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 9, fontFamily: ui, fontSize: 14, fontWeight: 600, marginTop: 12,
};
