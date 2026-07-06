// =====================================================================
// The Rostrum · src/components/SecurityModal.tsx
// Account security settings — currently two-factor authentication (TOTP).
// Opened from the profile menu. Handles enrolling a new authenticator
// (QR + manual secret + verify) and turning 2FA back off.
// =====================================================================
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/auth';
import { C, ui, display, mono, solidGold, ghostBtn, field, a } from '../lib/theme';

type Stage = 'loading' | 'off' | 'enrolling' | 'on';

export function SecurityModal({ onClose }: { onClose: () => void }) {
  const { refreshAuthLevel } = useAuth();
  const [stage, setStage] = useState<Stage>('loading');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      const verified = data?.totp?.find(f => f.status === 'verified');
      if (verified) { setFactorId(verified.id); setStage('on'); }
      else setStage('off');
    } catch { setStage('off'); }
  }
  useEffect(() => { refresh(); }, []);

  async function startEnroll() {
    setBusy(true); setErr(null);
    try {
      // Clear any half-finished (unverified) factors first so re-tries
      // don't pile up orphans.
      const { data: existing } = await supabase.auth.mfa.listFactors();
      for (const f of existing?.totp ?? []) {
        if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id }).catch(() => {});
      }
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
      if (error) throw error;
      setFactorId(data.id);
      setQr(data.totp.qr_code);
      setSecret(data.totp.secret);
      setStage('enrolling');
    } catch (e: any) { setErr(e?.message ?? 'Could not start setup.'); }
    finally { setBusy(false); }
  }

  async function confirmEnroll() {
    if (!factorId) return;
    if (code.trim().length < 6) { setErr('Enter the 6-digit code from your app.'); return; }
    setBusy(true); setErr(null);
    try {
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
      if (chErr) throw chErr;
      const { error: vErr } = await supabase.auth.mfa.verify({ factorId, challengeId: ch.id, code: code.trim() });
      if (vErr) throw vErr;
      await refreshAuthLevel();
      setCode(''); setQr(null); setSecret(null);
      setStage('on');
    } catch (e: any) { setErr(e?.message ?? 'That code didn\'t work — try again.'); }
    finally { setBusy(false); }
  }

  async function cancelEnroll() {
    if (factorId) await supabase.auth.mfa.unenroll({ factorId }).catch(() => {});
    setFactorId(null); setQr(null); setSecret(null); setCode(''); setErr(null);
    refresh();
  }

  async function disable() {
    if (!factorId) return;
    if (!window.confirm('Turn off two-factor authentication? Your account will be less protected.')) return;
    setBusy(true); setErr(null);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      await refreshAuthLevel();
      setFactorId(null);
      setStage('off');
    } catch (e: any) { setErr(e?.message ?? 'Could not turn off 2FA.'); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:300, display:'grid', placeItems:'center',
      background:a(C.base,'CC'), backdropFilter:'blur(6px)', padding:20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width:420, maxWidth:'100%', borderRadius:16, background:C.panel, border:`1px solid ${C.hair}`,
        padding:24, boxShadow:'0 24px 70px rgba(0,0,0,.55)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
          <h3 style={{ fontFamily:display, fontSize:19, color:C.ink, margin:0 }}>Two-factor authentication</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.faint, fontSize:22, cursor:'pointer' }}>×</button>
        </div>

        {stage === 'loading' && (
          <p style={{ fontFamily:ui, fontSize:13, color:C.faint, marginTop:12 }}>Loading…</p>
        )}

        {stage === 'off' && (
          <>
            <p style={{ fontFamily:ui, fontSize:13.5, color:C.dim, lineHeight:1.55, margin:'10px 0 18px' }}>
              Add a second step at login using an authenticator app (Google Authenticator, Authy, 1Password, etc.).
              Even if someone gets your password, they can't sign in without your phone.
            </p>
            {err && <div style={{ fontFamily:ui, fontSize:12.5, color:C.garnetHi, marginBottom:12 }}>{err}</div>}
            <button onClick={startEnroll} disabled={busy} style={{ ...solidGold, width:'100%', opacity: busy ? .6 : 1 }}>
              {busy ? 'Setting up…' : 'Set up two-factor authentication'}
            </button>
          </>
        )}

        {stage === 'enrolling' && (
          <>
            <p style={{ fontFamily:ui, fontSize:13, color:C.dim, lineHeight:1.5, margin:'10px 0 14px' }}>
              Scan this QR code with your authenticator app, then enter the 6-digit code it shows.
            </p>
            {qr && (
              <div style={{ display:'grid', placeItems:'center', marginBottom:12 }}>
                <img src={qr} alt="2FA QR code" width={180} height={180}
                  style={{ borderRadius:12, background:'#fff', padding:8 }} />
              </div>
            )}
            {secret && (
              <div style={{ marginBottom:14, textAlign:'center' }}>
                <div style={{ fontFamily:ui, fontSize:11, color:C.faint, marginBottom:4 }}>Or enter this key manually</div>
                <div style={{ fontFamily:mono, fontSize:12.5, color:C.ink, wordBreak:'break-all',
                  padding:'8px 10px', borderRadius:8, background:C.glass, border:`1px solid ${C.hair}` }}>{secret}</div>
              </div>
            )}
            <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric"
              placeholder="000000" autoFocus
              style={{ ...field, textAlign:'center', letterSpacing:'.4em', fontSize:19, fontWeight:700 }}
              onKeyDown={e => { if (e.key === 'Enter') confirmEnroll(); }} />
            {err && <div style={{ fontFamily:ui, fontSize:12.5, color:C.garnetHi, marginTop:10, textAlign:'center' }}>{err}</div>}
            <button onClick={confirmEnroll} disabled={busy} style={{ ...solidGold, width:'100%', marginTop:16, opacity: busy ? .6 : 1 }}>
              {busy ? 'Verifying…' : 'Verify & turn on'}
            </button>
            <button onClick={cancelEnroll} style={{ ...ghostBtn, width:'100%', marginTop:10 }}>Cancel</button>
          </>
        )}

        {stage === 'on' && (
          <>
            <div style={{ display:'flex', alignItems:'center', gap:9, margin:'14px 0 18px',
              fontFamily:ui, fontSize:14, fontWeight:600, color:C.jadeHi }}>
              <span style={{ width:9, height:9, borderRadius:'50%', background:C.jade }} />
              Two-factor authentication is on
            </div>
            {err && <div style={{ fontFamily:ui, fontSize:12.5, color:C.garnetHi, marginBottom:12 }}>{err}</div>}
            <button onClick={disable} disabled={busy}
              style={{ ...ghostBtn, width:'100%', color:C.garnetHi, borderColor:a(C.garnet,'55'), opacity: busy ? .6 : 1 }}>
              {busy ? 'Working…' : 'Turn off two-factor authentication'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
