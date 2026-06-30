// =====================================================================
// The Rostrum · src/screens/TeamsScreen.tsx
// Browse + create teams; open one to manage its roster. Admin controls
// (add by @handle, promote/demote, remove) show only for owner/admin.
// =====================================================================
import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import {
  listTeams, createTeam, listTeamMembers, addTeamMember, setTeamRole, removeTeamMember, getProfile,
} from '../lib/api';
import type { Team, TeamMember, Profile, TeamRole } from '../lib/types';
import { C, ui, display, mono, solidGold, field, a } from '../lib/theme';
import { Avatar, Scroll, Empty, ghostBtn } from '../components/ui';

const COLORS = ['#2E9E86', '#B23A55', '#D9B45C', '#5B7CFA', '#C0653A', '#7A4BB0'];

export function TeamsScreen({ onBack, onOpenProfile }: {
  onBack?: () => void; onOpenProfile?: (handle: string) => void;
}) {
  const { profile: me } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [sel, setSel] = useState<Team | null>(null);
  const refresh = () => listTeams().then(setTeams);
  useEffect(() => { refresh(); }, []);

  return (
    <Scroll title="Teams" onBack={onBack} maxWidth={1040}>
      <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr) minmax(0,1.3fr)', gap:18, alignItems:'start' }}>
        {/* left: list + create */}
        <div>
          <CreateTeam onCreated={t => { refresh(); setSel(t); }} />
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:16 }}>
            {teams.length === 0 && <Empty>No teams yet — start the first.</Empty>}
            {teams.map(t => (
              <button key={t.id} onClick={() => setSel(t)} style={{ display:'flex', alignItems:'center', gap:12,
                padding:'11px 13px', borderRadius:9, cursor:'pointer', width:'100%', textAlign:'left',
                border:`1px solid ${sel?.id === t.id ? C.gold : C.hair}`, background: sel?.id === t.id ? 'rgba(217,180,92,0.07)' : C.panel }}>
                <span style={{ width:38, height:38, borderRadius:8, display:'grid', placeItems:'center', flexShrink:0,
                  background:`${t.color}22`, border:`1px solid ${t.color}66`, color:t.color, fontFamily:display, fontWeight:700, fontSize:13 }}>{t.tag}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:ui, fontSize:14, fontWeight:600, color:C.ink }}>{t.name}</div>
                  <div style={{ fontFamily:mono, fontSize:11, color:C.faint }}>{t.member_count} members · {t.wins}W {t.losses}L</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* right: roster */}
        <div style={{ position:'sticky', top:0 }}>
          {sel ? <Roster key={sel.id} team={sel} meId={me?.id} onOpenProfile={onOpenProfile} onChanged={refresh} />
               : <Empty>Select a team to manage its roster.</Empty>}
        </div>
      </div>
    </Scroll>
  );
}

function CreateTeam({ onCreated }: { onCreated: (t: Team) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [busy, setBusy] = useState(false);

  async function go() {
    if (!name.trim() || !tag.trim()) return;
    setBusy(true);
    try { onCreated(await createTeam(name.trim(), tag.trim().toUpperCase().slice(0, 4), color)); setOpen(false); setName(''); setTag(''); }
    catch (e: any) { alert(e?.message ?? 'Could not create team'); }
    finally { setBusy(false); }
  }

  if (!open) return <button onClick={() => setOpen(true)} style={{ ...solidGold, width:'100%' }}>＋ Create a team</button>;
  return (
    <div style={{ padding:16, borderRadius:10, border:`1px solid ${C.hair}`, background:C.panel }}>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Team name" style={field} />
      <div style={{ display:'flex', gap:10, marginTop:10 }}>
        <input value={tag} onChange={e => setTag(e.target.value)} placeholder="TAG" maxLength={4} style={{ ...field, width:90, textTransform:'uppercase' }} />
        <div style={{ display:'flex', gap:7, alignItems:'center', flexWrap:'wrap' }}>
          {COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)} aria-label={c} style={{ width:24, height:24, borderRadius:'50%',
              background:c, cursor:'pointer', border: color === c ? `2px solid ${C.ink}` : `1px solid ${C.hair}` }} />
          ))}
        </div>
      </div>
      <div style={{ display:'flex', gap:10, marginTop:12 }}>
        <button onClick={go} disabled={busy} style={{ ...solidGold, opacity: busy ? 0.6 : 1 }}>{busy ? 'Creating…' : 'Create'}</button>
        <button onClick={() => setOpen(false)} style={ghostBtn}>Cancel</button>
      </div>
    </div>
  );
}

