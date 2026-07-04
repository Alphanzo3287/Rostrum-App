// =====================================================================
// The Rostrum · src/screens/EarningsScreen.tsx
// A creator's money home: lifetime earnings (net of platform fee) and the
// Stripe Connect payout-account status, with a button to set up / finish /
// manage payouts. Real transactions and the gift/access checkout arrive in
// the next slice; this screen is the payout foundation.
// =====================================================================
import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  getMyEarnings, getCreatorAccount, getPlatformConfig, startPayoutOnboarding, refreshPayoutStatus,
  getMyProgress, getMyWallet, getMyListing, createBuybackListing, cancelBuybackListing,
  requestWithdrawal, getMyWithdrawals, WITHDRAW_MIN_DBUCKS,
  type Earnings, type CreatorAccount, type PlatformConfig, type Progress, type Wallet, type BuybackListing, type Withdrawal,
} from '../lib/payments';
import { C, ui, display, mono, solidGold, field } from '../lib/theme';
import { Scroll, Center, ghostBtn } from '../components/ui';

export function EarningsScreen({ onBack }: { onBack?: () => void }) {
  const [params, setParams] = useSearchParams();
  const [earn, setEarn] = useState<Earnings | null>(null);
  const [acct, setAcct] = useState<CreatorAccount | null>(null);
  const [cfg, setCfg] = useState<PlatformConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [listing, setListing] = useState<BuybackListing | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);

  const justReturned = params.get('onboarding'); // 'done' | 'refresh' | null

  const load = useCallback(async () => {
    try {
      // If the user just came back from Stripe, pull live status first.
      if (justReturned) { try { await refreshPayoutStatus(); } catch { /* fall through */ } }
      const [e, a, c, p, w, l, wd] = await Promise.all([
        getMyEarnings(), getCreatorAccount(), getPlatformConfig(), getMyProgress(), getMyWallet(), getMyListing(), getMyWithdrawals(),
      ]);
      setEarn(e); setAcct(a); setCfg(c); setProgress(p); setWallet(w); setListing(l); setWithdrawals(wd);
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

      {/* ---- Buy-back listing (Phase 4) ---- */}
      <div style={{ ...card, marginTop: 18 }}>
        <div style={{ fontFamily: ui, fontSize: 12.5, color: C.faint, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Cash-out buy-back
        </div>
        {!progress?.cashout_unlocked ? (
          <p style={{ fontFamily: ui, fontSize: 14, color: C.dim, lineHeight: 1.55, margin: '10px 0 0' }}>
            Reach Level 25 with at least 10 qualifying debates or lectures to unlock cash-out buy-backs.
            {progress && ` You're currently Level ${progress.level} with ${progress.qualifying_debates} qualifying debate${progress.qualifying_debates === 1 ? '' : 's'} and ${progress.qualifying_lectures} lecture${progress.qualifying_lectures === 1 ? '' : 's'}.`}
          </p>
        ) : payoutState !== 'active' ? (
          <p style={{ fontFamily: ui, fontSize: 14, color: C.dim, lineHeight: 1.55, margin: '10px 0 0' }}>
            Set up payouts above first — buy-back money is paid straight to that same account.
          </p>
        ) : (
          <BuybackCard listing={listing} redeemable={wallet?.redeemable ?? 0}
            onChanged={load} />
        )}
      </div>

      {/* ---- Withdraw to bank (cash-out) ---- */}
      <div style={{ ...card, marginTop: 18 }}>
        <div style={{ fontFamily: ui, fontSize: 12.5, color: C.faint, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Withdraw to bank
        </div>
        {!progress?.cashout_unlocked ? (
          <p style={{ fontFamily: ui, fontSize: 14, color: C.dim, lineHeight: 1.55, margin: '10px 0 0' }}>
            Cash withdrawals unlock at Level 25 with at least 10 qualifying debates or lectures.
            {progress && ` You're currently Level ${progress.level} with ${progress.qualifying_debates} qualifying debate${progress.qualifying_debates === 1 ? '' : 's'} and ${progress.qualifying_lectures} lecture${progress.qualifying_lectures === 1 ? '' : 's'}.`}
          </p>
        ) : payoutState !== 'active' ? (
          <p style={{ fontFamily: ui, fontSize: 14, color: C.dim, lineHeight: 1.55, margin: '10px 0 0' }}>
            Set up payouts above first — withdrawals go straight to that same account.
          </p>
        ) : (
          <WithdrawCard redeemable={wallet?.redeemable ?? 0} withdrawals={withdrawals} money={money} onChanged={load} />
        )}
      </div>

      <p style={{ fontFamily: mono, fontSize: 11, color: C.faint, textAlign: 'center', marginTop: 22 }}>
        Powered by Stripe · test mode
      </p>
      {!earn && !err && <Center><span style={{ color: C.faint, fontFamily: ui }}>Loading…</span></Center>}
    </Scroll>
  );
}

function WithdrawCard({ redeemable, withdrawals, money, onChanged }: {
  redeemable: number; withdrawals: Withdrawal[]; money: (c: number) => string; onChanged: () => void;
}) {
  const [dbucks, setDbucks] = useState<number>(Math.max(WITHDRAW_MIN_DBUCKS, 0));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<string | null>(null);

  const fee = Math.round(dbucks * 0.15);
  const net = dbucks - fee;
  const belowMin = dbucks < WITHDRAW_MIN_DBUCKS;
  const overBalance = dbucks > redeemable;

  async function submit() {
    setErr(''); setDone(null);
    if (belowMin) { setErr(`Minimum withdrawal is ${WITHDRAW_MIN_DBUCKS.toLocaleString()} D-Bucks ($${(WITHDRAW_MIN_DBUCKS / 100).toFixed(2)}).`); return; }
    if (overBalance) { setErr(`You only have ${redeemable.toLocaleString()} cashable D-Bucks.`); return; }
    setBusy(true);
    try {
      const r = await requestWithdrawal(dbucks);
      setDone(`${money(r.net_cents)} is on its way to your bank via Stripe.`);
      onChanged();
    } catch (e: any) { setErr(e?.message ?? 'Withdrawal failed'); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ marginTop: 12 }}>
      <p style={{ fontFamily: ui, fontSize: 13.5, color: C.dim, lineHeight: 1.5, margin: '0 0 12px' }}>
        You have <span style={{ color: C.gold, fontFamily: mono }}>{redeemable.toLocaleString()}</span> cashable D-Bucks
        ({money(redeemable)}). Withdraw to your connected bank account — The Rostrum keeps 15%, and you receive the rest.
      </p>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: ui, fontSize: 11.5, fontWeight: 600, color: C.dim, maxWidth: 260 }}>
        D-Bucks to withdraw
        <input type="number" min={WITHDRAW_MIN_DBUCKS} max={redeemable} step={100} value={dbucks}
          onChange={e => setDbucks(Math.max(0, Math.floor(+e.target.value)))} style={field} />
      </label>

      <div style={{ display: 'flex', gap: 18, margin: '12px 0', flexWrap: 'wrap' }}>
        <Mini label="You withdraw" value={money(dbucks)} />
        <Mini label="Platform fee (15%)" value={`− ${money(fee)}`} />
        <Mini label="You receive" value={money(net)} />
      </div>

      {err && <div style={{ fontFamily: ui, fontSize: 12.5, color: C.garnetHi, marginBottom: 10 }}>{err}</div>}
      {done && <div style={{ fontFamily: ui, fontSize: 13, color: C.jadeHi, marginBottom: 10 }}>✓ {done}</div>}

      <button onClick={submit} disabled={busy || belowMin || overBalance}
        style={{ ...solidGold, opacity: (busy || belowMin || overBalance) ? 0.55 : 1 }}>
        {busy ? 'Processing…' : `Withdraw ${money(net)}`}
      </button>

      {withdrawals.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontFamily: ui, fontSize: 11, color: C.faint, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>
            Recent withdrawals
          </div>
          {withdrawals.slice(0, 5).map(w => (
            <div key={w.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 0', borderBottom: `1px solid ${C.hair}` }}>
              <span style={{ fontFamily: ui, fontSize: 13, color: C.ink }}>{money(w.net_cents)}</span>
              <span style={{ fontFamily: mono, fontSize: 11, color: C.faint }}>{new Date(w.created_at).toLocaleDateString()}</span>
              <span style={{ fontFamily: ui, fontSize: 11, fontWeight: 700,
                color: w.status === 'paid' ? C.jadeHi : w.status === 'failed' ? C.garnetHi : C.warning }}>
                {w.status === 'paid' ? 'Paid' : w.status === 'failed' ? 'Failed' : 'Processing'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BuybackCard({ listing, redeemable, onChanged }: {
  listing: BuybackListing | null; redeemable: number; onChanged: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [dbucks, setDbucks] = useState(Math.min(1000, redeemable));
  const [price, setPrice] = useState(10);
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function submit() {
    setErr('');
    if (dbucks <= 0 || dbucks > redeemable) { setErr(`Enter an amount up to your redeemable balance (${redeemable.toLocaleString()}).`); return; }
    if (price <= 0) { setErr('Set a price above $0.'); return; }
    if (!name.trim()) { setErr("Give supporters a name for what they're getting."); return; }
    if (!file) { setErr('Attach a digital product (PDF, slides, or similar).'); return; }
    setBusy(true);
    try {
      await createBuybackListing(dbucks, Math.round(price * 100), name.trim(), file);
      setCreating(false);
      onChanged();
    } catch (e: any) { setErr(e?.message ?? 'Could not create listing'); }
    finally { setBusy(false); }
  }

  async function cancel() {
    if (!listing) return;
    setBusy(true);
    try { await cancelBuybackListing(listing.id); onChanged(); }
    catch (e: any) { alert(e?.message ?? 'Could not cancel listing'); }
    finally { setBusy(false); }
  }

  if (listing?.status === 'active') {
    return (
      <div style={{ marginTop: 12 }}>
        <div style={{ ...statusRow, color: C.jadeHi }}>
          <Dot color={C.jade} /> Listed — {listing.dbucks_amount.toLocaleString()} D-Bucks for ${(listing.price_cents / 100).toFixed(2)}
        </div>
        <div style={{ fontFamily: ui, fontSize: 13, color: C.dim, marginTop: 6 }}>{listing.product_name}</div>
        <button onClick={cancel} disabled={busy} style={{ ...ghostBtn, marginTop: 14 }}>
          {busy ? '…' : 'Cancel listing'}
        </button>
      </div>
    );
  }

  if (listing?.status === 'sold' && !creating) {
    return (
      <div style={{ marginTop: 12 }}>
        <div style={{ ...statusRow, color: C.gold }}>
          <Dot color={C.gold} /> Last listing sold — {listing.dbucks_amount.toLocaleString()} D-Bucks for ${(listing.price_cents / 100).toFixed(2)}
        </div>
        <button onClick={() => setCreating(true)} style={{ ...solidGold, marginTop: 14 }}>Create a new listing</button>
      </div>
    );
  }

  if (!creating) {
    return (
      <div style={{ marginTop: 12 }}>
        <p style={{ fontFamily: ui, fontSize: 13.5, color: C.dim, lineHeight: 1.5, margin: '0 0 12px' }}>
          Offer some of your redeemable D-Bucks ({redeemable.toLocaleString()} available) for real money, with a
          digital product attached as the incentive. Money goes straight to your bank — 85% to you, 15% platform fee.
        </p>
        <button onClick={() => setCreating(true)} disabled={redeemable <= 0} style={solidGold}>
          {redeemable <= 0 ? 'No redeemable D-Bucks yet' : '+ Create a listing'}
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Field label={`D-Bucks to offer (up to ${redeemable.toLocaleString()})`}>
        <input type="number" min={1} max={redeemable} value={dbucks}
          onChange={e => setDbucks(Math.max(1, Math.min(redeemable, +e.target.value)))} style={field} />
      </Field>
      <Field label="Price supporters pay (USD)">
        <input type="number" min={1} step="0.01" value={price} onChange={e => setPrice(+e.target.value)} style={field} />
      </Field>
      <Field label="What are they getting?">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. My debate prep notes" style={field} />
      </Field>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
        <span style={{ ...ghostBtn, fontSize: 12.5, padding: '8px 13px' }}>
          {file ? `✓ ${file.name}` : 'Attach file (PDF, PPTX, etc.)'}
        </span>
        <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={e => setFile(e.target.files?.[0] ?? null)} />
      </label>
      {err && <div style={{ fontFamily: ui, fontSize: 12.5, color: C.garnetHi }}>{err}</div>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={submit} disabled={busy} style={{ ...solidGold, opacity: busy ? .6 : 1 }}>
          {busy ? 'Creating…' : 'List it'}
        </button>
        <button onClick={() => setCreating(false)} style={ghostBtn}>Cancel</button>
      </div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: ui, fontSize: 11.5, fontWeight: 600, color: C.dim }}>
      {label}
      {children}
    </label>
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
