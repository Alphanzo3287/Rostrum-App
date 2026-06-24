// =====================================================================
// The Rostrum · src/App.tsx
// Auth gate + React Router. Browse routes share the NavBar shell; the
// chamber, create flow, and results are full-bleed. Every screen gets the
// navigation callbacks it was built to accept.
// =====================================================================
import { useState } from 'react';
import {
  BrowserRouter, Routes, Route, Outlet, Navigate, useNavigate, useParams,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { NavBar } from './components/NavBar';
import { AuthScreen } from './screens/AuthScreen';
import { OnboardScreen } from './screens/OnboardScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { CreateDebateScreen } from './screens/CreateDebateScreen';
import { ChamberScreen } from './screens/ChamberScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { LeaderboardScreen } from './screens/LeaderboardScreen';
import { TeamsScreen } from './screens/TeamsScreen';
import { StoreScreen } from './screens/StoreScreen';
import { C, ui } from './lib/theme';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Gate />
      </BrowserRouter>
    </AuthProvider>
  );
}

/* Decide auth → onboarding → app, then hand off to the router. */
function Gate() {
  const { session, profile, loading } = useAuth();
  const [justSignedUp, setJustSignedUp] = useState(false);

  if (loading) return <Splash />;
  if (!session) return <AuthScreen onSignedUp={() => setJustSignedUp(true)} />;

  const needsOnboard = justSignedUp || (profile != null && !profile.bio && profile.topics.length === 0);
  if (needsOnboard) return <OnboardScreen onDone={() => setJustSignedUp(false)} />;

  return (
    <Routes>
      {/* browse routes share the nav shell */}
      <Route element={<Shell />}>
        <Route index element={<LobbyRoute />} />
        <Route path="leaderboard" element={<LeaderboardRoute />} />
        <Route path="teams" element={<TeamsRoute />} />
        <Route path="store" element={<StoreRoute />} />
        <Route path="me" element={<ProfileRoute />} />
        <Route path="u/:handle" element={<ProfileRoute />} />
      </Route>
      {/* full-bleed routes */}
      <Route path="host" element={<CreateRoute />} />
      <Route path="debate/:id" element={<ChamberRoute />} />
      <Route path="debate/:id/results" element={<ResultsRoute />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function Shell() {
  return (
    <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column' }}>
      <NavBar />
      <div style={{ flex:1, position:'relative', minHeight:0 }}>
        <Outlet />
      </div>
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
function ProfileRoute() {
  const { handle } = useParams();
  const nav = useNavigate();
  return <ProfileScreen handle={handle} onBack={() => nav(-1)} onOpenStore={() => nav('/store')} />;
}
function CreateRoute() {
  const nav = useNavigate();
  return <CreateDebateScreen onCancel={() => nav('/')} onCreated={id => nav(`/debate/${id}`)} />;
}
function ChamberRoute() {
  const { id } = useParams();
  const nav = useNavigate();
  if (!id) return <Navigate to="/" replace />;
  return <ChamberScreen debateId={id} onLeave={() => nav('/')}
    onEnded={() => nav(`/debate/${id}/results`, { replace: true })} />;
}
function ResultsRoute() {
  const { id } = useParams();
  const nav = useNavigate();
  if (!id) return <Navigate to="/" replace />;
  return <ResultsScreen debateId={id} onBackToLobby={() => nav('/')} />;
}

function Splash() {
  return (
    <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center',
      background:C.base, color:C.dim, fontFamily:ui, fontSize:14 }}>
      Loading the chamber…
    </div>
  );
}
