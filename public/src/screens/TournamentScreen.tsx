// =====================================================================
// The Rostrum · src/screens/TournamentScreen.tsx
// A single tournament: info, entrant roster, register/withdraw, delete.
// Bracket view arrives in Phase 2. Route: /tournament/:id
// =====================================================================
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import {
  getTournament, tournamentEntrants, isRegistered, registerForTournament,
  withdrawFromTournament, deleteTournament, startTournament, getBracket,
  type Tournament, type TournamentEntrant, type BracketMatch,
} from '../lib/tournaments';
import { BracketView } from '../components/BracketView';
import { Avatar } from '../components/ui';
import { C, ui, display, mono, a, solidGold, ghostBtn } from '../lib/theme';

const FORMAT_LABEL: Record<string, string> = { oxford: 'Oxford', lecture: 'Lecture', legacy: 'Legacy', speakers_corner: "Speaker's Corner" };

export function TournamentScreen() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { user, profile } = useAuth();
  const [t, setT] = useState<Tournament | null>(null);
  const [entrants, setEntrants] = useState<TournamentEntrant[]>([]);
  const [registered, setRegistered] = useState(false);
  const [bracket, setBracket] = useState<{ rounds: number; matches: BracketMatch[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const canManage = !!t && !!user && (t.created_by === user.id || !!(profile as any)?.is_admin);

  const refresh = () => {
    if (!id) return;
    Promise.all([getTournament(id), tournamentEntrants(id), isRegistered(id)])
      .then(([tt, e, r]) => {
        setT(tt); setEntrants(e); setRegistered(r);
        if (tt && tt.status !== 'registration') getBracket(id).then(setBracket).catch(() => {});
      })
      .catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(refresh, [id]);

  async function start() {
    if (!id) return;
    if (!confirm('Start the tournament? This seeds the bracket and closes registration.')) return;
    setBusy(true); setErr('');
    try { await startTournament(id); refresh(); }
    catch (e: any) { setErr(e?.message ?? 'Could not start'); }
    finally { setBusy(false); }
  }

  async function toggleRegister() {
    if (!id) return;
    setBusy(true); setErr('');
    try { registered ? await withdrawFromTournament(id) : await registerForTournament(id); refresh(); }
    catch (e: any) { setErr(e?.message ?? 'Something went wrong'); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!id || !t) return;
    if (!confirm(`Delete "${t.title}"? This cannot be undone.`)) return;
    try { await deleteTournament(id); nav('/tournaments'); }
    catch (e: any) { setErr(e?.message ?? 'Could not delete'); }
  }

  if (loading) return <div style={{ maxWidth: 820, margin: '0 auto', padding: 40, fontFamily: ui, color: C.faint }}>Loading…</div>;
  if (!t) return <div style={{ maxWidth: 820, margin: '0 auto', padding: 40, fontFamily: ui, color: C.faint }}>Tournament not found.</div>;

  const spotsLeft = t.size - entrants.length;
  const open = t.status === 'registration';

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '26px 20px 70px' }}>
      <button onClick={() => nav('/tournaments')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: ui, fontSize: 12.5, color: C.dim, padding: 0, marginBottom: 12 }}>← Tournaments</button>

      {/* header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 8, padding: '4px 10px', borderRadius: 999,
            background: open ? a('#2E9E86', '1E') : a(C.hair, '80'), border: `1px solid ${open ? a('#2E9E86', '4D') : C.hair}` }}>
            <span style={{ fontFamily: ui, fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em', color: open ? '#4FC2A7' : C.faint }}>
              {open ? 'Registration open' : t.status === 'live' ? 'In progress' : t.status === 'completed' ? 'Completed' : t.status}
            </span>
          </div>
          <h1 style={{ fontFamily: display, fontSize: 28, fontWeight: 700, color: C.ink, margin: 0, lineHeight: 1.15 }}>{t.title}</h1>
          <div style={{ fontFamily: mono, fontSize: 12.5, color: C.faint, marginTop: 8 }}>
            {FORMAT_LABEL[t.debate_format] ?? t.debate_format} · single elimination · {t.size}-player bracket
            {t.starts_at && <> · starts {new Date(t.starts_at).toLocaleString()}</>}
          </div>
        </div>
        {open && !canManage && (
          <button onClick={toggleRegister} disabled={busy || (!registered && spotsLeft <= 0)}
            style={{ ...(registered ? ghostBtn : solidGold), padding: '11px 24px', fontSize: 14,
              opacity: (busy || (!registered && spotsLeft <= 0)) ? 0.6 : 1 }}>
            {registered ? 'Withdraw' : spotsLeft <= 0 ? 'Full' : 'Register'}
          </button>
        )}
        {open && canManage && (
          <button onClick={start} disabled={busy || entrants.length < 2}
            style={{ ...solidGold, padding: '11px 24px', fontSize: 14, opacity: (busy || entrants.length < 2) ? 0.5 : 1 }}>
            Start tournament
          </button>
        )}
      </div>

      {t.description && <p style={{ fontFamily: ui, fontSize: 14.5, color: C.dim, lineHeight: 1.6, margin: '16px 0 0', maxWidth: 640 }}>{t.description}</p>}
      {err && <div style={{ fontFamily: ui, fontSize: 12.5, color: C.garnetHi, marginTop: 12 }}>{err}</div>}

      {/* registration progress (registration phase only) */}
      {open && (
        <div style={{ marginTop: 22, padding: '16px 18px', borderRadius: 14, background: C.panel, border: `1px solid ${C.hair}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: ui, fontSize: 12.5, color: C.dim, marginBottom: 8 }}>
            <span>{entrants.length} of {t.size} registered</span>
            <span style={{ color: C.faint }}>{spotsLeft > 0 ? `${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left` : 'Bracket full'}</span>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: C.panel2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(100, (entrants.length / t.size) * 100)}%`, borderRadius: 999, background: `linear-gradient(90deg, ${C.gold}, ${C.cyan})` }} />
          </div>
        </div>
      )}

      {/* entrants (registration phase) */}
      {open && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontFamily: ui, fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: C.faint, marginBottom: 12 }}>Entrants</div>
          {entrants.length === 0 ? (
            <div style={{ fontFamily: ui, fontSize: 13.5, color: C.faint }}>No one has registered yet. Be the first!</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
              {entrants.map((e, i) => (
                <button key={e.id} onClick={() => e.profile?.handle && nav(`/u/${e.profile.handle}`)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.panel, border: `1px solid ${C.hair}`, borderRadius: 12, padding: '10px 12px', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ fontFamily: mono, fontSize: 12, color: C.faint, width: 18 }}>{i + 1}</span>
                  <Avatar url={e.profile?.avatar_url ?? null} name={e.profile?.display_name ?? '?'} size={30} />
                  <span style={{ fontFamily: ui, fontSize: 13.5, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.profile?.display_name ?? 'Entrant'}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* champion banner */}
      {t.status === 'completed' && t.champion_entrant_id && (() => {
        const champ = entrants.find(e => e.id === t.champion_entrant_id);
        return (
          <div style={{ marginTop: 22, padding: '20px 22px', borderRadius: 16, textAlign: 'center',
            background: `linear-gradient(120deg, ${a(C.gold, '20')}, ${a(C.cyan, '12')})`, border: `1px solid ${a(C.gold, '55')}` }}>
            <div style={{ fontSize: 30 }}>🏆</div>
            <div style={{ fontFamily: ui, fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: C.gold, margin: '6px 0 4px' }}>Champion</div>
            <div style={{ fontFamily: display, fontSize: 24, fontWeight: 700, color: C.ink }}>{champ?.profile?.display_name ?? 'Champion'}</div>
          </div>
        );
      })()}

      {/* bracket (live / completed) */}
      {!open && bracket && bracket.matches.length > 0 && (
        <div style={{ marginTop: 26 }}>
          <div style={{ fontFamily: ui, fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: C.faint, marginBottom: 14 }}>Bracket</div>
          <BracketView rounds={bracket.rounds} matches={bracket.matches} />
        </div>
      )}

      {canManage && (
        <div style={{ marginTop: 22 }}>
          <button onClick={remove} style={{ background: 'transparent', border: `1px solid ${a(C.garnet, '55')}`, color: C.garnetHi, borderRadius: 8, padding: '6px 12px', fontFamily: ui, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            Delete tournament
          </button>
        </div>
      )}
    </div>
  );
}
