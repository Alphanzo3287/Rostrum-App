// =====================================================================
// The Rostrum · BannedScreen.tsx
// Shown in place of the app when auth.uid() user is banned.
// Lets them file an appeal and check existing appeal status.
// =====================================================================
import { useState, useEffect } from 'react';
import { C, ui, display } from '../lib/theme';
import { fileAppeal, getMyAppeals, getMyBan, type Ban, type Appeal } from '../lib/api';
import { useAuth } from '../lib/auth';

export function BannedScreen() {
  const { signOut } = useAuth();
  const [ban, setBan]         = useState<Ban | null>(null);
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [body, setBody]       = useState('');
  const [busy, setBusy]       = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [err, setErr]         = useState('');

  useEffect(() => {
    getMyBan().then(setBan);
    getMyAppeals().then(setAppeals);
  }, []);

  const hasOpenAppeal = appeals.some(a => a.status === 'open');
  const latestAppeal  = appeals[0] ?? null;

  async function submit() {
    if (!ban || !body.trim()) return;
    setBusy(true); setErr('');
    try { await fileAppeal(ban.id, body); setSubmitted(true); setAppeals(await getMyAppeals()); }
    catch (e: any) { setErr(e?.message ?? 'Could not submit appeal'); }
    finally { setBusy(false); }
  }

  const statusColor = (s: string) =>
    s === 'approved' ? C.jade : s === 'denied' ? C.garnet : C.gold;

  return (
    <div style={{ position:'fixed', inset:0, background:C.base, display:'grid', placeItems:'center',
      fontFamily:ui, padding:24, zIndex:999 }}>
      <div style={{ maxWidth:520, width:'100%' }}>
        {/* Header */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ fontSize:48, marginBottom:12 }}>🚫</div>
          <div style={{ fontFamily:display, fontSize:26, fontWeight:800, color:C.ink, marginBottom:8 }}>
            Your account has been suspended
          </div>
          {ban && (
            <div style={{ fontSize:13, color:C.faint, lineHeight:1.6 }}>
              <span style={{ color:C.dim }}>{ban.reason}</span>
              {ban.expires_at && (
                <div style={{ marginTop:6 }}>
                  Expires: <span style={{ color:C.ink }}>{new Date(ban.expires_at).toLocaleDateString()}</span>
                </div>
              )}
              {!ban.expires_at && (
                <div style={{ marginTop:6, color:C.garnet, fontWeight:600 }}>Permanent suspension</div>
              )}
            </div>
          )}
        </div>

        {/* Appeal status if exists */}
        {latestAppeal && (
          <div style={{ padding:16, borderRadius:12, border:`1px solid ${C.hair}`, background:C.panel, marginBottom:20 }}>
            <div style={{ fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em',
              color:C.dim, marginBottom:8 }}>Your appeal</div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:latestAppeal.admin_reply ? 10 : 0 }}>
              <span style={{ fontSize:13, color:C.ink }}>{latestAppeal.body}</span>
              <span style={{ marginLeft:'auto', fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20,
                background:`${statusColor(latestAppeal.status)}22`, color:statusColor(latestAppeal.status),
                textTransform:'uppercase', letterSpacing:'.06em', whiteSpace:'nowrap' }}>
                {latestAppeal.status}
              </span>
            </div>
            {latestAppeal.admin_reply && (
              <div style={{ marginTop:8, padding:'10px 12px', borderRadius:8, background:C.base,
                fontSize:13, color:C.dim, fontStyle:'italic' }}>
                "{latestAppeal.admin_reply}"
              </div>
            )}
          </div>
        )}

        {/* Appeal form */}
        {!hasOpenAppeal && !submitted && (
          <div style={{ padding:20, borderRadius:12, border:`1px solid ${C.hair}`, background:C.panel, marginBottom:20 }}>
            <div style={{ fontSize:15, fontWeight:700, color:C.ink, marginBottom:4 }}>File an appeal</div>
            <div style={{ fontSize:13, color:C.faint, marginBottom:14 }}>
              Explain why you believe this suspension should be reviewed. Our team will respond within 3 business days.
            </div>
            <textarea value={body} onChange={e => setBody(e.target.value)} maxLength={2000}
              placeholder="Explain your situation…"
              style={{ width:'100%', minHeight:100, resize:'vertical', padding:'9px 11px',
                borderRadius:8, border:`1px solid ${C.hair}`, background:C.base,
                color:C.ink, fontFamily:ui, fontSize:13, boxSizing:'border-box', marginBottom:10 }} />
            {err && <div style={{ fontSize:12, color:C.garnet, marginBottom:8 }}>{err}</div>}
            <button onClick={submit} disabled={busy || !body.trim()}
              style={{ padding:'10px 22px', borderRadius:8, background:C.gold, color:'#000',
                fontFamily:ui, fontWeight:700, fontSize:13, border:'none',
                cursor: busy || !body.trim() ? 'default':'pointer', opacity: busy || !body.trim() ? .6:1 }}>
              {busy ? 'Submitting…' : 'Submit appeal'}
            </button>
          </div>
        )}
        {submitted && (
          <div style={{ padding:16, borderRadius:12, background:`${C.jade}18`, border:`1px solid ${C.jade}44`,
            fontSize:13, color:C.jadeHi, marginBottom:20 }}>
            ✓ Appeal submitted — we'll review it and respond via the app.
          </div>
        )}

        <div style={{ textAlign:'center' }}>
          <button onClick={signOut} style={{ background:'none', border:`1px solid ${C.hair}`, color:C.dim,
            fontFamily:ui, fontSize:13, padding:'8px 18px', borderRadius:8, cursor:'pointer' }}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
