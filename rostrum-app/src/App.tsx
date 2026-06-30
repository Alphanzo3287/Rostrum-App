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
import { ErrorBoundary } from './components/ErrorBoundary';
import { WelcomeTour } from './components/WelcomeTour';
import { AuthScreen } from './screens/AuthScreen';
import { OnboardScreen } from './screens/OnboardScreen';
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
import { StoreScreen } from './screens/StoreScreen';
import { EarningsScreen } from './screens/EarningsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { WatchScreen } from './screens/WatchScreen';
import { BroadcastScreen } from './screens/BroadcastScreen';
import { SupportScreen } from './screens/SupportScreen';
import { ModerationScreen } from './screens/ModerationScreen';
import { BannedScreen } from './screens/BannedScreen';
import { AdminPortalScreen } from './screens/AdminPortalScreen';
import { getDebate, getMyBan } from './lib/api';
import type { DebateRole, Side } from './lib/types';
import { C, ui } from './lib/theme';

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
  const { session, profile, loading } = useAuth();
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

  if (loading) return <Splash />;
  if (!session) return <AuthScreen onSignedUp={() => setJustSignedUp(true)} />;
  if (isBanned) return <BannedScreen />;

  const needsOnboard = justSignedUp || (profile != null && !profile.bio && profile.topics.length === 0);
  if (needsOnboard) return <OnboardScreen onDone={() => setJustSignedUp(false)} />;

  const isAdmin = !!(profile as any)?.is_admin;

  return (
    <Routes>
      {/* browse routes share the nav shell */}
      <Route element={<Shell />}>
        <Route index element={<LobbyRoute />} />
        <Route path="leaderboard" element={<LeaderboardRoute />} />
        <Route path="teams" element={<TeamsRoute />} />
        <Route path="store" element={<StoreRoute />} />
        <Route path="earnings" element={<EarningsRoute />} />
        <Route path="settings" element={<SettingsRoute />} />
        <Route path="support" element={<SupportRoute />} />
        {isAdmin && <Route path="moderation" element={<ModerationRoute />} />}
        {isAdmin && <Route path="admin" element={<AdminPortalRoute />} />}
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
  return (
    <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column' }}>
      <NavBar />
      <div style={{ flex:1, position:'relative', minHeight:0 }}>
        <ErrorBoundary><Outlet /></ErrorBoundary>
      </div>
      <WelcomeTour />
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
  const [phase, setPhase] = useState<'loading' | 'scheduled' | 'open'>('loading');
  useEffect(() => {
    if (!id) return;
    let on = true;
    getDebate(id)
      .then(({ debate }) => { if (on) setPhase(debate.status === 'scheduled' ? 'scheduled' : 'open'); })
      .catch(() => { if (on) setPhase('open'); });   // let the chamber surface any real error
  }, [id]);
  if (!id) return <Navigate to="/" replace />;
  if (phase === 'loading')
    return <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center', background:C.base,
      fontFamily:ui, color:C.faint }}>Loading…</div>;
  if (phase === 'scheduled')
    return <ScheduledScreen debateId={id} onBack={() => nav('/')} onStarted={() => setPhase('open')} />;
  return <ChamberScreen debateId={id} onLeave={() => nav('/')}
    onEnded={() => nav(`/debate/${id}/results`, { replace: true })} />;
}
function WatchRoute() {
  const { id } = useParams();
  const nav = useNavigate();
  if (!id) return <Navigate to="/" replace />;
  return <WatchScreen debateId={id} onLeave={() => nav('/')} />;
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
function ModerationRoute() {
  return <ModerationScreen />;
}

function Splash() {
  return (
    <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center',
      background:C.base, color:C.dim, fontFamily:ui, fontSize:14 }}>
      Loading the chamber…
    </div>
  );
}