function Roster({ team, meId, onOpenProfile, onChanged }: {
  team: Team; meId?: string; onOpenProfile?: (handle: string) => void; onChanged: () => void;
}) {
  const [members, setMembers] = useState<(TeamMember & { profile: Profile })[]>([]);
  const [handle, setHandle] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () => listTeamMembers(team.id).then(setMembers);
  useEffect(() => { load(); }, [team.id]);

  const myRole = members.find(m => m.user_id === meId)?.role;
  const canAdmin = myRole === 'owner' || myRole === 'admin';

  async function add() {
    const h = handle.replace(/^@/, '').trim();
    if (!h) return;
    setBusy(true);
    try {
      const p = await getProfile(h);
      if (!p) throw new Error(`No debater @${h}`);
      await addTeamMember(team.id, p.id);
      setHandle(''); await load(); onChanged();
    } catch (e: any) { alert(e?.message ?? 'Could not add'); }
    finally { setBusy(false); }
  }
  async function cycleRole(m: TeamMember) {
    const next: TeamRole = m.role === 'member' ? 'admin' : 'member';
    try { await setTeamRole(team.id, m.user_id, next); await load(); } catch (e: any) { alert(e?.message); }
  }
  async function remove(m: TeamMember) {
    try { await removeTeamMember(team.id, m.user_id); await load(); onChanged(); } catch (e: any) { alert(e?.message); }
  }

  return (
    <div style={{ padding:'20px 20px', borderRadius:12, border:`1px solid ${C.hair}`, background:C.panel }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
        <span style={{ width:46, height:46, borderRadius:9, display:'grid', placeItems:'center', flexShrink:0,
          background:`${team.color}22`, border:`1px solid ${team.color}66`, color:team.color, fontFamily:display, fontWeight:700 }}>{team.tag}</span>
        <div>
          <div style={{ fontFamily:display, fontSize:22, fontWeight:600, color:C.ink }}>{team.name}</div>
          <div style={{ fontFamily:mono, fontSize:12, color:C.faint }}>{team.wins}W {team.losses}L · {team.member_count} members</div>
        </div>
      </div>

      {canAdmin && (
        <div style={{ display:'flex', gap:8, marginBottom:16 }}>
          <input value={handle} onChange={e => setHandle(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
            placeholder="Add by @handle" style={{ ...field, fontSize:13 }} />
          <button onClick={add} disabled={busy} style={{ ...solidGold, padding:'0 14px' }}>{busy ? '…' : 'Add'}</button>
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {members.map(m => (
          <div key={m.user_id} style={{ display:'flex', alignItems:'center', gap:11, padding:'8px 10px', borderRadius:8, border:`1px solid ${C.hair}` }}>
            <Avatar url={m.profile?.avatar_url} name={m.profile?.display_name} size={34} />
            <button onClick={() => m.profile && onOpenProfile?.(m.profile.handle)} style={{ flex:1, textAlign:'left', background:'none', border:'none', cursor:'pointer' }}>
              <div style={{ fontFamily:ui, fontSize:13.5, fontWeight:600, color:C.ink }}>{m.profile?.display_name ?? '—'}</div>
              <div style={{ fontFamily:mono, fontSize:11, color: m.role === 'owner' ? C.gold : C.faint }}>{m.role}</div>
            </button>
            {canAdmin && m.role !== 'owner' && (
              <>
                <button onClick={() => cycleRole(m)} style={{ ...miniBtn }}>{m.role === 'admin' ? 'Make member' : 'Make admin'}</button>
                <button onClick={() => remove(m)} style={{ ...miniBtn, color:C.garnetHi, borderColor:`${a(C.garnet,'66')}` }}>Remove</button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const miniBtn: React.CSSProperties = { fontFamily:ui, fontSize:11, fontWeight:600, color:C.dim, background:'none',
  border:`1px solid ${C.hair}`, borderRadius:5, padding:'5px 9px', cursor:'pointer', whiteSpace:'nowrap' };
