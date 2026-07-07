// =====================================================================
// The Rostrum · src/screens/ProScreen.tsx
// The "Upgrade to Rostrum Pro" page: value prop, plan toggle, and a real
// Free-vs-Pro comparison. If already Pro, shows membership status instead.
// =====================================================================
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { isPro, subscribeToPro, openBillingPortal, PRO_PRICING, type ProPlanId } from '../lib/pro';
import { C, ui, display, a, solidGold, ghostBtn } from '../lib/theme';

type Row = { label: string; free: string | boolean; pro: string | boolean };

const FEATURES: { group: string; rows: Row[] }[] = [
  {
    group: 'Core experience',
    rows: [
      { label: 'Join & watch every debate', free: true, pro: true },
      { label: 'Host debates in all formats', free: true, pro: true },
      { label: 'Compete in tournaments & communities', free: true, pro: true },
      { label: 'Earn & cash out D-Bucks', free: true, pro: true },
    ],
  },
  {
    group: 'Creator & host tools',
    rows: [
      { label: 'Replay storage', free: '7 days', pro: 'Unlimited' },
      { label: 'Recording quality', free: 'Standard', pro: 'HD, no watermark' },
      { label: 'Audience capacity per room', free: 'Standard', pro: 'Expanded' },
      { label: 'Room & broadcast branding', free: false, pro: true },
      { label: 'Debate analytics (viewers, drop-off, votes)', free: false, pro: true },
    ],
  },
  {
    group: 'Status & economics',
    rows: [
      { label: 'Pro badge on profile & in rooms', free: false, pro: true },
      { label: 'Profile customization & priority visibility', free: false, pro: true },
      { label: 'Cash-out platform fee', free: '15%', pro: '10%' },
      { label: 'Monthly D-Bucks to gift & support debaters', free: false, pro: '500 / mo' },
      { label: 'Priority support & early access', free: false, pro: true },
    ],
  },
];

