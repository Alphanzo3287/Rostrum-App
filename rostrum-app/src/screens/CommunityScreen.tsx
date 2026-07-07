// =====================================================================
// The Rostrum · src/screens/CommunityScreen.tsx
// A single community: header, join/leave, post feed, member list.
// Route: /community/:id
// =====================================================================
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import {
  getCommunity, isMember, communityMembers, communityFeed, joinCommunity, leaveCommunity,
  postToCommunity, deleteCommunityPost, type Community, type CommunityPost, type CommunityMember,
} from '../lib/communities';
import { Avatar } from '../components/ui';
import { C, ui, display, mono, a, solidGold, ghostBtn, field } from '../lib/theme';

const ago = (iso: string) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'now'; if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`; return `${Math.floor(s / 86400)}d`;
};

export function CommunityScreen() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { user } = useAuth();
  const [community, setCommunity] = useState<Community | null>(null);
  const [member, setMember] = useState(false);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [feed, setFeed] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState('');

  const refresh = () => {
    if (!id) return;
    Promise.all([getCommunity(id), isMember(id), communityMembers(id), communityFeed(id)])
      .then(([c, m, mem, f]) => { setCommunity(c); setMember(m); setMembers(mem); setFeed(f); })
      .catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(refresh, [id]);

  async function toggleMembership() {
    if (!id) return;
    setBusy(true); setErr('');
    try { member ? await leaveCommunity(id) : await joinCommunity(id); refresh(); }
    catch (e: any) { setErr(e?.message ?? 'Something went wrong'); }
    finally { setBusy(false); }
  }

  async function post() {
    if (!id || !draft.trim()) return;
    setBusy(true); setErr('');
    try { await postToCommunity(id, draft.trim()); setDraft(''); refresh(); }
    catch (e: any) { setErr(e?.message ?? 'Could not post'); }
    finally { setBusy(false); }
  }

  async function removePost(postId: string) {
    try { await deleteCommunityPost(postId); refresh(); } catch { /* ignore */ }
  }

  if (loading) return <div style={{ maxWidth: 820, margin: '0 auto', padding: 40, fontFamily: ui, color: C.faint }}>Loading…</div>;
  if (!community) return <div style={{ maxWidth: 820, margin: '0 auto', padding: 40, fontFamily: ui, color: C.faint }}>Community not found.</div>;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 0 70px' }}>
      {/* banner + header */}
      <div style={{ height: 150, background: community.banner_url ? `url(${community.banner_url}) center/cover` : `linear-gradient(120deg, ${a(C.gold, '5C')}, ${a(C.cyan, '38')})` }} />
      <div style={{ padding: '0 20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginTop: -8 }}>
          <div>
            <button onClick={() => nav('/communities')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: ui, fontSize: 12.5, color: C.dim, padding: 0, marginBottom: 8 }}>← Communities</button>
            <h1 style={{ fontFamily: display, fontSize: 28, fontWeight: 700, color: C.ink, margin: 0 }}>{community.name}</h1>
            <div style={{ fontFamily: mono, fontSize: 12, color: C.faint, marginTop: 4 }}>{community.member_count.toLocaleString()} member{community.member_count === 1 ? '' : 's'}</div>
          </div>
          <button onClick={toggleMembership} disabled={busy}
            style={{ ...(member ? ghostBtn : solidGold), padding: '10px 22px', fontSize: 13.5, opacity: busy ? 0.6 : 1 }}>
            {member ? 'Leave' : 'Join community'}
          </button>
        </div>
        {community.description && <p style={{ fontFamily: ui, fontSize: 14, color: C.dim, lineHeight: 1.55, margin: '14px 0 0', maxWidth: 620 }}>{community.description}</p>}
        {community.topics.length > 0 && (
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 12 }}>
            {community.topics.map((t, i) => (
              <span key={i} style={{ fontFamily: ui, fontSize: 11.5, color: C.gold, padding: '3px 10px', borderRadius: 999, background: a(C.gold, '12'), border: `1px solid ${a(C.gold, '33')}` }}>#{t}</span>
            ))}
          </div>
        )}
      </div>

      {/* body: feed + members */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 240px', gap: 20, padding: '26px 20px 0' }}>
        {/* feed */}
        <div>
          {member ? (
            <div style={{ background: C.panel, border: `1px solid ${C.hair}`, borderRadius: 14, padding: 14, marginBottom: 18 }}>
              <textarea value={draft} onChange={e => setDraft(e.target.value)} placeholder="Share something with the community…" rows={2}
                style={{ ...field, resize: 'vertical', marginBottom: 10 }} maxLength={2000} />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={post} disabled={busy || !draft.trim()} style={{ ...solidGold, padding: '8px 18px', fontSize: 13, opacity: (busy || !draft.trim()) ? 0.5 : 1 }}>Post</button>
              </div>
            </div>
          ) : (
            <div style={{ background: a(C.gold, '0C'), border: `1px solid ${a(C.gold, '2E')}`, borderRadius: 14, padding: '14px 16px', marginBottom: 18,
              fontFamily: ui, fontSize: 13, color: C.dim }}>Join this community to post and take part in the conversation.</div>
          )}
          {err && <div style={{ fontFamily: ui, fontSize: 12.5, color: C.garnetHi, marginBottom: 12 }}>{err}</div>}

          {feed.length === 0 ? (
            <div style={{ fontFamily: ui, fontSize: 13.5, color: C.faint, padding: '20px 4px' }}>No posts yet. {member ? 'Start the conversation!' : ''}</div>
          ) : feed.map(p => (
            <div key={p.id} style={{ display: 'flex', gap: 11, padding: '14px 0', borderBottom: `1px solid ${a(C.hair, '80')}` }}>
              <Avatar url={p.author?.avatar_url ?? null} name={p.author?.display_name ?? '?'} size={34} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontFamily: ui, fontSize: 13.5, fontWeight: 700, color: C.ink }}>{p.author?.display_name ?? 'Member'}</span>
                  <span style={{ fontFamily: mono, fontSize: 10.5, color: C.faint }}>· {ago(p.created_at)}</span>
                  {user?.id === p.author_id && (
                    <button onClick={() => removePost(p.id)} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: ui, fontSize: 11, color: C.faint }}>Delete</button>
                  )}
                </div>
                <div style={{ fontFamily: ui, fontSize: 14, color: C.dim, lineHeight: 1.5, marginTop: 3, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{p.body}</div>
              </div>
            </div>
          ))}
        </div>

        {/* members rail */}
        <div>
          <div style={{ fontFamily: ui, fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: C.faint, marginBottom: 12 }}>Members</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {members.map(m => (
              <button key={m.user_id} onClick={() => m.profile?.handle && nav(`/u/${m.profile.handle}`)}
                style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
                <Avatar url={m.profile?.avatar_url ?? null} name={m.profile?.display_name ?? '?'} size={28} />
                <span style={{ fontFamily: ui, fontSize: 13, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.profile?.display_name ?? 'Member'}
                </span>
                {m.role === 'admin' && <span style={{ fontFamily: ui, fontSize: 9, fontWeight: 800, color: C.gold, textTransform: 'uppercase' }}>admin</span>}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
