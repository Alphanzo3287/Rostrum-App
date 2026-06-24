-- =====================================================================
-- The Rostrum · 0001_schema.sql
-- Run first. Then 0002_functions.sql, 0003_rls.sql, seed.sql
-- =====================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "citext";      -- case-insensitive handles

-- ---------- enums ----------
create type debate_format     as enum ('oxford','cross_exam','lincoln_douglas','town_hall','freestyle');
create type debate_status     as enum ('draft','assembly','live','ended','cancelled');
create type debate_visibility as enum ('public','unlisted');
create type debate_role       as enum ('host','moderator','debater','judge','audience');
create type debate_side       as enum ('prop','opp');
create type team_role         as enum ('owner','admin','member');
create type tx_type           as enum ('entry','gift','donation','perk','payout','grant');
create type question_status   as enum ('queued','approved','answered','dismissed');

-- ---------- profiles (1:1 with auth.users) ----------
create table profiles (
  id              uuid primary key references auth.users on delete cascade,
  handle          citext unique not null,
  display_name    text not null,
  avatar_url      text,
  bio             text,
  socials         jsonb not null default '{}',   -- {instagram,x,youtube,tiktok,website}
  topics          text[] not null default '{}',
  rank            text not null default 'Novice',
  level           int  not null default 1,
  points          int  not null default 0,
  virtual_cash    int  not null default 0,
  wins            int  not null default 0,
  losses          int  not null default 0,
  follower_count  int  not null default 0,
  following_count int  not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------- debates ----------
create table debates (
  id                uuid primary key default gen_random_uuid(),
  host_id           uuid not null references profiles(id) on delete cascade,
  motion            text not null,
  format            debate_format not null default 'oxford',
  status            debate_status not null default 'draft',
  visibility        debate_visibility not null default 'public',
  thumbnail_url     text,
  tag               text,
  livekit_room      text unique,
  voters_enabled    boolean not null default true,
  gifts_enabled     boolean not null default true,
  recording_enabled boolean not null default true,
  is_paid           boolean not null default false,
  price_cents       int not null default 0,
  viewer_count      int not null default 0,
  scheduled_at      timestamptz,
  started_at        timestamptz,
  ended_at          timestamptz,
  recording_url     text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index debates_live_idx on debates (status) where status in ('assembly','live');
create index debates_host_idx on debates (host_id);

-- ---------- run of show ----------
create table debate_segments (
  id            uuid primary key default gen_random_uuid(),
  debate_id     uuid not null references debates(id) on delete cascade,
  idx           int not null,
  label         text not null,
  side          debate_side,                 -- null = moderated / both
  duration_secs int not null check (duration_secs > 0),
  unique (debate_id, idx)
);

-- ---------- participants (seat + media rights) ----------
create table debate_participants (
  debate_id   uuid not null references debates(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  role        debate_role not null default 'audience',
  side        debate_side,
  can_publish boolean not null default false, -- mic/cam rights; audience = false
  paid        boolean not null default false,
  joined_at   timestamptz not null default now(),
  primary key (debate_id, user_id)
);
create index participants_user_idx on debate_participants (user_id);

-- ---------- votes (one per person per debate) ----------
create table votes (
  debate_id  uuid not null references debates(id) on delete cascade,
  voter_id   uuid not null references profiles(id) on delete cascade,
  side       debate_side not null,
  created_at timestamptz not null default now(),
  primary key (debate_id, voter_id)
);

-- ---------- judge ballots ----------
create table ballots (
  id           uuid primary key default gen_random_uuid(),
  debate_id    uuid not null references debates(id) on delete cascade,
  judge_id     uuid not null references profiles(id) on delete cascade,
  scores       jsonb not null,               -- { "prop": {argument:7,...}, "opp": {...} }
  prop_total   int not null,
  opp_total    int not null,
  submitted_at timestamptz not null default now(),
  unique (debate_id, judge_id)
);

-- ---------- results ----------
create table debate_results (
  debate_id        uuid primary key references debates(id) on delete cascade,
  winner_side      debate_side,              -- null = tie
  prop_judge_total int not null default 0,
  opp_judge_total  int not null default 0,
  prop_audience    int not null default 0,
  opp_audience     int not null default 0,
  decided_at       timestamptz not null default now()
);

-- ---------- Q&A ----------
create table questions (
  id         uuid primary key default gen_random_uuid(),
  debate_id  uuid not null references debates(id) on delete cascade,
  asker_id   uuid not null references profiles(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 500),
  status     question_status not null default 'queued',
  created_at timestamptz not null default now()
);
create index questions_debate_idx on questions (debate_id, status);

-- ---------- gifts / donations ----------
create table gifts (
  id           uuid primary key default gen_random_uuid(),
  debate_id    uuid not null references debates(id) on delete cascade,
  from_id      uuid not null references profiles(id) on delete cascade,
  to_id        uuid references profiles(id) on delete set null,
  kind         text not null,
  amount_cents int not null check (amount_cents >= 0),
  created_at   timestamptz not null default now()
);

-- ---------- teams ----------
create table teams (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  tag            text not null,
  owner_id       uuid not null references profiles(id) on delete cascade,
  color          text not null default '#2E9E86',
  crest_url      text,
  wins           int not null default 0,
  losses         int not null default 0,
  member_count   int not null default 0,   -- maintained by trigger (owner row brings it to 1)
  follower_count int not null default 0,
  created_at     timestamptz not null default now()
);
create table team_members (
  team_id  uuid not null references teams(id) on delete cascade,
  user_id  uuid not null references profiles(id) on delete cascade,
  role     team_role not null default 'member',
  added_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

-- ---------- social graph ----------
create table follows (
  follower_id  uuid not null references profiles(id) on delete cascade,
  following_id uuid not null references profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

-- ---------- wallet / ledger ----------
create table transactions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references profiles(id) on delete cascade,
  type           tx_type not null,
  amount_cents   int not null default 0,    -- real money (+credit / -debit)
  points_delta   int not null default 0,
  cash_delta     int not null default 0,    -- virtual cash
  debate_id      uuid references debates(id) on delete set null,
  counterparty_id uuid references profiles(id) on delete set null,
  stripe_ref     text,
  created_at     timestamptz not null default now()
);

-- ---------- achievements + perks catalog ----------
create table achievements (
  id          text primary key,
  name        text not null,
  description text not null,
  icon        text not null
);
create table user_achievements (
  user_id        uuid not null references profiles(id) on delete cascade,
  achievement_id text not null references achievements(id) on delete cascade,
  earned_at      timestamptz not null default now(),
  primary key (user_id, achievement_id)
);
create table perks (
  id          text primary key,
  name        text not null,
  description text,
  cost        int not null,
  icon        text not null
);
create table user_perks (
  user_id     uuid not null references profiles(id) on delete cascade,
  perk_id     text not null references perks(id) on delete cascade,
  acquired_at timestamptz not null default now(),
  primary key (user_id, perk_id)
);