export function ProScreen() {
  const { profile } = useAuth();
  const [params] = useSearchParams();
  const [plan, setPlan] = useState<ProPlanId>('annual');
  const [busy, setBusy] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);
  const [err, setErr] = useState('');

  const alreadyPro = isPro(profile);
  const justUpgraded = params.get('upgrade') === 'success';

  async function go() {
    setBusy(true); setErr('');
    try { await subscribeToPro(plan); }
    catch (e: any) { setErr(e?.message ?? 'Could not start checkout'); setBusy(false); }
  }

  async function manage() {
    setPortalBusy(true); setErr('');
    try { await openBillingPortal(); }
    catch (e: any) { setErr(e?.message ?? 'Could not open billing portal'); setPortalBusy(false); }
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '30px 20px 70px' }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 30 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 14px', borderRadius: 999,
          background: a(C.gold, '18'), border: `1px solid ${a(C.gold, '55')}`, marginBottom: 16 }}>
          <span style={{ fontSize: 15 }}>👑</span>
          <span style={{ fontFamily: ui, fontSize: 12, fontWeight: 800, letterSpacing: '.08em',
            textTransform: 'uppercase', color: C.gold }}>Rostrum Pro</span>
        </div>
        <h1 style={{ fontFamily: display, fontSize: 34, fontWeight: 700, color: C.ink, margin: '0 0 10px', lineHeight: 1.1 }}>
          {alreadyPro ? "You're a Pro member" : 'Take the stage like a Pro'}
        </h1>
        <p style={{ fontFamily: ui, fontSize: 15, color: C.faint, margin: '0 auto', maxWidth: 520, lineHeight: 1.55 }}>
          {alreadyPro
            ? 'Thanks for supporting The Rostrum. Your Pro perks are active across the platform.'
            : 'Everything on The Rostrum stays free. Pro makes you more powerful — more reach, more storage, better economics, and status that stands out.'}
        </p>
      </div>

      {justUpgraded && (
        <div style={{ padding: 14, borderRadius: 12, marginBottom: 20, textAlign: 'center',
          background: a(C.jade, '16'), border: `1px solid ${a(C.jade, '50')}`,
          fontFamily: ui, fontSize: 13.5, color: C.jadeHi }}>
          🎉 Welcome to Rostrum Pro! Your membership is being activated — perks appear within a moment.
        </div>
      )}

      {/* Manage membership (Pro members) */}
      {alreadyPro && (
        <div style={{ maxWidth: 480, margin: '0 auto 30px', padding: '20px 22px', borderRadius: 16,
          background: C.panel, border: `1px solid ${a(C.gold, '33')}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 15 }}>👑</span>
            <span style={{ fontFamily: display, fontSize: 16, fontWeight: 700, color: C.ink }}>Your membership</span>
          </div>
          <p style={{ fontFamily: ui, fontSize: 13, color: C.dim, margin: '0 0 16px', lineHeight: 1.5 }}>
            {profile?.pro_until
              ? <>Active — your plan renews on <b style={{ color: C.ink }}>{new Date(profile.pro_until).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</b>.</>
              : 'Your Pro membership is active.'}
          </p>
          {err && <p style={{ fontFamily: ui, fontSize: 12.5, color: C.garnetHi, margin: '0 0 12px' }}>{err}</p>}
          <button onClick={manage} disabled={portalBusy}
            style={{ ...ghostBtn, width: '100%', opacity: portalBusy ? 0.6 : 1 }}>
            {portalBusy ? 'Opening…' : 'Manage plan · update card · cancel'}
          </button>
          <p style={{ fontFamily: ui, fontSize: 11, color: C.faint, textAlign: 'center', margin: '10px 0 0' }}>
            Cancel anytime — you keep Pro until the end of your paid period, then it simply lapses.
          </p>
        </div>
      )}

      {/* Plan toggle + CTA (hidden if already Pro) */}
      {!alreadyPro && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginBottom: 30 }}>
          <div style={{ display: 'inline-flex', background: C.panel, border: `1px solid ${C.hair}`,
            borderRadius: 12, padding: 4, gap: 4 }}>
            {(['annual', 'monthly'] as ProPlanId[]).map(p => {
              const on = plan === p;
              return (
                <button key={p} onClick={() => setPlan(p)}
                  style={{ position: 'relative', padding: '9px 20px', borderRadius: 9, cursor: 'pointer',
                    border: 'none', fontFamily: ui, fontSize: 13.5, fontWeight: 700,
                    color: on ? C.base : C.dim,
                    background: on ? `linear-gradient(135deg, ${C.gold}, ${C.cyan})` : 'transparent' }}>
                  {PRO_PRICING[p].label}
                  {PRO_PRICING[p].note && (
                    <span style={{ marginLeft: 7, fontSize: 10.5, fontWeight: 800, padding: '2px 6px', borderRadius: 6,
                      background: on ? a('#000000', '22') : a(C.jade, '20'), color: on ? C.base : C.jadeHi }}>
                      {PRO_PRICING[p].note}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div style={{ textAlign: 'center' }}>
            <span style={{ fontFamily: display, fontSize: 40, fontWeight: 700, color: C.ink }}>{PRO_PRICING[plan].price}</span>
            <span style={{ fontFamily: ui, fontSize: 15, color: C.faint }}>{PRO_PRICING[plan].per}</span>
          </div>

          {err && <p style={{ fontFamily: ui, fontSize: 13, color: C.garnetHi, margin: 0 }}>{err}</p>}

          <button onClick={go} disabled={busy}
            style={{ ...solidGold, padding: '13px 40px', fontSize: 15, opacity: busy ? 0.6 : 1 }}>
            {busy ? 'One moment…' : 'Upgrade to Pro'}
          </button>
          <p style={{ fontFamily: ui, fontSize: 11.5, color: C.faint, margin: 0 }}>
            Cancel anytime · secure checkout by Stripe
          </p>
        </div>
      )}

      {/* Comparison table */}
      <div style={{ border: `1px solid ${C.hair}`, borderRadius: 16, overflow: 'hidden', background: C.panel }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr', alignItems: 'center',
          padding: '14px 18px', borderBottom: `1px solid ${C.hair}`, background: C.panel2 }}>
          <span style={{ fontFamily: ui, fontSize: 12, fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: '.05em' }}>Feature</span>
          <span style={{ fontFamily: ui, fontSize: 13, fontWeight: 700, color: C.dim, textAlign: 'center' }}>Free</span>
          <span style={{ fontFamily: ui, fontSize: 13, fontWeight: 800, textAlign: 'center',
            background: `linear-gradient(135deg, ${C.gold}, ${C.cyan})`, WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Pro</span>
        </div>

        {FEATURES.map(section => (
          <div key={section.group}>
            <div style={{ padding: '11px 18px 5px', fontFamily: ui, fontSize: 11, fontWeight: 800,
              letterSpacing: '.07em', textTransform: 'uppercase', color: C.gold }}>{section.group}</div>
            {section.rows.map((row, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr', alignItems: 'center',
                padding: '11px 18px', borderTop: `1px solid ${a(C.hair, '80')}` }}>
                <span style={{ fontFamily: ui, fontSize: 13.5, color: C.ink }}>{row.label}</span>
                <Cell v={row.free} />
                <Cell v={row.pro} pro />
              </div>
            ))}
          </div>
        ))}
      </div>

      <p style={{ fontFamily: ui, fontSize: 12, color: C.faint, textAlign: 'center', marginTop: 18, lineHeight: 1.5 }}>
        The free tier is genuinely complete — Pro is for members who want to do more and stand out.
      </p>
    </div>
  );
}

function Cell({ v, pro }: { v: string | boolean; pro?: boolean }) {
  if (typeof v === 'boolean') {
    return (
      <span style={{ textAlign: 'center', fontSize: 15, color: v ? (pro ? C.jadeHi : C.dim) : C.faint }}>
        {v ? '✓' : '—'}
      </span>
    );
  }
  return (
    <span style={{ fontFamily: ui, fontSize: 12.5, fontWeight: pro ? 700 : 500, textAlign: 'center',
      color: pro ? C.jadeHi : C.dim }}>{v}</span>
  );
}
