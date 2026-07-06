// =====================================================================
// The Rostrum · types.ts
// Hand-written subset for the skeleton. For the exact, full schema run:
//   supabase gen types typescript --project-id <ref> > src/lib/types.ts
// =====================================================================

export type DebateFormat = 'oxford' | 'cross_exam' | 'lincoln_douglas' | 'town_hall' | 'freestyle' | 'lecture' | 'legacy' | 'speakers_corner';
export type DebateStatus = 'draft' | 'scheduled' | 'assembly' | 'live' | 'ended' | 'cancelled';
export type Visibility   = 'public' | 'unlisted' | 'private';
export type DebateRole   = 'host' | 'moderator' | 'debater' | 'judge' | 'audience';
export type Side         = 'prop' | 'opp';
export type TeamRole     = 'owner' | 'admin' | 'member';
export type QuestionStatus = 'queued' | 'approved' | 'answered' | 'dismissed';

export interface Socials {
  instagram?: string; x?: string; youtube?: string; tiktok?: string; website?: string;
}

export interface Profile {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  socials: Socials;
  topics: string[];
  rank: string;
  level: number;
  points: number;
  virtual_cash: number;
  wins: number;
  losses: number;
  follower_count: number;
  following_count: number;
  created_at: string;
  onboarded_at?: string | null;
  terms_accepted_at?: string | null;
  pro_until?: string | null;
  profile_accent?: string | null;
}

export interface Debate {
  id: string;
  host_id: string;
  motion: string;
  format: DebateFormat;
  status: DebateStatus;
  visibility: Visibility;
  thumbnail_url: string | null;
  tag: string | null;
  livekit_room: string | null;
  voters_enabled: boolean;
  gifts_enabled: boolean;
  recording_enabled: boolean;
  is_paid: boolean;
  price_cents: number;
  viewer_count: number;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  recording_url: string | null;
  created_at: string;
  // deck + authoritative segment clock (0004 / 0005)
  deck_urls: string[];
  current_slide: number;
  current_segment: number | null;
  segment_ends_at: string | null;
  segment_paused_secs: number | null;
  // joined for convenience
  host?: Pick<Profile, 'display_name' | 'handle' | 'avatar_url'>;
  // winner system
  win_mode?: string;
  poll_open?: boolean;
  winner_announced?: boolean;
  // capacity controls (Legacy / Speakers' Corner)
  max_stage_seats: number | null;
  max_moderators: number | null;
}

export interface Segment { id: string; debate_id: string; idx: number; label: string; side: Side | null; duration_secs: number; }
export interface Participant { debate_id: string; user_id: string; role: DebateRole; side: Side | null; can_publish: boolean; paid: boolean; }
export interface Tally { prop: number; opp: number; }
export interface DebateResult {
  debate_id: string; winner_side: Side | null;
  prop_judge_total: number; opp_judge_total: number;
  prop_audience: number; opp_audience: number; decided_at: string;
  peoples_choice_side?: Side | null;
}
export interface Question { id: string; debate_id: string; asker_id: string; body: string; status: QuestionStatus; created_at: string; }
export interface Team {
  id: string; name: string; tag: string; owner_id: string; color: string; crest_url: string | null;
  wins: number; losses: number; member_count: number; follower_count: number;
}
export interface TeamMember { team_id: string; user_id: string; role: TeamRole; }
export interface Perk { id: string; name: string; description: string | null; cost: number; icon: string; }
export interface Achievement { id: string; name: string; description: string; icon: string; }

// Minimal Database shape so `createClient<Database>` is typed where it matters.
export interface Database {
  public: {
    Tables: {
      profiles:            { Row: Profile;  Insert: Partial<Profile>;     Update: Partial<Profile> };
      debates:             { Row: Debate;   Insert: Partial<Debate>;      Update: Partial<Debate> };
      debate_segments:     { Row: Segment;  Insert: Partial<Segment>;     Update: Partial<Segment> };
      debate_participants: { Row: Participant; Insert: Partial<Participant>; Update: Partial<Participant> };
      questions:           { Row: Question; Insert: Partial<Question>;     Update: Partial<Question> };
      teams:               { Row: Team;     Insert: Partial<Team>;        Update: Partial<Team> };
      team_members:        { Row: TeamMember; Insert: Partial<TeamMember>; Update: Partial<TeamMember> };
      perks:               { Row: Perk;     Insert: Partial<Perk>;        Update: Partial<Perk> };
      achievements:        { Row: Achievement; Insert: Partial<Achievement>; Update: Partial<Achievement> };
    };
    Functions: Record<string, unknown>;
  };
}
