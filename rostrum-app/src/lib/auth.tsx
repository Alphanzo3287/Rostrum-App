// =====================================================================
// The Rostrum · auth.tsx
// <AuthProvider> wraps the app. useAuth() drives the Auth + Onboard screens.
//   signUp   -> Auth "Create account"  (metadata seeds the profile via trigger)
//   completeOnboarding -> Onboard screen (avatar upload + profile fields)
//   signIn / signOut    -> Auth "Log in" / NavBar avatar menu
// =====================================================================
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import type { Profile, Socials } from './types';

interface SignUpInput { email: string; password: string; displayName: string; handle?: string; }
interface OnboardInput {
  displayName?: string; handle?: string; bio?: string;
  socials?: Socials; topics?: string[]; avatarFile?: File | null;
}

interface AuthCtx {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (i: SignUpInput) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  completeOnboarding: (i: OnboardInput) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (uid: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single();
    setProfile((data as Profile) ?? null);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) await loadProfile(data.session.user.id);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSession(s);
      if (s) await loadProfile(s.user.id); else setProfile(null);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const signUp: AuthCtx['signUp'] = async ({ email, password, displayName, handle }) => {
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { display_name: displayName, handle } }, // -> handle_new_user()
    });
    if (error) throw error;
  };

  const signIn: AuthCtx['signIn'] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => { await supabase.auth.signOut(); };

  const completeOnboarding: AuthCtx['completeOnboarding'] = async (i) => {
    const uid = session?.user.id;
    if (!uid) throw new Error('not authenticated');

    let avatar_url: string | undefined;
    if (i.avatarFile) {
      const path = `${uid}/avatar.${i.avatarFile.name.split('.').pop() ?? 'png'}`;
      const { error: upErr } = await supabase.storage
        .from('avatars').upload(path, i.avatarFile, { upsert: true });
      if (upErr) throw upErr;
      avatar_url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
    }

    const patch: Partial<Profile> = {
      ...(i.displayName ? { display_name: i.displayName } : {}),
      ...(i.handle ? { handle: i.handle } : {}),
      ...(i.bio !== undefined ? { bio: i.bio } : {}),
      ...(i.socials ? { socials: i.socials } : {}),
      ...(i.topics ? { topics: i.topics } : {}),
      ...(avatar_url ? { avatar_url } : {}),
    };
    const { error } = await supabase.from('profiles').update(patch).eq('id', uid);
    if (error) throw error;
    await loadProfile(uid);
  };

  const refreshProfile = async () => { if (session) await loadProfile(session.user.id); };

  return (
    <Ctx.Provider value={{
      user: session?.user ?? null, session, profile, loading,
      signUp, signIn, signOut, completeOnboarding, refreshProfile,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be used inside <AuthProvider>');
  return c;
}
export const useProfile = () => useAuth().profile;
