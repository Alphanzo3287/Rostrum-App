// =====================================================================
// The Rostrum · src/App.tsx
// Auth gate + React Router. Browse routes share the NavBar shell; the
// chamber, create flow, and results are full-bleed. Every screen gets the
// navigation callbacks it was built to accept.
// =====================================================================
import { useState, useEffect } from 'react';
import {
  BrowserRouter, Routes, Route, Outlet, Navigate, useNavigate, useParams, useSearchParams,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { ThemeProvider } from './lib/themeContext';
import { NavBar } from './components/NavBar';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { useIsTablet } from './lib/useMediaQuery';
import { ErrorBoundary } from './components/ErrorBoundary';
import { WelcomeTour } from './components/WelcomeTour';
import { AuthScreen } from './screens/AuthScreen';
import { MfaChallengeScreen, ResetPasswordScreen } from './components/authGates';
import { OnboardScreen } from './screens/OnboardScreen';
import { AcceptTermsScreen } from './screens/AcceptTermsScreen';
import { TermsScreen } from './screens/TermsScreen';
import { PrivacyScreen } from './screens/PrivacyScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { CreateDebateScreen } from './screens/CreateDebateScreen';
import { ChamberScreen } from './screens/ChamberScreen';
import { ScheduledScreen } from './screens/ScheduledScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { InviteScreen } from './screens/InviteScreen';
import { InboxScreen, ThreadScreen } from './screens/MessagesScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { LeaderboardScreen } from './screens/LeaderboardScreen';
import { TeamsScreen } from './screens/TeamsScreen';
import { TournamentsScreen } from './screens/TournamentsScreen';
import { DiscoverScreen } from './screens/DiscoverScreen';
import { NotificationsScreen } from './screens/NotificationsScreen';
import { StoreScreen } from './screens/StoreScreen';
import { ProScreen } from './screens/ProScreen';
import { EarningsScreen } from './screens/EarningsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { WatchScreen } from './screens/WatchScreen';
import { BroadcastScreen } from './screens/BroadcastScreen';
import { SupportScreen } from './screens/SupportScreen';
import { ModerationScreen } from './screens/ModerationScreen';
import { BannedScreen } from './screens/BannedScreen';
import { AdminPortalScreen } from './screens/AdminPortalScreen';
import { BackOfficeScreen } from './screens/BackOfficeScreen';
import { LibraryScreen } from './screens/LibraryScreen';
import { ReplayScreen } from './screens/ReplayScreen';
import { getDebate, getMyBan } from './lib/api';
import { hasPaidDebateEntry, startDebateEntryCheckout } from './lib/payments';
import type { DebateRole, Side } from './lib/types';
import { C, ui, display, solidGold, ghostBtn, a } from './lib/theme';
import { isPro, claimProStipend } from './lib/pro';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Gate />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

/* Decide auth → onboarding → ban → app, then hand off to the router. */
function Gate() {
  const { session, profile, loading, recoveryMode, mfaRequired, refreshProfile } = useAuth();
  const [justSignedUp, setJustSignedUp] = useState(false);
  const [isBanned, setIsBanned] = useState(false);

  useEffect(() => {
    if (session && profile) {
      if ((profile as any).is_banned) { setIsBanned(true); return; }
      // Double-check via ban table in case profile cache is stale
      getMyBan().then(b => { if (b && !b.lifted_at) setIsBanned(true); }).catch(() => {});
    }
  }, [session, profile]);

  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/broadcast/')) {
    return (
      <Routes>
        <Route path="broadcast/:id" element={<BroadcastScreen />} />
      </Routes>
    );
  }

  if (typeof window !== 'undefined' && (window.location.pathname === '/terms' || window.location.pathname === '/privacy')) {
    return (
      <Routes>
        <Route path="terms" element={<TermsScreen />} />
        <Route path="privacy" element={<PrivacyScreen />} />
      </Routes>
    );
  }

  if (loading) return <Splash />;
  // Arrived from a password-reset email → let them set a new password
  // before anything else, even though a (recovery) session exists.
  if (recoveryMode) return <ResetPasswordScreen />;
  // Signed in with a password but the account has 2FA → require the code.
  if (session && mfaRequired) return <MfaChallengeScreen />;
  if (!session) {
    const returningFromStripe = typeof window !== 'undefined'
      && /[?&](purchase|onboarding)=/.test(window.location.search);
    return <AuthScreen onSignedUp={() => setJustSignedUp(true)}
      notice={returningFromStripe ? 'Your Stripe step went through — just sign back in to pick up where you left off.' : undefined} />;
  }
  if (isBanned) return <BannedScreen />;

  // Terms/Privacy acceptance comes first, once, right after signup — before
  // the tutorial. Gated on a real timestamp, not inferred from profile fields.
  if (profile != null && !profile.terms_accepted_at) {
    return <AcceptTermsScreen onDone={async () => { await refreshProfile(); }} />;
  }

  // Tutorial: previously inferred from an empty bio/topics, which meant
  // anyone who skipped those fields saw it again on every single login.
  // Now gated on a real "seen it" timestamp set once onboarding finishes.
  const needsOnboard = justSignedUp && profile != null && !profile.onboarded_at;
  if (needsOnboard) return <OnboardScreen onDone={() => setJustSignedUp(false)} />;

  const isAdmin = !!(profile as any)?.is_admin;

  return (
    <Routes>
      {/* browse routes share the nav shell */}
      <Route element={<Shell />}>
        <Route index element={<LobbyRoute />} />
        <Route path="leaderboard" element={<LeaderboardRoute />} />
        <Route path="teams" element={<TeamsRoute />} />
        <Route path="tournaments" element={<TournamentsScreen />} />
        <Route path="store" element={<StoreRoute />} />
        <Route path="pro" element={<ProScreen />} />
        <Route path="earnings" element={<EarningsRoute />} />
        <Route path="settings" element={<SettingsRoute />} />
        <Route path="support" element={<SupportRoute />} />
        <Route path="communities" element={<ComingSoonRoute title="Communities" subtitle="Find your tribe. Join debate communities by topic, school, or interest." />} />
        <Route path="discover" element={<DiscoverScreen />} />
        <Route path="live" element={<ComingSoonRoute title="Live Arenas" subtitle="All live debates, all the time. Watch what's happening right now." />} />
        <Route path="library" element={<LibraryScreen />} />
        <Route path="replay/:id" element={<ReplayScreen />} />
        <Route path="notifications" element={<NotificationsScreen />} />
        {isAdmin && <Route path="moderation" element={<ModerationRoute />} />}
        {isAdmin && <Route path="admin" element={<AdminPortalRoute />} />}
        {isAdmin && <Route path="backoffice" element={<BackOfficeRoute />} />}
        <Route path="me" element={<ProfileRoute />} />
        <Route path="u/:handle" element={<ProfileRoute />} />
        <Route path="messages" element={<InboxRoute />} />
        <Route path="messages/:handle" element={<ThreadRoute />} />
      </Route>
      {/* full-bleed routes — each gets its own boundary so a crash shows a
          recovery card with an escape, never a black void that traps the user */}
      <Route path="host" element={<ErrorBoundary><CreateRoute /></ErrorBoundary>} />
      <Route path="debate/:id/join" element={<ErrorBoundary><InviteRoute /></ErrorBoundary>} />
      <Route path="debate/:id/watch" element={<ErrorBoundary><WatchRoute /></ErrorBoundary>} />
      <Route path="debate/:id" element={<ErrorBoundary><ChamberRoute /></ErrorBoundary>} />
      <Route path="debate/:id/results" element={<ErrorBoundary><ResultsRoute /></ErrorBoundary>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function Shell() {
  const isMobile = useIsTablet();
  const { profile, refreshProfile } = useAuth();
  const [stipend, setStipend] = useState<number | null>(null);

  // Grant the monthly Pro stipend once per session-load if it's due. The RPC
  // is idempotent (once per calendar month), so calling on every mount is safe.
  useEffect(() => {
    if (!isPro(profile)) return;
    let alive = true;
    claimProStipend().then(amt => {
      if (alive && amt > 0) { setStipend(amt); refreshProfile(); setTimeout(() => alive && setStipend(null), 6000); }
    }).catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, profile?.pro_until]);

  return (
    <div style={{ position:'absolute', inset:0, display:'flex', flexDirection: isMobile ? 'column' : 'row', overflow:'hidden' }}>
      <Sidebar />
      <div style={{ flex:1, position:'relative', minHeight:0, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <TopBar />
        <div style={{ flex:1, minHeight:0, overflow:'auto' }}>
          <ErrorBoundary><Outlet /></ErrorBoundary>
        </div>
      </div>
      <WelcomeTour />
      {stipend != null && (
        <div style={{ position:'fixed', bottom:22, left:'50%', transform:'translateX(-50%)', zIndex:9999,
          display:'flex', alignItems:'center', gap:10, padding:'12px 18px', borderRadius:12,
          background:'#141118', border:`1px solid ${a(C.gold,'55')}`, boxShadow:`0 12px 40px ${a('#000000','66')}`,
          fontFamily:ui, fontSize:13.5, color:C.ink }}>
          <span style={{ fontSize:16 }}>👑</span>
          Your monthly Pro stipend of <b style={{ color:C.gold }}>{stipend.toLocaleString()} D-Bucks</b> was added.
        </div>
      )}
    </div>
  );
}

/* ---- route wrappers: read params, supply navigate callbacks ---- */
function LobbyRoute() {
  const nav = useNavigate();
  return <LobbyScreen onOpenDebate={id => nav(`/debate/${id}`)} onHost={() => nav('/host')} />;
}
function LeaderboardRoute() {
  const nav = useNavigate();
  return <LeaderboardScreen onOpenProfile={h => nav(`/u/${h}`)} />;
}
function TeamsRoute() {
  const nav = useNavigate();
  return <TeamsScreen onOpenProfile={h => nav(`/u/${h}`)} />;
}
function StoreRoute() {
  const nav = useNavigate();
  return <StoreScreen onBack={() => nav(-1)} />;
}
function EarningsRoute() {
  const nav = useNavigate();
  return <EarningsScreen onBack={() => nav('/')} />;
}
function SettingsRoute() {
  const nav = useNavigate();
  return <SettingsScreen onBack={() => nav('/')} />;
}
function ProfileRoute() {
  const { handle } = useParams();
  const nav = useNavigate();
  return <ProfileScreen handle={handle} onBack={() => nav(-1)} onOpenStore={() => nav('/store')}
    onMessage={h => nav(`/messages/${h}`)} />;
}
function InboxRoute() {
  const nav = useNavigate();
  return <InboxScreen onOpen={h => nav(`/messages/${h}`)} onBack={() => nav('/')} />;
}
function ThreadRoute() {
  const { handle } = useParams();
  const nav = useNavigate();
  if (!handle) return <Navigate to="/messages" replace />;
  return <ThreadScreen handle={handle} onBack={() => nav('/messages')}
    onOpenProfile={h => nav(`/u/${h}`)} onOpenInvite={p => nav(p)} />;
}
function CreateRoute() {
  const nav = useNavigate();
  return <CreateDebateScreen onCancel={() => nav('/')} onCreated={id => nav(`/debate/${id}`)} />;
}
function ChamberRoute() {
  const { id } = useParams();
  const nav = useNavigate();
  const [phase, setPhase] = useState<'loading' | 'scheduled' | 'open' | 'paywall'>('loading');
  const [paywallInfo, setPaywallInfo] = useState<{ motion: string; priceCents: number } | null>(null);
  useEffect(() => {
    if (!id) return;
    let on = true;
    (async () => {
      try {
        const { debate } = await getDebate(id);
        if (!on) return;
        if (debate.status === 'scheduled') { setPhase('scheduled'); return; }
        if (debate.is_paid && debate.price_cents) {
          const paid = await hasPaidDebateEntry(id);
          if (!on) return;
          if (!paid) { setPaywallInfo({ motion: debate.motion, priceCents: debate.price_cents }); setPhase('paywall'); return; }
        }
        setPhase('open');
      } catch { if (on) setPhase('open'); }   // let the chamber surface any real error
    })();
    return () => { on = false; };
  }, [id]);
  if (!id) return <Navigate to="/" replace />;
  if (phase === 'loading')
    return <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center', background:C.base,
      fontFamily:ui, color:C.faint }}>Loading…</div>;
  if (phase === 'scheduled')
    return <ScheduledScreen debateId={id} onBack={() => nav('/')} onStarted={() => setPhase('open')} />;
  if (phase === 'paywall' && paywallInfo)
    return <PaywallScreen debateId={id} motion={paywallInfo.motion} priceCents={paywallInfo.priceCents} onBack={() => nav('/')} />;
  return <ChamberScreen debateId={id} onLeave={() => nav('/')}
    onEnded={() => nav(`/debate/${id}/results`, { replace: true })} />;
}
function PaywallScreen({ debateId, motion, priceCents, onBack }: {
  debateId: string; motion: string; priceCents: number; onBack: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function pay() {
    setBusy(true); setErr('');
    try { const { url } = await startDebateEntryCheckout(debateId); window.location.href = url; }
    catch (e: any) { setErr(e?.message ?? 'Could not start checkout'); setBusy(false); }
  }
  return (
    <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center', background:C.base, padding:20 }}>
      <div style={{ width:400, maxWidth:'100%', textAlign:'center', padding:'34px 28px', borderRadius:18,
        border:`1px solid ${C.hair}`, background:C.panel }}>
        <div style={{ fontFamily:ui, fontSize:11, fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:C.gold, marginBottom:10 }}>
          Pay-per-view</div>
        <h2 style={{ fontFamily:display, fontSize:22, fontWeight:600, color:C.ink, margin:'0 0 8px', lineHeight:1.3 }}>{motion}</h2>
        <p style={{ fontFamily:ui, fontSize:13.5, color:C.faint, margin:'0 0 24px' }}>This room requires payment to enter.</p>
        {err && <div style={{ fontFamily:ui, fontSize:12.5, color:C.garnetHi, marginBottom:14 }}>{err}</div>}
        <button onClick={pay} disabled={busy} style={{ ...solidGold, width:'100%', opacity: busy ? .6 : 1 }}>
          {busy ? 'Opening…' : `Pay $${(priceCents / 100).toFixed(2)} to enter`}
        </button>
        <button onClick={onBack} style={{ ...ghostBtn, width:'100%', marginTop:10 }}>Back to lobby</button>
      </div>
    </div>
  );
}
function WatchRoute() {
  const { id } = useParams();
  const nav = useNavigate();
  const [gate, setGate] = useState<'loading' | 'paywall' | 'ok'>('loading');
  const [info, setInfo] = useState<{ motion: string; priceCents: number } | null>(null);
  useEffect(() => {
    if (!id) return;
    let on = true;
    (async () => {
      try {
        const { debate } = await getDebate(id);
        if (!on) return;
        if (debate.is_paid && debate.price_cents) {
          const paid = await hasPaidDebateEntry(id);
          if (!on) return;
          if (!paid) { setInfo({ motion: debate.motion, priceCents: debate.price_cents }); setGate('paywall'); return; }
        }
        setGate('ok');
      } catch { if (on) setGate('ok'); }
    })();
    return () => { on = false; };
  }, [id]);
  if (!id) return <Navigate to="/" replace />;
  if (gate === 'loading')
    return <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center', background:C.base,
      fontFamily:ui, color:C.faint }}>Loading…</div>;
  if (gate === 'paywall' && info)
    return <PaywallScreen debateId={id} motion={info.motion} priceCents={info.priceCents} onBack={() => nav(`/debate/${id}`)} />;
  return <WatchScreen debateId={id} onLeave={() => nav(`/debate/${id}`)} />;
}
function InviteRoute() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  if (!id) return <Navigate to="/" replace />;
  const role = (sp.get('role') ?? 'audience') as DebateRole;
  const side = (sp.get('side') as Side | null) ?? null;
  return <InviteScreen debateId={id} role={role} side={side}
    onAccept={() => nav(`/debate/${id}`)} onDecline={() => nav('/')} />;
}
function ResultsRoute() {
  const { id } = useParams();
  const nav = useNavigate();
  if (!id) return <Navigate to="/" replace />;
  return <ResultsScreen debateId={id} onBackToLobby={() => nav('/')} />;
}

function SupportRoute() {
  return <SupportScreen />;
}
function AdminPortalRoute() {
  return <AdminPortalScreen />;
}
function BackOfficeRoute() {
  return <BackOfficeScreen />;
}
function ModerationRoute() {
  return <ModerationScreen />;
}

/* ── Coming Soon route — used for stubbed nav items. ── */
function ComingSoonRoute({ title, subtitle }: { title: string; subtitle: string }) {
  const nav = useNavigate();
  return (
    <div style={{ minHeight:'100vh', display:'grid', placeItems:'center', padding:24,
      fontFamily:ui, background:C.base }}>
      <div style={{ maxWidth:520, width:'100%', textAlign:'center', padding:'40px 32px',
        borderRadius:24, background:C.panel,
        border:`1px solid ${C.hair}`,
        boxShadow:`0 30px 80px rgba(0,0,0,0.3), 0 1px 0 rgba(255,255,255,0.05) inset` }}>
        <div style={{ width:64, height:64, margin:'0 auto 22px', borderRadius:18,
          display:'grid', placeItems:'center', color:'#FFFFFF', fontSize:28,
          background:`linear-gradient(135deg, ${C.gold}, ${C.cyan})`,
          boxShadow:`0 12px 36px ${a(C.gold,'4D')}` }}>✨</div>
        <div style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'4px 12px',
          borderRadius:999, background:a(C.cyan,'14'), border:`1px solid ${a(C.cyan,'33')}`,
          marginBottom:14 }}>
          <span style={{ fontFamily:ui, fontSize:10, fontWeight:800, color:C.cyan,
            textTransform:'uppercase', letterSpacing:'.14em' }}>COMING SOON</span>
        </div>
        <h1 style={{ fontFamily:display, fontSize:34, fontWeight:700, color:C.ink,
          margin:'0 0 12px', letterSpacing:'-.02em' }}>{title}</h1>
        <p style={{ fontFamily:ui, fontSize:14, color:C.dim, lineHeight:1.6,
          margin:'0 0 28px', maxWidth:380, marginLeft:'auto', marginRight:'auto' }}>
          {subtitle}
        </p>
        <button onClick={() => nav('/')} style={{ ...solidGold, padding:'12px 22px', fontSize:13.5 }}>
          Back to Home
        </button>
      </div>
    </div>
  );
}

function Splash() {
  return (
    <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center',
      background:C.base, color:C.dim, fontFamily:ui, fontSize:14 }}>
      Loading the chamber…
    </div>
  );
}
