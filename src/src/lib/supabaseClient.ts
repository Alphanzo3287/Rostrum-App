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
