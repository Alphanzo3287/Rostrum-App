// =====================================================================
// The Rostrum · src/components/EditProfileModal.tsx
// Self-serve profile editing: display name, handle, bio, topics, socials.
// =====================================================================
import { useState } from 'react';
import { updateProfile } from '../lib/api';
import type { Profile } from '../lib/types';
import { C, ui, display, a, solidGold, field } from '../lib/theme';

const SOCIAL_KEYS: { key: 'youtube' | 'x' | 'instagram' | 'tiktok' | 'website'; label: string }[] = [
  { key: 'youtube', label: 'YouTube' }, { key: 'x', label: 'X / Twitter' },
  { key: 'instagram', label: 'Instagram' }, { key: 'tiktok', label: 'TikTok' }, { key: 'website', label: 'Website' },
];

export function EditProfileModal({ profile, onClose, onSaved }: {
  profile: Profile; onClose: () => void; onSaved: (p: Profile) => void;
}) {
  const [displayName, setDisplayName] = useState(profile.display_name ?? '');
  const [handle, setHandle] = useState(profile.handle ?? '');
  const [bio, setBio] = useState(profile.bio ?? '');
  const [topics, setTopics] = useState((profile.topics ?? []).join(', '));
  const [socials, setSocials] = useState<Record<string, string>>({ ...(profile.socials ?? {}) } as any);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    const name = displayName.trim();
    const h = handle.replace(/^@/, '').trim();
    if (!name) { setErr('Display name is required.'); return; }
    if (!h) { setErr('Handle is required.'); return; }
    setBusy(true); setErr('');
    try {
      const cleanSocials: Record<string, string> = {};
      for (const { key } of SOCIAL_KEYS) if (socials[key]?.trim()) cleanSocials[key] = socials[key].trim();
      const updated = await updateProfile({
        display_name: name, handle: h, bio: bio.trim() || null,
        topics: topics.split(',').map(t => t.trim()).filter(Boolean),
        socials: cleanSocials,
      });
      onSaved(updated);
    } catch (e: any) { setErr(e?.message ?? 'Could not save changes.'); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, display:'grid', placeItems:'center',
      background:a(C.base,'CC'), backdropFilter:'blur(6px)', padding:20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width:480, maxWidth:'100%', maxHeight:'86vh', overflowY:'auto', borderRadius:16,
        background:C.panel, border:`1px solid ${C.hair}`, padding:26, boxShadow:'0 20px 60px rgba(0,0,0,.5)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
          <h3 style={{ fontFamily:display, fontSize:21, color:C.ink, margin:0 }}>Edit profile</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.faint, fontSize:20, cursor:'pointer' }}>×</button>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <Field label="Display name">
            <input value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={60} style={field} />
          </Field>
          <Field label="Handle">
            <div style={{ position:'relative' }}>
              <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:C.faint, fontFamily:ui, fontSize:14 }}>@</span>
              <input value={handle.replace(/^@/, '')} onChange={e => setHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                maxLength={24} style={{ ...field, paddingLeft:26 }} />
            </div>
          </Field>
          <Field label="Bio">
            <textarea value={bio} onChange={e => setBio(e.target.value)} maxLength={280} rows={3}
              style={{ ...field, resize:'vertical', fontFamily:ui }} />
          </Field>
          <Field label="Topics (comma separated)">
            <input value={topics} onChange={e => setTopics(e.target.value)} placeholder="Politics, Philosophy, Religion" style={field} />
          </Field>
          <div>
            <div style={{ fontFamily:ui, fontSize:11.5, fontWeight:600, color:C.dim, marginBottom:8 }}>Social links</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {SOCIAL_KEYS.map(({ key, label }) => (
                <input key={key} value={socials[key] ?? ''} onChange={e => setSocials(s => ({ ...s, [key]: e.target.value }))}
                  placeholder={`${label} URL`} style={{ ...field, fontSize:13 }} />
              ))}
            </div>
          </div>

          {err && <div style={{ fontFamily:ui, fontSize:12.5, color:C.garnetHi }}>{err}</div>}
          <button onClick={save} disabled={busy} style={{ ...solidGold, marginTop:4, opacity: busy ? .6 : 1 }}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display:'flex', flexDirection:'column', gap:6, fontFamily:ui, fontSize:11.5, fontWeight:600, color:C.dim }}>
      {label}
      {children}
    </label>
  );
}
