// =====================================================================
// The Rostrum · src/lib/communities.ts
// Topic-based communities: browse, create, join, and post.
// =====================================================================
import { supabase } from './supabaseClient';

export interface Community {
  id: string;
  name: string;
  description: string | null;
  banner_url: string | null;
  topics: string[];
  created_by: string;
  member_count: number;
  created_at: string;
}

export interface CommunityPost {
  id: string;
  community_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author?: { display_name: string; handle: string; avatar_url: string | null };
}

export interface CommunityMember {
  user_id: string;
  role: string;
  joined_at: string;
  profile?: { display_name: string; handle: string; avatar_url: string | null };
}

/** All communities, most-populated first. */
export async function listCommunities(): Promise<Community[]> {
  const { data, error } = await supabase.from('communities').select('*')
    .order('member_count', { ascending: false }).order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  return (data ?? []) as Community[];
}

/** Communities the current user belongs to. */
export async function myCommunities(): Promise<Community[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase.from('community_members')
    .select('communities(*)').eq('user_id', user.id);
  if (error) throw error;
  return (data ?? []).map((r: any) => r.communities).filter(Boolean) as Community[];
}

export async function getCommunity(id: string): Promise<Community | null> {
  const { data, error } = await supabase.from('communities').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as Community) ?? null;
}

/** Is the current user a member of this community? */
export async function isMember(communityId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.from('community_members')
    .select('user_id').eq('community_id', communityId).eq('user_id', user.id).maybeSingle();
  return !!data;
}

export async function communityMembers(communityId: string, limit = 60): Promise<CommunityMember[]> {
  const { data, error } = await supabase.from('community_members')
    .select('user_id, role, joined_at, profile:profiles(display_name, handle, avatar_url)')
    .eq('community_id', communityId).order('joined_at', { ascending: true }).limit(limit);
  if (error) throw error;
  return (data ?? []) as any as CommunityMember[];
}

export async function communityFeed(communityId: string): Promise<CommunityPost[]> {
  const { data, error } = await supabase.from('community_posts')
    .select('*, author:profiles(display_name, handle, avatar_url)')
    .eq('community_id', communityId).order('created_at', { ascending: false }).limit(80);
  if (error) throw error;
  return (data ?? []) as any as CommunityPost[];
}

export async function createCommunity(input: { name: string; description?: string; topics?: string[] }): Promise<Community> {
  const { data, error } = await supabase.rpc('create_community', {
    p_name: input.name, p_description: input.description ?? null, p_topics: input.topics ?? [],
  });
  if (error) throw error;
  return data as Community;
}

export const joinCommunity = (id: string) => supabase.rpc('join_community', { p_community: id }).then(r => { if (r.error) throw r.error; });
export const leaveCommunity = (id: string) => supabase.rpc('leave_community', { p_community: id }).then(r => { if (r.error) throw r.error; });
export const deleteCommunityPost = (id: string) => supabase.rpc('delete_community_post', { p_post: id }).then(r => { if (r.error) throw r.error; });

export async function postToCommunity(communityId: string, body: string): Promise<CommunityPost> {
  const { data, error } = await supabase.rpc('create_community_post', { p_community: communityId, p_body: body });
  if (error) throw error;
  return data as CommunityPost;
}
