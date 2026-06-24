// =====================================================================
// The Rostrum · src/screens/ProfileScreen.tsx
// Your profile by default (from useAuth), or someone else's by handle.
// Record + points + followers, achievements, wallet (self), follow (others).
// =====================================================================
import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { getProfile, getAchievements, amFollowing, follow, unfollow } from '../lib/api';
import type { Profile, Achievement } from '../lib/types';
import { C, ui, display, mono, solidGold } from '../lib/theme';
import { Avatar, RankBadge, Stat, Section, Scroll, Center, Empty, pill, ghostBtn, hrefFor } from '../components/ui';

export function ProfileScreen({ handle, onBack, onOpenStore }: {
  handle?: string; onBack?: () => void; onOpenStore?: () => void;
}) {
  const { profile: me } = useAuth();
  const isSelf = !handle || handle === me?.handle;
  const [profile, setProfile] = useState<Profile | null>(isSelf ? me : null);
  const [achievements, setAch] = useState<(Achievement & { earned_at: string })[]>([]);
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isSelf) setProfile(me);
    else if (handle) getProfile(handle).then(setProfile);
  }, [handle, isSelf, me]);

  useEffect(() => {
    if (!profile) return;
    getAchievements(profile.id).then(setAch);
    if (!isSelf) amFollowing(profile.id).then(setFollowing);
  }, [profile, isSelf]);

  if (!profile) return <Center>Loading profile…</Center>;

  async function toggleFollow() {
    if (!profile) return;
    setBusy(true);
    try { following ? await unfollow(profile.id) : await follow(profile.id); setFollowing(f => !f); }
    catch (e: any) { alert(e?.message ?? 'Could not update'); }
    finally { setBusy(false); }
  }

  const games = profile.wins + profile.losses;
  const winRate = games ? Math.round((profile.wins / games) * 100) : 0;
  const socials = Object.entries(profile.socials ?? {}).filter(([, v]) => v) as [string, string][];

  return (
    <Scroll title={isSelf ? 'Your profile' : 'Profile'} onBack={onBack}>
      {/* header */}
      <div style={{ display:'flex', gap:18, alignItems:'flex-start', flexWrap:'wrap' }}>
        <Avatar url={profile.avatar_url} name={profile.display_name} size={86} />
        <div style={{ flex:1, minWidth:220 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
            <h2 style={{ fontFamily:display, fontSize:32, fontWeight:600, color:C.ink, margin:0 }}>{profile.display_name}</h2>
            <RankBadge rank={profile.rank} level={profile.level} />
          </div>
          <div style={{ fontFamily:mono, fontSize:13, color:C.dim, marginTop:4 }}>@{profile.handle}</div>
          {profile.bio && <p style={{ fontFamily:ui, fontSize:14, color:C.dim, lineHeight:1.5, margin:'12px 0 0', maxWidth:560 }}>{profile.bio}</p>}
          <div style={{ display:'flex', gap:8, marginTop:14, flexWrap:'wrap' }}>
            {profile.topics?.map(t => <span key={t} style={pill}>{t}</span>)}
          </div>
          {socials.length > 0 && (
            <div style={{ display:'flex', gap:14, marginTop:14 }}>
              {socials.map(([k, v]) => (
                <a key={k} href={hrefFor(k, v)} target="_blank" rel="noreferrer"
                  style={{ fontFamily:ui, fontSize:12.5, color:C.gold, textDecoration:'none' }}>{k}</a>
              ))}
            </div>
          )}
        </div>
        {!isSelf && (
          <button onClick={toggleFollow} disabled={busy} style={following ? ghostBtn : solidGold}>
            {following ? 'Following ✓' : 'Follow'}
          </button>
        )}
      </div>

      {/* record */}
      <div style={{ display:'flex', gap:32, flexWrap:'wrap', marginTop:26, padding:'18px 0',
        borderTop:`1px solid ${C.hair}`, borderBottom:`1px solid ${C.hair}` }}>
        <Stat label="Wins" value={profile.wins} color={C.jadeHi} />
        <Stat label="Losses" value={profile.losses} color={C.garnetHi} />
        <Stat label="Win rate" value={`${winRate}%`} />
        <Stat label="Points" value={profile.points.toLocaleString()} color={C.gold} />
        <Stat label="Followers" value={profile.follower_count} />
        <Stat label="Following" value={profile.following_count} />
      </div>

      {/* wallet (self) */}
      {isSelf && (
        <div style={{ display:'flex', alignItems:'center', gap:14, marginTop:22, padding:'16px 18px',
          borderRadius:10, border:`1px solid ${C.hair}`, background:C.panel }}>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:ui, fontSize:11, letterSpacing:'.6px', textTransform:'uppercase', color:C.faint }}>Wallet</div>
            <div style={{ fontFamily:mono, fontSize:26, fontWeight:700, color:C.gold }}>◈ {profile.virtual_cash.toLocaleString()}</div>
          </div>
          {onOpenStore && <button onClick={onOpenStore} style={ghostBtn}>Visit the store</button>}
        </div>
      )}

      {/* achievements */}
      <Section title={`Achievements · ${achievements.length}`}>
        {achievements.length === 0
          ? <Empty>No badges yet — win debates and climb the ranks.</Empty>
          : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:12 }}>
              {achievements.map(a => (
                <div key={a.id} style={{ padding:16, borderRadius:10, border:`1px solid ${C.hair}`, background:C.panel }}>
                  <div style={{ fontSize:26 }}>{a.icon}</div>
                  <div style={{ fontFamily:ui, fontSize:14, fontWeight:600, color:C.ink, marginTop:8 }}>{a.name}</div>
                  <div style={{ fontFamily:ui, fontSize:12, color:C.faint, marginTop:3, lineHeight:1.4 }}>{a.description}</div>
                </div>
              ))}
            </div>}
      </Section>
    </Scroll>
  );
}
