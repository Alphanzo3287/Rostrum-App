// =====================================================================
// The Rostrum · src/screens/AuthScreen.tsx
// The prototype Auth screen, wired to Supabase auth.
// =====================================================================
import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { C, ui, display, solidGold, field } from '../lib/theme';

export function AuthScreen({ onSignedUp }: { onSignedUp: () => void }) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null); setBusy(true);
    try {
      if (mode === 'signup') {
        if (!name.trim()) throw new Error('Add a display name');
        await signUp({ email, password: pw, displayName: name });
        onSignedUp();                       // -> onboarding
      } else {
        await signIn(email, pw);            // -> AuthProvider updates session
      }
    } catch (e: any) {
      setErr(e?.message ?? 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center', padding:'40px 20px',
      background:`radial-gradient(120% 80% at 50% -10%, #221a13, ${C.base} 60%)` }}>
      <div style={{ width:'100%', maxWidth:430 }}>
        <h1 style={{ fontFamily:display, fontWeight:600, fontSize:50, color:C.ink, textAlign:'center', margin:'0 0 6px' }}>
          The Rostrum</h1>
        <p style={{ fontFamily:ui, color:C.dim, fontSize:14, textAlign:'center', margin:'0 0 26px' }}>
          A live chamber for formal debate.</p>

        <div style={{ background:C.panel, border:`1px solid ${C.hair}`, borderRadius:14, padding:24 }}>
          <div style={{ display:'flex', gap:6, background:C.base, padding:5, borderRadius:10, marginBottom:20 }}>
            {(['signup', 'login'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)} style={{
                flex:1, padding:'9px 0', borderRadius:8, border:'none', cursor:'pointer', fontFamily:ui,
                fontWeight:600, fontSize:13.5, color: mode === m ? C.base : C.dim,
                background: mode === m ? C.gold : 'transparent' }}>
                {m === 'signup' ? 'Create account' : 'Log in'}
              </button>
            ))}
          </div>

          {mode === 'signup' && (
            <Labeled label="Display name">
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Marcus Cole" style={field} />
            </Labeled>
          )}
          <Labeled label="Email">
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" style={field} />
          </Labeled>
          <Labeled label="Password">
            <input value={pw} onChange={e => setPw(e.target.value)} type="password" placeholder="••••••••" style={field} />
          </Labeled>

          {err && <p style={{ fontFamily:ui, fontSize:12.5, color:C.garnetHi, margin:'2px 0 12px' }}>{err}</p>}

          <button onClick={submit} disabled={busy} style={{ ...solidGold, width:'100%', marginTop:6, opacity: busy ? 0.6 : 1 }}>
            {busy ? 'One moment…' : mode === 'signup' ? 'Create my profile' : 'Enter the chamber'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display:'block', marginBottom:14 }}>
      <span style={{ fontFamily:ui, fontSize:11.5, fontWeight:700, letterSpacing:'.8px', textTransform:'uppercase', color:C.dim }}>
        {label}</span>
      <div style={{ marginTop:7 }}>{children}</div>
    </label>
  );
}
