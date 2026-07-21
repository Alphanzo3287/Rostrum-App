// =====================================================================
// The Rostrum · supabaseClient.ts
// One shared browser client. Uses Vite env vars; swap to
// process.env.NEXT_PUBLIC_* if you're on Next.
// =====================================================================
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const url  = import.meta.env.VITE_SUPABASE_URL as string;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anon) {
  // Fail loud in dev so a missing .env doesn't show up as silent 401s.
  console.warn('[Rostrum] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient<Database>(url, anon, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

// Realtime authorizes postgres_changes per-subscriber against RLS using the
// token on the *websocket*, which is separate from the REST auth header. If we
// never hand the socket the logged-in user's JWT, it stays anon and RLS-gated
// change events (poll_open / winner_announced on debates, etc.) can silently
// fail to reach non-host clients. Keep the socket token in sync with the session.
supabase.auth.getSession().then(({ data }) => {
  const token = data.session?.access_token;
  if (token) supabase.realtime.setAuth(token);
}).catch(() => {});
supabase.auth.onAuthStateChange((_event, session) => {
  try { supabase.realtime.setAuth(session?.access_token ?? anon); } catch { /* noop */ }
});
