// =====================================================================
// The Rostrum · src/screens/AuthScreen.tsx (2026 redesign)
// Premium split-screen: cinematic hero panel + glass auth card.
// =====================================================================
import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { C, ui, display, mono, solidGold, field, a } from '../lib/theme';
import { useIsTablet } from '../lib/useMediaQuery';

export function AuthScreen({ onSignedUp }: { onSignedUp: () => void }) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
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
                <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
                  <path d="M5 21h14v-2H5v2zM6 3v14h12V3H6zm10 12H8V5h8v10z" />
                </svg>
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
                <svg width="30" height="30" viewBox="0 0 24 24" fill="white">
                  <path d="M5 21h14v-2H5v2zM6 3v14h12V3H6zm10 12H8V5h8v10z" />
                </svg>
              </div>
              <div style={{ fontFamily:display, fontSize:24, fontWeight:700, color:C.ink, letterSpacing:'-.01em' }}>
                THE ROSTRUM
              </div>
            </div>
          )}

          <h2 style={{ fontFamily:display, fontSize:30, fontWeight:700, color:C.ink, margin:'0 0 6px', letterSpacing:'-.02em' }}>
            {mode === 'signup' ? 'Create your account' : 'Welcome back'}
          </h2>
          <p style={{ fontFamily:ui, fontSize:14, color:C.faint, margin:'0 0 28px' }}>
            {mode === 'signup' ? 'Join the chamber and start debating.' : 'Sign in to enter the chamber.'}
          </p>

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
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Marcus Cole"
                style={field} onFocus={focusField} onBlur={blurField} />
            </Labeled>
          )}
          <Labeled label="Email">
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com"
              style={field} onFocus={focusField} onBlur={blurField} />
          </Labeled>
          <Labeled label="Password">
            <input value={pw} onChange={e => setPw(e.target.value)} type="password" placeholder="••••••••"
              style={field} onFocus={focusField} onBlur={blurField}
              onKeyDown={e => { if (e.key === 'Enter') submit(); }} />
          </Labeled>

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
            By continuing you agree to The Rostrum's<br/>Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display:'block', marginBottom:16 }}>
      <span style={{ fontFamily:ui, fontSize:11.5, fontWeight:700, letterSpacing:'.06em',
        textTransform:'uppercase', color:C.dim }}>{label}</span>
      <div style={{ marginTop:8 }}>{children}</div>
    </label>
  );
}
