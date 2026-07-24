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
  recoveryMode: boolean;   // landed here from a password-reset email link
  mfaRequired: boolean;    // signed in at aal1 but a verified 2FA factor exists → must step up
  signUp: (i: SignUpInput) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  completeOnboarding: (i: OnboardInput) => Promise<void>;
  skipOnboarding: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  refreshAuthLevel: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);

  const loadProfile = useCallback(async (uid: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single();
    setProfile((data as Profile) ?? null);
  }, []);

  // Does this session still owe us a second factor? True only when the user
  // has a verified TOTP factor (nextLevel aal2) but the current session is
  // still aal1. Until they clear it, we don't treat them as fully logged in.
  const computeMfa = useCallback(async () => {
    try {
      const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      return data?.currentLevel === 'aal1' && data?.nextLevel === 'aal2';
    } catch { return false; }
  }, []);

  const syncSession = useCallback(async (s: Session | null) => {
    setSession(s);
    if (s) {
      const needs = await computeMfa();
      setMfaRequired(needs);
      if (!needs) await loadProfile(s.user.id);
      else setProfile(null);
    } else {
      setProfile(null);
      setMfaRequired(false);
    }
  }, [computeMfa, loadProfile]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      await syncSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, s) => {
      // A reset-password link signs the user in with a special recovery
      // session and fires this event — intercept it so we show the
      // "set a new password" screen instead of the normal app.
      if (event === 'PASSWORD_RECOVERY') { setSession(s); setRecoveryMode(true); return; }
      await syncSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, [syncSession]);

  const refreshAuthLevel = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await syncSession(data.session);
  }, [syncSession]);

  const signUp: AuthCtx['signUp'] = async ({ email, password, displayName, handle }) => {
    const { error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(), password,
      options: { data: { display_name: displayName, handle } }, // -> handle_new_user()
    });
    if (error) throw error;
  };

  const signIn: AuthCtx['signIn'] = async (email, password) => {
    // Normalize the email so casing/whitespace from mobile keyboards can't cause
    // a spurious "Invalid credentials" on a device without saved autofill.
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) throw error;
  };

  const signOut = async () => { setRecoveryMode(false); await supabase.auth.signOut(); };

  const resetPasswordForEmail: AuthCtx['resetPasswordForEmail'] = async (email) => {
    const redirectTo = `${window.location.origin}/?recovery=1`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
    if (error) throw error;
  };

  const updatePassword: AuthCtx['updatePassword'] = async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    setRecoveryMode(false);
    // The recovery session is a normal aal1 session afterwards; re-sync so
    // the app proceeds (or asks for MFA if the account also has 2FA).
    const { data } = await supabase.auth.getSession();
    await syncSession(data.session);
  };

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
      onboarded_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('profiles').update(patch).eq('id', uid);
    if (error) throw error;
    await loadProfile(uid);
  };

  /** Skip the tutorial without filling anything in — still marks it seen so
   *  it never shows again on future logins (this was the original bug). */
  const skipOnboarding = async () => {
    const uid = session?.user.id;
    if (!uid) return;
    await supabase.rpc('mark_onboarded');
    await loadProfile(uid);
  };

  const refreshProfile = async () => { if (session) await loadProfile(session.user.id); };

  return (
    <Ctx.Provider value={{
      user: session?.user ?? null, session, profile, loading, recoveryMode, mfaRequired,
      signUp, signIn, signOut, completeOnboarding, skipOnboarding, refreshProfile,
      resetPasswordForEmail, updatePassword, refreshAuthLevel,
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
