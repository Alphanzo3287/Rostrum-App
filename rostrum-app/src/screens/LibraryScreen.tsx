// =====================================================================
// The Rostrum · src/screens/LibraryScreen.tsx
// The host's replay hub: every debate you hosted that has a recording.
// Manage visibility (Public / Private) and delete — plus watch & download.
// =====================================================================
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { myReplays, setReplayVisibility, deleteReplay, isReplayExpired, REPLAY_RETENTION_DAYS, type ReplayItem } from '../lib/replays';
import { useAuth } from '../lib/auth';
import { isPro } from '../lib/pro';
import { C, ui, display, a } from '../lib/theme';

const FORMAT_LABEL: Record<string, string> = {
  oxford: 'Oxford', lecture: 'Lecture', legacy: 'Legacy', speakers_corner: "Speaker's Corner",
};

export function LibraryScreen() {
  const nav = useNavigate();
  const { profile } = useAuth();
  const pro = isPro(profile);
  const [items, setItems] = useState<ReplayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    myReplays().then(setItems).catch(e => setErr(e?.message ?? 'Could not load your library'))
      .finally(() => setLoading(false));
  }, []);

  async function toggleVis(item: ReplayItem) {
    const next = item.recording_visibility === 'public' ? 'private' : 'public';
    setBusy(item.id);
    try {
      await setReplayVisibility(item.id, next);
      setItems(xs => xs.map(x => x.id === item.id ? { ...x, recording_visibility: next } : x));
    } catch (e: any) { alert(e?.message ?? 'Could not update'); }
    finally { setBusy(null); }
  }

  async function remove(item: ReplayItem) {
    if (!confirm(`Delete the replay of "${item.title}"?\n\nThe video file will be permanently deleted. This can't be undone.`)) return;
    setBusy(item.id);
    try {
      await deleteReplay(item.id);
      setItems(xs => xs.filter(x => x.id !== item.id));
    } catch (e: any) { alert(e?.message ?? 'Could not delete'); }
    finally { setBusy(null); }
  }

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '26px 20px 60px' }}>
      <h1 style={{ fontFamily: display, fontSize: 28, fontWeight: 700, color: C.ink, margin: '0 0 4px' }}>Library</h1>
      <p style={{ fontFamily: ui, fontSize: 13.5, color: C.faint, margin: '0 0 22px', lineHeight: 1.5 }}>
        Replays of events you hosted. New replays are <b>private</b> until you make them public —
        public replays appear on your profile for others to watch.
      </p>

      {err && <div style={{ padding: 14, borderRadius: 12, marginBottom: 16, background: a(C.garnet, '1A'),
        border: `1px solid ${a(C.garnet, '40')}`, fontFamily: ui, fontSize: 13, color: C.garnetHi }}>{err}</div>}

      {loading ? (
        <div style={{ fontFamily: ui, fontSize: 14, color: C.faint }}>Loading…</div>
      ) : items.length === 0 ? (
        <div style={{ padding: '38px 22px', borderRadius: 16, textAlign: 'center',
          background: C.panel, border: `1px solid ${C.hair}` }}>
          <div style={{ fontSize: 30 }}>🎬</div>
          <div style={{ fontFamily: display, fontSize: 18, fontWeight: 700, color: C.ink, margin: '10px 0 6px' }}>
            No replays yet
          </div>
          <p style={{ fontFamily: ui, fontSize: 13.5, color: C.faint, margin: 0, lineHeight: 1.6 }}>
            Host an event and press <b>⏺ Record</b> in the dock — the replay will land here when the event ends.
          </p>
        </div>
      ) : (
        items.map(item => {
          const isPublic = item.recording_visibility === 'public';
          const isBusy = busy === item.id;
          const expired = isReplayExpired(item.created_at, pro);
          return (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
              background: C.panel, border: `1px solid ${expired ? a(C.warning, '3A') : C.hair}`, borderRadius: 14,
              padding: '15px 17px', marginBottom: 12, opacity: expired ? 0.82 : 1 }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontFamily: ui, fontSize: 14.5, fontWeight: 700, color: C.ink }}>{item.title}</div>
                <div style={{ fontFamily: ui, fontSize: 11.5, color: C.faint, marginTop: 3 }}>
                  {FORMAT_LABEL[item.format ?? ''] ?? item.format} · {new Date(item.created_at).toLocaleDateString()}
                  {expired && <span style={{ color: C.warning }}> · expired after {REPLAY_RETENTION_DAYS} days</span>}
                </div>
              </div>

              {expired ? (
                <button onClick={() => nav('/pro')} style={{ fontFamily: ui, fontSize: 11.5, fontWeight: 700,
                  padding: '7px 13px', borderRadius: 999, cursor: 'pointer', color: C.gold,
                  border: `1px solid ${a(C.gold, '66')}`, background: a(C.gold, '12') }}>
                  👑 Upgrade to restore
                </button>
              ) : (
                <span style={{ fontFamily: ui, fontSize: 11, fontWeight: 800, letterSpacing: '.06em',
                  padding: '4px 11px', borderRadius: 999, textTransform: 'uppercase',
                  color: isPublic ? C.jadeHi : C.warning,
                  border: `1px solid ${isPublic ? a(C.jade, '66') : a(C.warning, '55')}`,
                  background: isPublic ? a(C.jade, '14') : a(C.warning, '10') }}>
                  {isPublic ? 'Public' : 'Private'}
                </span>
              )}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Btn onClick={() => nav(`/replay/${item.id}`)} disabled={isBusy || expired}>▶ Watch</Btn>
                <Btn onClick={() => nav(`/debate/${item.id}/analytics`)} disabled={isBusy}>📊 Analytics</Btn>
                <Btn onClick={() => toggleVis(item)} disabled={isBusy || expired}>
                  {isPublic ? 'Make private' : 'Make public'}
                </Btn>
                <Btn danger onClick={() => remove(item)} disabled={isBusy}>Delete</Btn>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function Btn({ children, onClick, disabled, danger }: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ padding: '8px 13px', borderRadius: 10, cursor: disabled ? 'default' : 'pointer',
        fontFamily: ui, fontSize: 12.5, fontWeight: 600, opacity: disabled ? 0.55 : 1,
        background: 'transparent', color: danger ? C.garnetHi : C.ink,
        border: `1px solid ${danger ? a(C.garnet, '55') : C.hairHi}` }}>
      {children}
    </button>
  );
}
