// =====================================================================
// The Rostrum · src/screens/CommunitiesScreen.tsx
// Browse & create communities. Route: /communities
// =====================================================================
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listCommunities, myCommunities, createCommunity, type Community } from '../lib/communities';
import { C, ui, display, mono, a, solidGold, ghostBtn, field } from '../lib/theme';

export function CommunitiesScreen() {
  const nav = useNavigate();
  const [all, setAll] = useState<Community[]>([]);
  const [mine, setMine] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = () => {
    Promise.all([listCommunities(), myCommunities()])
      .then(([a, m]) => { setAll(a); setMine(m); })
      .catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const mineIds = new Set(mine.map(c => c.id));
  const discover = all.filter(c => !mineIds.has(c.id));

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '26px 20px 70px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 6 }}>
        <div>
          <h1 style={{ fontFamily: display, fontSize: 28, fontWeight: 700, color: C.ink, margin: 0 }}>Communities</h1>
          <p style={{ fontFamily: ui, fontSize: 13.5, color: C.faint, margin: '4px 0 0' }}>
            Find your tribe. Join debate groups by topic, school, or interest.
          </p>
        </div>
        <button onClick={() => setCreating(true)} style={{ ...solidGold, padding: '10px 18px', fontSize: 13.5, whiteSpace: 'nowrap' }}>
          + Create
        </button>
      </div>

      {loading ? (
        <div style={{ fontFamily: ui, fontSize: 14, color: C.faint, marginTop: 30 }}>Loading…</div>
      ) : (
        <>
          {mine.length > 0 && (
            <Section title="Your communities">
              {mine.map(c => <CommunityCard key={c.id} c={c} onClick={() => nav(`/community/${c.id}`)} joined />)}
            </Section>
          )}

          <Section title={mine.length > 0 ? 'Discover' : 'All communities'}>
            {discover.length === 0 && mine.length === 0 ? (
              <div style={{ padding: '34px 22px', borderRadius: 16, textAlign: 'center', background: C.panel, border: `1px solid ${C.hair}` }}>
                <div style={{ fontFamily: ui, fontSize: 14, color: C.faint, marginBottom: 14 }}>No communities yet — be the first to start one.</div>
                <button onClick={() => setCreating(true)} style={{ ...solidGold, padding: '10px 20px', fontSize: 13.5 }}>Create a community</button>
              </div>
            ) : discover.map(c => <CommunityCard key={c.id} c={c} onClick={() => nav(`/community/${c.id}`)} />)}
          </Section>
        </>
      )}

      {creating && <CreateCommunityModal onClose={() => setCreating(false)} onCreated={(c) => { setCreating(false); nav(`/community/${c.id}`); }} />}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ fontFamily: ui, fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: C.faint, marginBottom: 12 }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>{children}</div>
    </div>
  );
}

function CommunityCard({ c, onClick, joined }: { c: Community; onClick: () => void; joined?: boolean }) {
  return (
    <button onClick={onClick} style={{ textAlign: 'left', cursor: 'pointer', border: `1px solid ${C.hair}`,
      borderRadius: 16, overflow: 'hidden', background: C.panel, padding: 0 }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = C.hairHi; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = C.hair; }}>
      <div style={{ height: 64, background: c.banner_url ? `url(${c.banner_url}) center/cover` : `linear-gradient(120deg, ${a(C.gold, '55')}, ${a(C.cyan, '33')})` }} />
      <div style={{ padding: '12px 14px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: display, fontSize: 15.5, fontWeight: 700, color: C.ink }}>{c.name}</span>
          {joined && <span style={{ fontFamily: ui, fontSize: 9.5, fontWeight: 800, color: C.jadeHi, textTransform: 'uppercase', letterSpacing: '.05em' }}>· Joined</span>}
        </div>
        {c.description && <div style={{ fontFamily: ui, fontSize: 12.5, color: C.dim, marginTop: 4, lineHeight: 1.4,
          overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>{c.description}</div>}
        <div style={{ fontFamily: mono, fontSize: 11, color: C.faint, marginTop: 8 }}>{c.member_count.toLocaleString()} member{c.member_count === 1 ? '' : 's'}</div>
      </div>
    </button>
  );
}

function CreateCommunityModal({ onClose, onCreated }: { onClose: () => void; onCreated: (c: Community) => void }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [topics, setTopics] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    if (!name.trim()) { setErr('Give your community a name.'); return; }
    setBusy(true); setErr('');
    try {
      const c = await createCommunity({
        name: name.trim(), description: desc.trim() || undefined,
        topics: topics.split(',').map(t => t.trim()).filter(Boolean),
      });
      onCreated(c);
    } catch (e: any) { setErr(e?.message ?? 'Could not create community'); setBusy(false); }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'grid', placeItems: 'center',
      padding: 18, background: a(C.base, 'C0'), backdropFilter: 'blur(4px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 460, maxWidth: '100%', borderRadius: 16,
        background: C.panel, border: `1px solid ${C.hairHi}`, padding: '24px 24px 20px' }}>
        <h2 style={{ fontFamily: display, fontSize: 21, fontWeight: 700, color: C.ink, margin: '0 0 16px' }}>Create a community</h2>

        <Field label="Name"><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Policy Debate Club" style={field} maxLength={80} /></Field>
        <Field label="Description"><textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="What's this community about?" rows={3} style={{ ...field, resize: 'vertical' }} maxLength={400} /></Field>
        <Field label="Topics (comma-separated)"><input value={topics} onChange={e => setTopics(e.target.value)} placeholder="politics, economics, ethics" style={field} /></Field>

        {err && <div style={{ fontFamily: ui, fontSize: 12.5, color: C.garnetHi, marginBottom: 12 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button onClick={onClose} style={{ ...ghostBtn, flex: 1 }}>Cancel</button>
          <button onClick={submit} disabled={busy} style={{ ...solidGold, flex: 2, opacity: busy ? 0.6 : 1 }}>{busy ? 'Creating…' : 'Create community'}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <span style={{ fontFamily: ui, fontSize: 11.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: C.dim }}>{label}</span>
      <div style={{ marginTop: 7 }}>{children}</div>
    </label>
  );
}
