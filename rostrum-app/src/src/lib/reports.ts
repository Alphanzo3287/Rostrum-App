// =====================================================================
// The Rostrum · src/lib/reports.ts
// Bug reports (user-submitted) + admin awareness of abuse reports.
// =====================================================================
import { supabase } from './supabaseClient';

export interface BugReport {
  id: string; body: string; page: string | null; status: string; created_at: string;
  reporter_name: string | null; reporter_handle: string | null;
}
export interface AbuseReport {
  id: string; target_type: string; reason: string; body: string | null; status: string;
  created_at: string; reporter_handle: string | null; target_handle: string | null;
}

export async function submitBugReport(body: string): Promise<string> {
  const { data, error } = await supabase.rpc('submit_bug_report', {
    p_body: body,
    p_page: typeof location !== 'undefined' ? location.pathname : null,
    p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
  });
  if (error) throw error;
  return data as string;
}

export async function adminListBugReports(status: string | null = null): Promise<BugReport[]> {
  const { data, error } = await supabase.rpc('admin_list_bug_reports', { p_status: status });
  if (error) throw error;
  return (data as BugReport[]) ?? [];
}
export async function adminUpdateBugStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase.rpc('admin_update_bug_status', { p_id: id, p_status: status });
  if (error) throw error;
}
export async function adminListAbuseReports(limit = 50): Promise<AbuseReport[]> {
  const { data, error } = await supabase.rpc('admin_list_abuse_reports', { p_limit: limit });
  if (error) throw error;
  return (data as AbuseReport[]) ?? [];
}
