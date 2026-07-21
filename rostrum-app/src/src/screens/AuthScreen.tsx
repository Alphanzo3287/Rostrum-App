// =====================================================================
// The Rostrum · src/screens/AuthScreen.tsx (2026 redesign)
// Premium split-screen: cinematic hero panel + glass auth card.
// =====================================================================
import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { C, ui, display, mono, solidGold, field, a } from '../lib/theme';
import { useIsTablet } from '../lib/useMediaQuery';

export function AuthScreen({ onSignedUp, notice }: { onSignedUp: () => void; notice?: string }) {
  const { signIn, signUp, resetPasswordForEmail } = useAuth();
  const [mode, setMode] = useState<'signup' | 'login'>(notice ? 'login' : 'signup');
  const [view, setView] = useState<'auth' | 'reset'>('auth');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const isMobile = useIsTablet();

  async function submit() {
    setErr(null); setBusy(true);
    try {
      if (mode === 'signup') {
        if (!name.trim()) throw new Error('Add a display name');
        await signUp({ email, password: pw, displayName: name });
        onSignedUp();
      } else {
        await signIn(email, pw);
      }
    } catch (e: any) {
      setErr(e?.message ?? 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  async function sendReset() {
    setErr(null);
    if (!email.trim()) { setErr('Enter your email first.'); return; }
    setBusy(true);
    try {
      await resetPasswordForEmail(email);
      setResetSent(true);
    } catch (e: any) {
      setErr(e?.message ?? 'Could not send the reset email.');
    } finally {
      setBusy(false);
    }
  }

  const focusField = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = a(C.gold,'80'); e.currentTarget.style.background = C.glass; };
  const blurField  = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = C.hair; };

  return (
    <div style={{ position:'absolute', inset:0, display:'flex', background:C.base, overflow:'auto' }}>

      {/* ── Hero panel (hidden on mobile) ── */}
      {!isMobile && (
        <div style={{ flex:'1 1 0', position:'relative', minWidth:0,
          background:`linear-gradient(135deg, ${a(C.gold,'24')}, ${a(C.cyan,'12')}), url('/hero-coliseum.png') center/cover no-repeat` }}>
          <div style={{ position:'absolute', inset:0,
            background:`linear-gradient(180deg, rgba(9,11,16,0.5) 0%, rgba(9,11,16,0.4) 50%, rgba(9,11,16,0.85) 100%)` }} />
          <div style={{ position:'relative', height:'100%', display:'flex', flexDirection:'column',
            justifyContent:'space-between', padding:'48px 52px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:44, height:44, borderRadius:13, display:'grid', placeItems:'center',
                background:`linear-gradient(135deg, ${C.gold}, ${C.cyan})`,
                boxShadow:`0 8px 24px ${a(C.gold,'4D')}` }}>
                <img src="/logo-icon.png" alt="" style={{ width:28, height:28, objectFit:'contain' }} />
              </div>
              <div style={{ lineHeight:1.05 }}>
                <div style={{ fontFamily:display, fontSize:12, fontWeight:600, color:a('#FFFFFF','B3'),
                  letterSpacing:'.18em', textTransform:'uppercase' }}>THE</div>
                <div style={{ fontFamily:display, fontSize:22, fontWeight:700, color:'#FFFFFF', letterSpacing:'-.01em' }}>
                  ROSTRUM
                </div>
              </div>
            </div>

            <div style={{ maxWidth:460 }}>
              <h1 style={{ fontFamily:display, fontSize:'clamp(36px,4vw,52px)', fontWeight:700, color:'#FFFFFF',
                lineHeight:1.05, margin:'0 0 18px', letterSpacing:'-.02em' }}>
                Where Ideas<br/>Take the Stage.
              </h1>
              <p style={{ fontFamily:ui, fontSize:16, color:a('#FFFFFF','C0'), lineHeight:1.6, margin:0 }}>
                Join the world's premier platform for intelligent discourse. Watch, debate, vote, and influence.
              </p>
              <div style={{ display:'flex', gap:28, marginTop:32 }}>
                {[['128K','Debaters'],['2.4M','Votes'],['198','Countries']].map(([v,l]) => (
                  <div key={l}>
                    <div style={{ fontFamily:display, fontSize:26, fontWeight:700, color:'#FFFFFF', lineHeight:1 }}>{v}</div>
                    <div style={{ fontFamily:ui, fontSize:11, color:a('#FFFFFF','99'), marginTop:4,
                      textTransform:'uppercase', letterSpacing:'.08em' }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ fontFamily:mono, fontSize:11, color:a('#FFFFFF','66') }}>
              © 2026 The Rostrum · Premier debate platform
            </div>
          </div>
        </div>
      )}

      {/* ── Auth card panel ── */}
      <div style={{ flex: isMobile ? '1 1 0' : '0 0 480px', display:'grid', placeItems:'center',
        padding:'40px 28px', minWidth:0 }}>
        <div style={{ width:'100%', maxWidth:380 }}>
          {isMobile && (
            <div style={{ textAlign:'center', marginBottom:28 }}>
              <div style={{ width:52, height:52, borderRadius:15, margin:'0 auto 16px', display:'grid', placeItems:'center',
                background:`linear-gradient(135deg, ${C.gold}, ${C.cyan})`, boxShadow:`0 8px 24px ${a(C.gold,'4D')}` }}>
                <img src="/logo-icon.png" alt="" style={{ width:32, height:32, objectFit:'contain' }} />
              </div>
              <div style={{ fontFamily:display, fontSize:24, fontWeight:700, color:C.ink, letterSpacing:'-.01em' }}>
                THE ROSTRUM
              </div>
            </div>
          )}

          <h2 style={{ fontFamily:display, fontSize:30, fontWeight:700, color:C.ink, margin:'0 0 6px', letterSpacing:'-.02em' }}>
            {view === 'reset' ? 'Reset your password' : mode === 'signup' ? 'Create your account' : 'Welcome back'}
          </h2>
          <p style={{ fontFamily:ui, fontSize:14, color:C.faint, margin:'0 0 28px' }}>
            {view === 'reset' ? "Enter your email and we'll send you a reset link."
              : mode === 'signup' ? 'Join the chamber and start debating.' : 'Sign in to enter the chamber.'}
          </p>

          {notice && (
            <div style={{ marginBottom:20, padding:'12px 14px', borderRadius:10, fontFamily:ui, fontSize:12.5,
              lineHeight:1.5, color:C.jadeHi, background:a(C.jade,'14'), border:`1px solid ${a(C.jade,'44')}` }}>
              {notice}
            </div>
          )}

          {view === 'reset' ? (
            resetSent ? (
              <>
                <div style={{ padding:'14px 16px', borderRadius:10, fontFamily:ui, fontSize:13, lineHeight:1.55,
                  color:C.jadeHi, background:a(C.jade,'14'), border:`1px solid ${a(C.jade,'44')}` }}>
                  Check your email — if an account exists for {email.trim()}, a password-reset link is on its way.
                  Open it on this device to set a new password.
                </div>
                <button onClick={() => { setView('auth'); setResetSent(false); setErr(null); }}
                  style={{ ...solidGold, width:'100%', marginTop:18, padding:'14px', fontSize:14.5 }}>
                  Back to login
                </button>
              </>
            ) : (
              <>
                <Labeled label="email" lower>
                  <input value={email} onChange={e => setEmail(e.target.value)} placeholder="email"
                    type="email" autoCapitalize="none" autoCorrect="off" autoComplete="email" spellCheck={false} inputMode="email"
                    style={field} onFocus={focusField} onBlur={blurField}
                    onKeyDown={e => { if (e.key === 'Enter') sendReset(); }} />
                </Labeled>
                {err && (
                  <div style={{ fontFamily:ui, fontSize:12.5, color:C.garnetHi, margin:'4px 0 14px',
                    padding:'10px 12px', borderRadius:10, background:a(C.garnet,'14'), border:`1px solid ${a(C.garnet,'33')}` }}>
                    {err}
                  </div>
                )}
                <button onClick={sendReset} disabled={busy}
                  style={{ ...solidGold, width:'100%', marginTop:8, padding:'14px', fontSize:14.5, opacity: busy ? 0.6 : 1 }}>
                  {busy ? 'Sending…' : 'Send reset link'}
                </button>
                <button onClick={() => { setView('auth'); setErr(null); }}
                  style={{ background:'none', border:'none', cursor:'pointer', width:'100%', marginTop:16,
                    fontFamily:ui, fontSize:13, color:C.dim }}>
                  ← Back to login
                </button>
              </>
            )
          ) : (
          <>
          {/* Mode toggle */}
          <div style={{ display:'flex', gap:5, background:C.glass, padding:5, borderRadius:12, marginBottom:24,
            border:`1px solid ${C.hair}` }}>
            {(['signup', 'login'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)} style={{
                flex:1, padding:'10px 0', borderRadius:9, border:'none', cursor:'pointer', fontFamily:ui,
                fontWeight:600, fontSize:13.5, color: mode === m ? '#FFFFFF' : C.dim, transition:'all .2s',
                background: mode === m ? `linear-gradient(135deg, ${C.gold}, ${C.cyan})` : 'transparent',
                boxShadow: mode === m ? `0 6px 18px ${a(C.gold,'40')}` : 'none' }}>
                {m === 'signup' ? 'Create account' : 'Log in'}
              </button>
            ))}
          </div>

          {mode === 'signup' && (
            <Labeled label="Display name">
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
                style={field} onFocus={focusField} onBlur={blurField} />
            </Labeled>
          )}
          <Labeled label="email" lower>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="email"
              type="email" autoCapitalize="none" autoCorrect="off" autoComplete="email" spellCheck={false} inputMode="email"
              style={field} onFocus={focusField} onBlur={blurField} />
          </Labeled>
          <Labeled label="Password">
            <div style={{ position: 'relative' }}>
              <input value={pw} onChange={e => setPw(e.target.value)} type={showPw ? 'text' : 'password'} placeholder="••••••••"
                autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                style={{ ...field, paddingRight: 46 }} onFocus={focusField} onBlur={blurField}
                onKeyDown={e => { if (e.key === 'Enter') submit(); }} />
              <button type="button" onClick={() => setShowPw(v => !v)} tabIndex={-1}
                aria-label={showPw ? 'Hide password' : 'Show password'}
                title={showPw ? 'Hide password' : 'Show password'}
                style={{ position: 'absolute', right: 8, top: 0, bottom: 0, display: 'flex', alignItems: 'center',
                  background: 'none', border: 'none', cursor: 'pointer', padding: '0 6px', color: C.faint }}
                onMouseEnter={e => { e.currentTarget.style.color = C.dim; }}
                onMouseLeave={e => { e.currentTarget.style.color = C.faint; }}>
                {showPw ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.68" />
                    <path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.39-1.61" />
                    <line x1="2" y1="2" x2="22" y2="22" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </Labeled>

          {mode === 'login' && (
            <div style={{ textAlign:'right', marginTop:-8, marginBottom:6 }}>
              <button onClick={() => { setView('reset'); setErr(null); setResetSent(false); }}
                style={{ background:'none', border:'none', cursor:'pointer', fontFamily:ui, fontSize:12.5,
                  color:C.gold, fontWeight:600 }}>
                Forgot password?
              </button>
            </div>
          )}

          {err && (
            <div style={{ fontFamily:ui, fontSize:12.5, color:C.garnetHi, margin:'4px 0 14px',
              padding:'10px 12px', borderRadius:10, background:a(C.garnet,'14'), border:`1px solid ${a(C.garnet,'33')}` }}>
              {err}
            </div>
          )}

          <button onClick={submit} disabled={busy}
            style={{ ...solidGold, width:'100%', marginTop:8, padding:'14px', fontSize:14.5,
              opacity: busy ? 0.6 : 1, cursor: busy ? 'default' : 'pointer' }}>
            {busy ? 'One moment…' : mode === 'signup' ? 'Create my profile' : 'Enter the chamber'}
          </button>

          <p style={{ fontFamily:ui, fontSize:12, color:C.faint, textAlign:'center', margin:'20px 0 0', lineHeight:1.6 }}>
            By continuing you agree to The Rostrum's<br/>
            <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color:C.dim }}>Terms of Service</a>
            {' '}and{' '}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color:C.dim }}>Privacy Policy</a>.
          </p>
          </>
          )}
        </div>
      </div>
    </div>
  );
}

function Labeled({ label, children, lower }: { label: string; children: React.ReactNode; lower?: boolean }) {
  return (
    <label style={{ display:'block', marginBottom:16 }}>
      <span style={{ fontFamily:ui, fontSize:11.5, fontWeight:700, letterSpacing:'.06em',
        textTransform: lower ? 'none' : 'uppercase', color:C.dim }}>{label}</span>
      <div style={{ marginTop:8 }}>{children}</div>
    </label>
  );
}
