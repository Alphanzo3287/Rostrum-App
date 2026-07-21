// =====================================================================
// The Rostrum · src/server/proAccess.ts
// Server-side membership gate for paid features.
//
// This is the ONLY thing that actually protects a paid feature. Client-side
// checks (isPro in the UI) are a UX affordance — anyone can bypass them by
// calling the function endpoint directly, so every paid endpoint must gate
// here, against the database, using the caller's verified session id.
// =====================================================================
import { supabaseAdmin } from './supabaseAdmin';

export interface AccessResult { ok: boolean; reason?: string }

/** Message shown to free users. Kept in one place so it stays consistent. */
export const GAVEL_UPSELL = 'Gavel is a Rostrum Pro feature. Upgrade to fact-check claims and use the debate tools.';

/**
 * True when the user currently holds an active Pro membership.
 * Admins always pass (they operate the platform).
 */
export async function requirePro(userId: string, reason = GAVEL_UPSELL): Promise<AccessResult> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('pro_until, is_admin')
    .eq('id', userId)
    .maybeSingle();

  // Fail CLOSED on lookup errors: never hand out a paid feature by accident.
  if (error || !data) return { ok: false, reason: 'Could not verify your membership. Please try again.' };
  if (data.is_admin) return { ok: true };

  const active = !!data.pro_until && new Date(data.pro_until as string) > new Date();
  return active ? { ok: true } : { ok: false, reason };
}
