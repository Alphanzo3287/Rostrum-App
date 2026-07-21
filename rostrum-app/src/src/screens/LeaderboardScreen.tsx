// =====================================================================
// The Rostrum · src/screens/LeaderboardScreen.tsx
// People ranked by points (topProfiles) and teams ranked by wins (listTeams).
// =====================================================================
import { useEffect, useState } from 'react';
import { topProfiles, listTeams } from '../lib/api';
import type { Profile, Team } from '../lib/types';
import { C, ui, display, mono } from '../lib/theme';
import { Avatar, Scroll, Empty } from '../components/ui';

const medal = (i: number) => (i === 0 ? C.gold : i === 1 ? '#C7CBD1' : i === 2 ? '#B07A4B' : C.faint);

export function LeaderboardScreen({ onBack, onOpenProfile }: {
  onBack?: () => void; onOpenProfile?: (handle: string) => void;
}) {
  const [tab, setTab] = useState<'people' | 'teams'>('people');
  const [people, setPeople] = useState<Profile[] | null>(null);
  const [teams, setTeams] = useState<Team[] | null>(null);

  useEffect(() => { topProfiles(50).then(setPeople); listTeams().then(setTeams); }, []);

  const tabBtn = (k: 'people' | 'teams', label: string) => (
    <button onClick={() => setTab(k)} style={{ padding:'8px 16px', borderRadius:7, border:'none', cursor:'pointer',
      fontFamily:ui, fontSize:13, fontWeight:600, color: tab === k ? C.base : C.dim, background: tab === k ? C.gold : 'transparent' }}>{label}</button>
  );

  return (
    <Scroll title="Leaderboard" onBack={onBack}
      right={<div style={{ display:'flex', gap:6, background:C.panel, padding:5, borderRadius:9, border:`1px solid ${C.hair}` }}>
        {tabBtn('people', 'Debaters')}{tabBtn('teams', 'Teams')}</div>}>

      {tab === 'people' && (
        !people ? <Empty>Loading…</Empty> :
        people.length === 0 ? <Empty>No ranked debaters yet.</Empty> :
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {people.map((p, i) => (
            <button key={p.id} onClick={() => onOpenProfile?.(p.handle)} style={row}>
              <span style={{ width:30, fontFamily:mono, fontSize:16, fontWeight:700, color:medal(i) }}>{i + 1}</span>
              <Avatar url={p.avatar_url} name={p.display_name} size={40} />
              <div style={{ flex:1, textAlign:'left', minWidth:0 }}>
                <div style={{ fontFamily:ui, fontSize:14.5, fontWeight:600, color:C.ink, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.display_name}</div>
                <div style={{ fontFamily:mono, fontSize:11.5, color:C.faint }}>{p.rank} · {p.wins}W {p.losses}L</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontFamily:mono, fontSize:16, fontWeight:700, color:C.gold }}>{p.points.toLocaleString()}</div>
                <div style={{ fontFamily:ui, fontSize:10, color:C.faint, textTransform:'uppercase', letterSpacing:'.5px' }}>points</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {tab === 'teams' && (
        !teams ? <Empty>Loading…</Empty> :
        teams.length === 0 ? <Empty>No teams yet — start one in Teams.</Empty> :
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {teams.map((t, i) => (
            <div key={t.id} style={row}>
              <span style={{ width:30, fontFamily:mono, fontSize:16, fontWeight:700, color:medal(i) }}>{i + 1}</span>
              <span style={{ width:38, height:38, borderRadius:8, display:'grid', placeItems:'center', flexShrink:0,
                background:`${t.color}22`, border:`1px solid ${t.color}66`, color:t.color, fontFamily:display, fontWeight:700, fontSize:13 }}>{t.tag}</span>
              <div style={{ flex:1, textAlign:'left' }}>
                <div style={{ fontFamily:ui, fontSize:14.5, fontWeight:600, color:C.ink }}>{t.name}</div>
                <div style={{ fontFamily:mono, fontSize:11.5, color:C.faint }}>{t.member_count} members</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontFamily:mono, fontSize:16, fontWeight:700, color:C.jadeHi }}>{t.wins}W</div>
                <div style={{ fontFamily:ui, fontSize:10, color:C.faint, textTransform:'uppercase', letterSpacing:'.5px' }}>{t.losses}L</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Scroll>
  );
}

const row: React.CSSProperties = { display:'flex', alignItems:'center', gap:13, padding:'11px 14px', borderRadius:9,
  border:`1px solid ${C.hair}`, background:C.panel, cursor:'pointer', width:'100%' };
