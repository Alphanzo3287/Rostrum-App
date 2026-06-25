// =====================================================================
// The Rostrum · src/screens/OnboardScreen.tsx
// The prototype Onboard screen, wired to completeOnboarding (uploads the
// avatar to storage and writes the profile fields).
// =====================================================================
import { useState } from 'react';
import { useAuth } from '../lib/auth';
import type { Socials } from '../lib/types';
import { C, ui, display, solidGold, field } from '../lib/theme';

const TOPICS = ['Politics', 'Philosophy', 'Technology', 'Justice', 'Religion', 'Economics', 'Science', 'Culture'];

export function OnboardScreen({ onDone }: { onDone: () => void }) {
  const { completeOnboarding } = useAuth();
  const [displayName, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [bio, setBio] = useState('');
  const [socials, setSocials] = useState<Socials>({});
  const [topics, setTopics] = useState<string[]>(['Politics', 'Philosophy']);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function pickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setAvatar(f); setPreview(URL.createObjectURL(f));
  }
  const toggle = (t: string) => setTopics(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);

  async function finish() {
    setErr(null); setBusy(true);
    try {
      await completeOnboarding({
        displayName: displayName || undefined,
        handle: handle.replace(/^@/, '') || undefined,
        bio, socials, topics, avatarFile: avatar,
      });
      onDone();
    } catch (e: any) {
      setErr(e?.message ?? 'Could not save your profile');
    } finally { setBusy(false); }
  }

  return (
    <div style={{ position:'absolute', inset:0, overflowY:'auto', display:'grid', placeItems:'center',
      padding:'40px 20px', background:`radial-gradient(120% 80% at 50% -10%, #221a13, ${C.base} 60%)` }}>
      <div style={{ width:'100%', maxWidth:640, background:C.panel, border:`1px solid ${C.hair}`,
        borderRadius:14, padding:'30px 32px' }}>
        <h1 style={{ fontFamily:display, fontWeight:600, fontSize:32, color:C.ink, margin:'0 0 20px' }}>Claim your seat</h1>

        <div style={{ display:'flex', gap:16, alignItems:'center', marginBottom:20 }}>
          <label style={{ cursor:'pointer' }}>
            <input type="file" accept="image/*" onChange={pickAvatar} style={{ display:'none' }} />
            <div style={{ width:74, height:74, borderRadius:'50%', overflow:'hidden', border:`1px dashed ${C.hairHi}`,
              display:'grid', placeItems:'center', color:C.faint }}>
              {preview ? <img src={preview} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : '＋'}
            </div>
          </label>
          <div style={{ fontFamily:ui, fontSize:12.5, color:C.faint }}>Add a profile photo</div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <input value={displayName} onChange={e => setName(e.target.value)} placeholder="Display name" style={field} />
          <input value={handle} onChange={e => setHandle(e.target.value)} placeholder="@handle" style={field} />
        </div>
        <textarea value={bio} onChange={e => setBio(e.target.value)} rows={2} placeholder="Your stance, your style…"
          style={{ ...field, marginTop:12, resize:'vertical' }} />

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:12 }}>
          {(['instagram', 'x', 'youtube', 'tiktok', 'website'] as const).map(k => (
            <input key={k} placeholder={k} value={(socials as any)[k] ?? ''}
              onChange={e => setSocials(s => ({ ...s, [k]: e.target.value }))} style={field} />
          ))}
        </div>

        <div style={{ display:'flex', flexWrap:'wrap', gap:8, margin:'18px 0 22px' }}>
          {TOPICS.map(t => {
            const on = topics.includes(t);
            return <button key={t} onClick={() => toggle(t)} style={{ padding:'7px 13px', borderRadius:999, cursor:'pointer',
              fontFamily:ui, fontSize:12.5, fontWeight:600, border:`1px solid ${on ? C.gold : C.hair}`,
              background: on ? 'rgba(217,180,92,0.12)' : 'transparent', color: on ? C.gold : C.dim }}>{t}</button>;
          })}
        </div>

        {err && <p style={{ fontFamily:ui, fontSize:12.5, color:C.garnetHi, margin:'0 0 12px' }}>{err}</p>}
        <button onClick={finish} disabled={busy} style={{ ...solidGold, width:'100%', opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Saving…' : 'Enter the Rostrum'}
        </button>
      </div>
    </div>
  );
}
