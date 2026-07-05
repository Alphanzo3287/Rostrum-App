// =====================================================================
// The Rostrum · src/screens/ReplayScreen.tsx
// Watch a debate replay (MP4 from private R2 via short-lived signed URL),
// with a Download button for posting to other platforms.
// =====================================================================
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getReplayAccess, type ReplayAccess } from '../lib/replays';
import { C, ui, display } from '../lib/theme';

export function ReplayScreen() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [access, setAccess] = useState<ReplayAccess | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!id) return;
    getReplayAccess(id).then(setAccess).catch(e => setErr(e?.message ?? 'Could not load replay'));
  }, [id]);

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '26px 20px 60px' }}>
      <button onClick={() => nav(-1)} style={{ background: 'transparent', border: 'none', cursor: 'pointer',
        fontFamily: ui, fontSize: 13, color: C.dim, padding: 0, marginBottom: 14 }}>← Back</button>

      {err ? (
        <div style={{ padding: 18, borderRadius: 14, background: C.panel, border: `1px solid ${C.hair}`,
          fontFamily: ui, fontSize: 14, color: C.garnetHi }}>{err}</div>
      ) : !access ? (
        <div style={{ fontFamily: ui, fontSize: 14, color: C.faint }}>Loading replay…</div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
            <div>
              <div style={{ fontFamily: display, fontSize: 24, fontWeight: 700, color: C.ink }}>
                {access.title ?? 'Debate replay'}
              </div>
              <div style={{ fontFamily: ui, fontSize: 12, color: C.faint, marginTop: 3 }}>
                Replay · {access.visibility === 'public' ? 'Public' : 'Private'}
              </div>
            </div>
            <a href={access.downloadUrl}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 11,
                textDecoration: 'none', fontFamily: ui, fontSize: 13.5, fontWeight: 700,
                color: C.base, background: C.gold }}>
              ⬇ Download MP4
            </a>
          </div>

          <div style={{ borderRadius: 16, overflow: 'hidden', border: `1px solid ${C.hair}`, background: '#000' }}>
            <video src={access.playUrl} controls autoPlay playsInline
              style={{ display: 'block', width: '100%', maxHeight: '72vh', background: '#000' }} />
          </div>

          <p style={{ fontFamily: ui, fontSize: 12, color: C.faint, marginTop: 12, lineHeight: 1.5 }}>
            The download is a standard MP4 — ready to post on YouTube, X, TikTok, or anywhere else.
          </p>
        </>
      )}
    </div>
  );
}
