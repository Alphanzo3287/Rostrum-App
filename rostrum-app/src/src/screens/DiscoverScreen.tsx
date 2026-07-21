// =====================================================================
// The Rostrum · src/screens/DiscoverScreen.tsx
// Real search: profiles by display name/handle, debates by motion/tag.
// Replaces the previous ComingSoon placeholder — this is why searching
// for a user's name or a chamber never returned anything before.
// =====================================================================
import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { searchAll, type SearchResults } from '../lib/api';
import { C, ui, display, mono, a } from '../lib/theme';
import { Avatar, Scroll, Center, Empty, pill } from '../components/ui';

export function DiscoverScreen({ onOpenProfile, onOpenDebate }: {
  onOpenProfile?: (handle: string) => void; onOpenDebate?: (id: string) => void;
}) {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const q = sp.get('q') ?? '';
  const [term, setTerm] = useState(q);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setTerm(q); }, [q]);

  useEffect(() => {
    if (!q.trim()) { setResults(null); return; }
    let alive = true;
    setLoading(true);
    searchAll(q).then(r => { if (alive) setResults(r); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [q]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (term.trim()) nav(`/discover?q=${encodeURIComponent(term.trim())}`);
  }

  const openProfile = (handle: string) => onOpenProfile ? onOpenProfile(handle) : nav(`/u/${handle}`);
  const openDebate = (id: string) => onOpenDebate ? onOpenDebate(id) : nav(`/debate/${id}`);

  return (
    <Scroll title="Discover" maxWidth={860}>
      <form onSubmit={submit} style={{ marginBottom: 24 }}>
        <input value={term} onChange={e => setTerm(e.target.value)}
          placeholder="Search debaters, handles, or chamber topics…"
          style={{ width:'100%', padding:'14px 18px', borderRadius:14, fontSize:15,
            background:C.panel, border:`1px solid ${C.hair}`, color:C.ink, fontFamily:ui, outline:'none' }} />
      </form>

      {!q.trim() ? (
        <Empty>Search for a debater's name or handle, or a chamber's topic.</Empty>
      ) : loading ? (
        <Center>Searching…</Center>
      ) : results && (results.profiles.length > 0 || results.debates.length > 0) ? (
        <div style={{ display:'flex', flexDirection:'column', gap:28 }}>
          {results.profiles.length > 0 && (
            <div>
              <div style={{ fontFamily:ui, fontSize:11, fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase',
                color:C.faint, marginBottom:12 }}>Debaters</div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {results.profiles.map(p => (
                  <button key={p.id} onClick={() => openProfile(p.handle)} style={{ display:'flex', alignItems:'center', gap:12,
                    padding:'12px 14px', borderRadius:12, cursor:'pointer', textAlign:'left', width:'100%',
                    background:C.panel, border:`1px solid ${C.hair}` }}>
                    <Avatar url={p.avatar_url} name={p.display_name} size={40} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontFamily:ui, fontSize:14, fontWeight:600, color:C.ink }}>{p.display_name}</div>
                      <div style={{ fontFamily:mono, fontSize:12, color:C.faint }}>@{p.handle}</div>
                    </div>
                    <span style={{ fontFamily:ui, fontSize:11.5, color:C.faint }}>{p.rank}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {results.debates.length > 0 && (
            <div>
              <div style={{ fontFamily:ui, fontSize:11, fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase',
                color:C.faint, marginBottom:12 }}>Chambers</div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {results.debates.map(d => (
                  <button key={d.id} onClick={() => openDebate(d.id)} style={{ display:'flex', alignItems:'center', gap:12,
                    padding:'12px 14px', borderRadius:12, cursor:'pointer', textAlign:'left', width:'100%',
                    background:C.panel, border:`1px solid ${C.hair}` }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontFamily:ui, fontSize:14, fontWeight:600, color:C.ink,
                        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{d.motion}</div>
                      <div style={{ fontFamily:ui, fontSize:12, color:C.faint, marginTop:2 }}>
                        Hosted by {d.host?.display_name ?? 'Unknown'}</div>
                    </div>
                    {d.status === 'live' && (
                      <span style={{ ...pill, background:a(C.garnet,'1A'), color:C.garnetHi, border:`1px solid ${a(C.garnet,'44')}` }}>
                        ● LIVE</span>
                    )}
                    {d.tag && <span style={pill}>{d.tag}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <Empty>No debaters or chambers matched "{q}".</Empty>
      )}
    </Scroll>
  );
}
