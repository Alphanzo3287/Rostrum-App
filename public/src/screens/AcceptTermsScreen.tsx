// =====================================================================
// The Rostrum · src/screens/AcceptTermsScreen.tsx
// Shown once, right after signup, before onboarding/the tutorial.
// Requires an explicit checkbox + click to record real consent.
// =====================================================================
import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { TermsScreen, TERMS_VERSION } from './TermsScreen';
import { PrivacyScreen, PRIVACY_VERSION } from './PrivacyScreen';
import { C, ui, display, solidGold } from '../lib/theme';

const COMBINED_VERSION = `${TERMS_VERSION}+${PRIVACY_VERSION}`;

export function AcceptTermsScreen({ onDone }: { onDone: () => void }) {
  const [view, setView] = useState<'terms' | 'privacy' | null>(null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function accept() {
    setBusy(true); setErr('');
    try {
      const { error } = await supabase.rpc('accept_terms', { p_version: COMBINED_VERSION });
      if (error) throw error;
      onDone();
    } catch (e: any) {
      setErr(e?.message ?? 'Could not save — please try again.');
    } finally { setBusy(false); }
  }

  if (view) {
    return (
      <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', background: C.base, padding: '30px 20px 40px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto 18px' }}>
          <button onClick={() => setView(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer',
            fontFamily: ui, fontSize: 13, color: C.dim, padding: 0 }}>← Back</button>
        </div>
        {view === 'terms' ? <TermsScreen embedded /> : <PrivacyScreen embedded />}
      </div>
    );
  }

  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', display: 'grid', placeItems: 'center',
      padding: '40px 20px', background: `radial-gradient(120% 80% at 50% -10%, #221a13, ${C.base} 60%)` }}>
      <div style={{ width: '100%', maxWidth: 520, background: C.panel, border: `1px solid ${C.hair}`,
        borderRadius: 16, padding: '32px 30px' }}>
        <h1 style={{ fontFamily: display, fontWeight: 700, fontSize: 26, color: C.ink, margin: '0 0 10px' }}>
          Before you take the floor
        </h1>
        <p style={{ fontFamily: ui, fontSize: 14, color: C.dim, lineHeight: 1.6, margin: '0 0 22px' }}>
          Please review and accept our Terms of Service and Privacy Policy to continue to The Rostrum.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
          <LinkRow label="Terms of Service" onClick={() => setView('terms')} />
          <LinkRow label="Privacy Policy" onClick={() => setView('privacy')} />
        </div>

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginBottom: 20 }}>
          <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)}
            style={{ marginTop: 3, width: 16, height: 16, accentColor: C.gold, flexShrink: 0 }} />
          <span style={{ fontFamily: ui, fontSize: 13.5, color: C.dim, lineHeight: 1.5 }}>
            I have read and agree to the Terms of Service and Privacy Policy.
          </span>
        </label>

        {err && <p style={{ fontFamily: ui, fontSize: 12.5, color: C.garnetHi, margin: '0 0 14px' }}>{err}</p>}

        <button onClick={accept} disabled={!checked || busy}
          style={{ ...solidGold, width: '100%', opacity: (!checked || busy) ? 0.5 : 1 }}>
          {busy ? 'Saving…' : 'Agree and continue'}
        </button>
      </div>
    </div>
  );
}

function LinkRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      width: '100%', padding: '12px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
      background: C.panel2, border: `1px solid ${C.hair}`, fontFamily: ui, fontSize: 14, fontWeight: 600, color: C.ink }}>
      {label} <span style={{ color: C.faint }}>→</span>
    </button>
  );
}
