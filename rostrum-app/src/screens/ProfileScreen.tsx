// =====================================================================
// The Rostrum · src/screens/ProfileScreen.tsx
// Your profile by default (from useAuth), or someone else's by handle.
// Record + points + followers, achievements, wallet (self), follow (others).
// =====================================================================
import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { getProfile, getAchievements, amFollowing, follow, unfollow } from '../lib/api';
import { ReportModal } from '../components/ReportModal';
import type { Profile, Achievement } from '../lib/types';
import { C, ui, display, mono, solidGold, a } from '../lib/theme';
import { Avatar, RankBadge, Section, Scroll, Center, Empty, pill, ghostBtn, hrefFor } from '../components/ui';
import { getMyWallet, getMyProgress, type Wallet, type Progress } from '../lib/payments';

export function ProfileScreen({ handle, onBack, onOpenStore, onMessage }: {
  handle?: string; onBack?: () => void; onOpenStore?: () => void; onMessage?: (handle: string) => void;
}) {
  const { profile: me } = useAuth();
  const isSelf = !handle || handle === me?.handle;
  const [profile, setProfile] = useState<Profile | null>(isSelf ? me : null);
  const [achievements, setAch] = useState<(Achievement & { earned_at: string })[]>([]);
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);

  useEffect(() => {
    if (isSelf) setProfile(me);
    else if (handle) getProfile(handle).then(setProfile);
  }, [handle, isSelf, me]);

  useEffect(() => {
    if (!profile) return;
    getAchievements(profile.id).then(setAch);
    if (!isSelf) amFollowing(profile.id).then(setFollowing);
  }, [profile, isSelf]);

  useEffect(() => {
    if (isSelf) {
      getMyWallet().then(setWallet).catch(() => {});
      getMyProgress().then(setProgress).catch(() => {});
    }
  }, [isSelf]);

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
      {/* premium header card with gradient cover */}
      <div style={{ borderRadius:24, overflow:'hidden', border:`1px solid ${C.hair}`,
        background:C.panel, marginBottom:22 }}>
        {/* cover band */}
        <div style={{ height:120, position:'relative',
          background:`linear-gradient(120deg, ${a(C.gold,'5C')}, ${a(C.cyan,'38')}, ${a(C.jade,'24')})` }}>
          <div style={{ position:'absolute', inset:0, opacity:0.25,
            background:`radial-gradient(circle at 20% 50%, ${a('#FFFFFF','40')}, transparent 50%)` }} />
        </div>
        <div style={{ padding:'0 28px 24px' }}>
          <div style={{ display:'flex', gap:20, alignItems:'flex-end', flexWrap:'wrap', marginTop:-44,
            position:'relative', zIndex:1 }}>
            <div style={{ borderRadius:'50%', padding:4, background:C.panel }}>
              <Avatar url={profile.avatar_url} name={profile.display_name} size={92} />
            </div>
            <div style={{ flex:1, minWidth:220, paddingBottom:4 }}>
              <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                <h2 style={{ fontFamily:display, fontSize:30, fontWeight:700, color:C.ink, margin:0, letterSpacing:'-.02em' }}>{profile.display_name}</h2>
                <RankBadge rank={profile.rank} level={profile.level} />
              </div>
              <div style={{ fontFamily:mono, fontSize:13, color:C.faint, marginTop:4 }}>@{profile.handle}</div>
            </div>
            {!isSelf && (
              <div style={{ display:'flex', gap:9, alignItems:'center', paddingBottom:6, flexWrap:'wrap' }}>
                {onMessage && (
                  <button onClick={() => onMessage(profile.handle)} style={solidGold}>Message</button>
                )}
                <button onClick={toggleFollow} disabled={busy} style={ghostBtn}>
                  {following ? 'Following ✓' : 'Follow'}
                </button>
                <ReportModal targetType="user" targetId={profile.id} label="⚑ Report" />
              </div>
            )}
          </div>
          {profile.bio && <p style={{ fontFamily:ui, fontSize:14, color:C.dim, lineHeight:1.6, margin:'16px 0 0', maxWidth:560 }}>{profile.bio}</p>}
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
      </div>

      {/* record — editorial stat cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:12, marginBottom:22 }}>
        {[
          { label:'Wins', value:profile.wins, color:C.jadeHi },
          { label:'Losses', value:profile.losses, color:C.garnetHi },
          { label:'Win rate', value:`${winRate}%`, color:C.ink },
          { label:'Points', value:profile.points.toLocaleString(), color:C.gold },
          { label:'Followers', value:profile.follower_count, color:C.ink },
          { label:'Following', value:profile.following_count, color:C.ink },
        ].map(s => (
          <div key={s.label} style={{ padding:'16px 18px', borderRadius:16, border:`1px solid ${C.hair}`, background:C.panel }}>
            <div style={{ fontFamily:display, fontSize:24, fontWeight:700, color:s.color, lineHeight:1 }}>{s.value}</div>
            <div style={{ fontFamily:ui, fontSize:11, color:C.faint, marginTop:6, textTransform:'uppercase', letterSpacing:'.08em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* D-Bucks wallet + XP progress (self only) */}
      {isSelf && (
        <div style={{ marginTop:22, display:'flex', gap:14, flexWrap:'wrap' }}>
          {/* Wallet */}
          <div style={{ flex:'1 1 220px', padding:'16px 18px', borderRadius:18, border:`1px solid ${C.hair}`, background:C.panel }}>
            <div style={{ fontFamily:ui, fontSize:11, letterSpacing:'.6px', textTransform:'uppercase', color:C.faint }}>D-Bucks</div>
            <div style={{ fontFamily:mono, fontSize:26, fontWeight:700, color:C.gold, marginTop:4 }}>
              {wallet ? wallet.total.toLocaleString() : '...'}
            </div>
            <div style={{ display:'flex', gap:14, marginTop:8 }}>
              <span style={{ fontFamily:ui, fontSize:11, color:C.faint }}>Spendable <span style={{ color:C.gold, fontFamily:mono }}>{wallet?.promo ?? 0}</span></span>
              <span style={{ fontFamily:ui, fontSize:11, color:C.faint }}>Redeemable <span style={{ color:C.jadeHi, fontFamily:mono }}>{wallet?.redeemable ?? 0}</span></span>
            </div>
            {onOpenStore && <button onClick={onOpenStore} style={{ ...ghostBtn, marginTop:12 }}>Visit the store</button>}
          </div>
          {/* XP + Level progress */}
          {progress && (() => {
            const curLevelXP = 50 * progress.level * (progress.level + 1);
            const pct = progress.next_level_xp > curLevelXP
              ? Math.min(100, Math.round(((progress.xp - curLevelXP) / (progress.next_level_xp - curLevelXP)) * 100))
              : 100;
            const mins = Math.floor(progress.verified_speaking_seconds / 60);
            return (
              <div style={{ flex:'1 1 260px', padding:'16px 18px', borderRadius:18, border:`1px solid ${C.hair}`, background:C.panel }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
                  <div style={{ fontFamily:ui, fontSize:11, letterSpacing:'.6px', textTransform:'uppercase', color:C.faint }}>Level {progress.level}</div>
                  <div style={{ fontFamily:mono, fontSize:12, color:C.dim }}>{progress.xp.toLocaleString()} / {progress.next_level_xp.toLocaleString()} XP</div>
                </div>
                <div style={{ height:8, borderRadius:4, background:C.hair, marginTop:8, overflow:'hidden' }}>
                  <div style={{ height:'100%', borderRadius:4, background:C.gold, width:`${pct}%`, transition:'width .3s' }} />
                </div>
                <div style={{ display:'flex', gap:16, marginTop:10, flexWrap:'wrap' }}>
                  <span style={{ fontFamily:ui, fontSize:11, color:C.faint }}>Qualifying debates <span style={{ color:C.ink, fontFamily:mono }}>{progress.qualifying_debates}</span></span>
                  <span style={{ fontFamily:ui, fontSize:11, color:C.faint }}>Speaking time <span style={{ color:C.ink, fontFamily:mono }}>{mins} min</span></span>
                </div>
                {progress.cashout_unlocked && (
                  <div style={{ fontFamily:ui, fontSize:11, fontWeight:600, color:C.jadeHi, marginTop:8 }}>Cash-out unlocked</div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* achievements */}
      <Section title={`Achievements · ${achievements.length}`}>
        {achievements.length === 0
          ? <Empty>No badges yet — win debates and climb the ranks.</Empty>
          : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:12 }}>
              {achievements.map(a => (
                <div key={a.id} style={{ padding:16, borderRadius:18, border:`1px solid ${C.hair}`, background:C.panel }}>
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
