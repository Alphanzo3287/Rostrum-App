// =====================================================================
// The Rostrum · src/screens/TournamentsScreen.tsx
// Browse & create single-elimination tournaments. Route: /tournaments
// =====================================================================
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listTournaments, createTournament, type Tournament } from '../lib/tournaments';
import { C, ui, display, mono, a, solidGold, ghostBtn, field } from '../lib/theme';

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  registration: { label: 'Registration open', color: '#4FC2A7' },
  live: { label: 'In progress', color: '#E86A6A' },
  completed: { label: 'Completed', color: '#8A93A0' },
};
const FORMAT_LABEL: Record<string, string> = { oxford: 'Oxford', lecture: 'Lecture', legacy: 'Legacy', speakers_corner: "Speaker's Corner" };

export function TournamentsScreen() {
  const nav = useNavigate();
  const [list, setList] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = () => { listTournaments().then(setList).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(load, []);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '26px 20px 70px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 6 }}>
        <div>
          <h1 style={{ fontFamily: display, fontSize: 28, fontWeight: 700, color: C.ink, margin: 0 }}>Tournaments</h1>
          <p style={{ fontFamily: ui, fontSize: 13.5, color: C.faint, margin: '4px 0 0' }}>
            Single-elimination brackets. Register, compete, and climb to the championship.
          </p>
        </div>
        <button onClick={() => setCreating(true)} style={{ ...solidGold, padding: '10px 18px', fontSize: 13.5, whiteSpace: 'nowrap' }}>+ Create</button>
      </div>

      {loading ? (
        <div style={{ fontFamily: ui, fontSize: 14, color: C.faint, marginTop: 30 }}>Loading…</div>
      ) : list.length === 0 ? (
        <div style={{ marginTop: 24, padding: '40px 22px', borderRadius: 16, textAlign: 'center', background: C.panel, border: `1px solid ${C.hair}` }}>
          <div style={{ fontFamily: ui, fontSize: 14, color: C.faint, marginBottom: 16 }}>No tournaments yet — host the first one.</div>
          <button onClick={() => setCreating(true)} style={{ ...solidGold, padding: '10px 20px', fontSize: 13.5 }}>Create a tournament</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginTop: 24 }}>
          {list.map(t => {
            const st = STATUS_LABEL[t.status] ?? STATUS_LABEL.completed;
            return (
              <button key={t.id} onClick={() => nav(`/tournament/${t.id}`)}
                style={{ textAlign: 'left', cursor: 'pointer', border: `1px solid ${C.hair}`, borderRadius: 16, background: C.panel, padding: '16px 18px' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.hairHi; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.hair; }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: st.color }} />
                  <span style={{ fontFamily: ui, fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: st.color }}>{st.label}</span>
                </div>
                <div style={{ fontFamily: display, fontSize: 17, fontWeight: 700, color: C.ink, lineHeight: 1.2 }}>{t.title}</div>
                <div style={{ fontFamily: mono, fontSize: 11.5, color: C.faint, marginTop: 8 }}>
                  {FORMAT_LABEL[t.debate_format] ?? t.debate_format} · {t.size}-{t.kind === 'team' ? 'team' : 'player'} bracket
                </div>
              </button>
            );
          })}
        </div>
      )}

      {creating && <CreateTournamentModal onClose={() => setCreating(false)} onCreated={(t) => { setCreating(false); nav(`/tournament/${t.id}`); }} />}
    </div>
  );
}

function CreateTournamentModal({ onClose, onCreated }: { onClose: () => void; onCreated: (t: Tournament) => void }) {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [format, setFormat] = useState('oxford');
  const [size, setSize] = useState(8);
  const [startsAt, setStartsAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    if (!title.trim()) { setErr('Give your tournament a title.'); return; }
    setBusy(true); setErr('');
    try {
      const t = await createTournament({
        title: title.trim(), description: desc.trim() || undefined,
        debateFormat: format, size, startsAt: startsAt ? new Date(startsAt).toISOString() : null,
      });
      onCreated(t);
    } catch (e: any) { setErr(e?.message ?? 'Could not create tournament'); setBusy(false); }
  }

  const Chip = ({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) => (
    <button type="button" onClick={onClick} style={{ padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
      fontFamily: ui, fontSize: 13, fontWeight: 600,
      background: on ? a(C.gold, '1F') : C.panel2, color: on ? C.gold : C.dim,
      border: `1px solid ${on ? a(C.gold, '66') : C.hair}` }}>{children}</button>
  );

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'grid', placeItems: 'center', padding: 18, background: a(C.base, 'C0'), backdropFilter: 'blur(4px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 480, maxWidth: '100%', maxHeight: '88vh', overflowY: 'auto', borderRadius: 16, background: C.panel, border: `1px solid ${C.hairHi}`, padding: '24px 24px 20px' }}>
        <h2 style={{ fontFamily: display, fontSize: 21, fontWeight: 700, color: C.ink, margin: '0 0 16px' }}>Create a tournament</h2>

        <L label="Title"><input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Spring Championship" style={field} maxLength={100} /></L>
        <L label="Description"><textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="What's this tournament about?" rows={2} style={{ ...field, resize: 'vertical' }} maxLength={400} /></L>

        <L label="Debate format">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['oxford', 'legacy', 'speakers_corner'].map(f => <Chip key={f} on={format === f} onClick={() => setFormat(f)}>{FORMAT_LABEL[f]}</Chip>)}
          </div>
        </L>
        <L label="Bracket size">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[4, 8, 16, 32].map(s => <Chip key={s} on={size === s} onClick={() => setSize(s)}>{s} players</Chip>)}
          </div>
        </L>
        <L label="Start time (optional)"><input type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} style={field} /></L>

        {err && <div style={{ fontFamily: ui, fontSize: 12.5, color: C.garnetHi, marginBottom: 12 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button onClick={onClose} style={{ ...ghostBtn, flex: 1 }}>Cancel</button>
          <button onClick={submit} disabled={busy} style={{ ...solidGold, flex: 2, opacity: busy ? 0.6 : 1 }}>{busy ? 'Creating…' : 'Create tournament'}</button>
        </div>
        <div style={{ fontFamily: ui, fontSize: 11.5, color: C.faint, marginTop: 12, lineHeight: 1.5 }}>
          Individual tournaments are live now. Team tournaments are coming soon.
        </div>
      </div>
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <span style={{ fontFamily: ui, fontSize: 11.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: C.dim }}>{label}</span>
      <div style={{ marginTop: 7 }}>{children}</div>
    </label>
  );
}
