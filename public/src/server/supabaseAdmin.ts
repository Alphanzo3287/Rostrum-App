// =====================================================================
// The Rostrum · src/server/supabaseAdmin.ts
// SERVER ONLY. Uses the service-role key, which bypasses RLS — never ship
// this to the browser. Imported only by netlify/functions/*.
// =====================================================================
import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,                 // same project URL, non-VITE server env
  process.env.SUPABASE_SERVICE_ROLE_KEY!,    // Project Settings → API → service_role
  { auth: { persistSession: false, autoRefreshToken: false } },
);

/** Verify a Supabase access token (Bearer) and return the user, or null. */
export async function userFromToken(authHeader?: string) {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}
