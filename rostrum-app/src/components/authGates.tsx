// =====================================================================
// The Rostrum · src/components/authGates.tsx
// Two full-screen gates shown by <Gate> in App.tsx:
//   MfaChallengeScreen — a signed-in-but-aal1 user with 2FA enters their
//                        authenticator code to finish signing in.
//   ResetPasswordScreen — a user who arrived from a password-reset email
//                         sets a new password.
// Both mirror the AuthScreen card styling.
// =====================================================================
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/auth';
import { C, ui, display, solidGold, ghostBtn, field, a } from '../lib/theme';

function Shell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center', background:C.base, padding:20 }}>
      <div style={{ width:400, maxWidth:'100%', borderRadius:18, background:C.panel, border:`1px solid ${C.hair}`,
        padding:'32px 28px', boxShadow:'0 24px 70px rgba(0,0,0,.5)' }}>
        <div style={{ width:48, height:48, borderRadius:14, margin:'0 auto 18px', display:'grid', placeItems:'center',
          background:`linear-gradient(135deg, ${C.gold}, ${C.cyan})` }}>
          <img src="/logo-icon.png" alt="" style={{ width:30, height:30, objectFit:'contain' }} />
        </div>
        <h2 style={{ fontFamily:display, fontSize:22, fontWeight:700, color:C.ink, margin:'0 0 6px', textAlign:'center' }}>{title}</h2>
        <p style={{ fontFamily:ui, fontSize:13.5, color:C.faint, margin:'0 0 22px', textAlign:'center', lineHeight:1.5 }}>{subtitle}</p>
        {children}
      </div>
    </div>
  );
}

const codeField: React.CSSProperties = { ...field, textAlign:'center', letterSpacing:'.4em', fontSize:20, fontWeight:700 };

export function MfaChallengeScreen() {
  const { signOut, refreshAuthLevel } = useAuth();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.mfa.listFactors().then(({ data }) => {
      const totp = data?.totp?.find(f => f.status === 'verified') ?? data?.totp?.[0];
      setFactorId(totp?.id ?? null);
      setReady(true);
    }).catch(() => setReady(true));
  }, []);

  async function verify() {
    if (!factorId) { setErr('No authenticator is set up on this account.'); return; }
    if (code.trim().length < 6) { setErr('Enter the 6-digit code from your app.'); return; }
    setBusy(true); setErr(null);
    try {
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
      if (chErr) throw chErr;
      const { error: vErr } = await supabase.auth.mfa.verify({ factorId, challengeId: ch.id, code: code.trim() });
      if (vErr) throw vErr;
      await refreshAuthLevel(); // session is now aal2 → Gate proceeds into the app
    } catch (e: any) {
      setErr(e?.message ?? 'That code didn\'t work — try again.');
      setBusy(false);
    }
  }

  return (
    <Shell title="Two-step verification" subtitle="Enter the 6-digit code from your authenticator app to finish signing in.">
      <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric"
        placeholder="000000" autoFocus style={codeField}
        onKeyDown={e => { if (e.key === 'Enter') verify(); }} />
      {err && <div style={{ fontFamily:ui, fontSize:12.5, color:C.garnetHi, margin:'12px 0 0', textAlign:'center' }}>{err}</div>}
      <button onClick={verify} disabled={busy || !ready} style={{ ...solidGold, width:'100%', marginTop:18, opacity: busy ? .6 : 1 }}>
        {busy ? 'Verifying…' : 'Verify'}
      </button>
      <button onClick={signOut} style={{ ...ghostBtn, width:'100%', marginTop:10 }}>Sign out</button>
    </Shell>
  );
}

export function ResetPasswordScreen() {
  const { updatePassword, signOut } = useAuth();
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    setErr(null);
    if (pw.length < 8) { setErr('Use at least 8 characters.'); return; }
    if (pw !== confirm) { setErr('The two passwords don\'t match.'); return; }
    setBusy(true);
    try {
      await updatePassword(pw);
      setDone(true);
      // updatePassword clears recovery + re-syncs; the Gate will move on.
    } catch (e: any) {
      setErr(e?.message ?? 'Could not update your password.');
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Shell title="Password updated" subtitle="You're all set — signing you in…">
        <div style={{ textAlign:'center', fontSize:34 }}>✓</div>
      </Shell>
    );
  }

  return (
    <Shell title="Set a new password" subtitle="Choose a new password for your account.">
      <label style={{ display:'block', marginBottom:14 }}>
        <span style={{ fontFamily:ui, fontSize:11.5, fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase', color:C.dim }}>New password</span>
        <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="••••••••"
          style={{ ...field, marginTop:8 }} />
      </label>
      <label style={{ display:'block', marginBottom:4 }}>
        <span style={{ fontFamily:ui, fontSize:11.5, fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase', color:C.dim }}>Confirm password</span>
        <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••"
          style={{ ...field, marginTop:8 }} onKeyDown={e => { if (e.key === 'Enter') submit(); }} />
      </label>
      {err && <div style={{ fontFamily:ui, fontSize:12.5, color:C.garnetHi, margin:'12px 0 0' }}>{err}</div>}
      <button onClick={submit} disabled={busy} style={{ ...solidGold, width:'100%', marginTop:18, opacity: busy ? .6 : 1 }}>
        {busy ? 'Saving…' : 'Update password'}
      </button>
      <button onClick={signOut} style={{ ...ghostBtn, width:'100%', marginTop:10 }}>Back to login</button>
    </Shell>
  );
}
