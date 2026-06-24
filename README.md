# The Rostrum — Backend Skeleton

Phase 1 of the backend: **Supabase (Postgres + Auth + Storage + Realtime)**. This is the spine
everything else hangs on. Phase 2 (**LiveKit room service** for A/V, mic permissions, recording,
and YouTube egress) is scaffolded at the end of this doc and built next.

These files target your real app repo (React on Netlify, Vite or Next). The chat artifact stays as
the visual prototype; here we give its screens something real to talk to.

---

## What's here

```
rostrum-backend/
├─ supabase/
│  ├─ migrations/
│  │  ├─ 0001_schema.sql        tables, enums, indexes
│  │  ├─ 0002_functions.sql     triggers + RPCs (votes, ballots, finalize, counters)
│  │  └─ 0003_rls.sql           row-level security, storage buckets, realtime
│  └─ seed.sql                  achievements + perks catalog
├─ src/lib/
│  ├─ supabaseClient.ts         browser client
│  ├─ auth.tsx                  <AuthProvider> + useAuth() / useProfile()
│  ├─ api.ts                    typed data layer the screens call
│  └─ types.ts                  enums + row types (regenerate for the full set)
└─ .env.example
```

## Setup (≈10 minutes)

1. Create a project at supabase.com, then grab the URL + anon key (Project Settings → API).
2. Copy `.env.example` to `.env` and fill them in.
3. Run the migrations **in order**, then the seed. Either paste each file into the SQL Editor, or
   with the CLI:
   ```bash
   supabase db push          # applies supabase/migrations/*
   psql "$DATABASE_URL" -f supabase/seed.sql
   ```
4. Auth → Providers: enable **Email**. For local dev, turn **"Confirm email" off** so sign-up flows
   straight into onboarding. Add Google/Apple later for one-tap.
5. Install the client SDK in your app:
   ```bash
   npm i @supabase/supabase-js
   ```
6. (Optional but recommended) regenerate exact types:
   ```bash
   supabase gen types typescript --project-id <ref> > src/lib/types.ts
   ```

## How it maps to the prototype screens

| Screen / action            | Backend call |
|----------------------------|--------------|
| Auth (sign up)             | `signUp()` → trigger `handle_new_user` creates the profile |
| Onboard (photo, bio, links)| `completeOnboarding()` → upload avatar + `updateProfile` |
| Lobby tiles                | `listLiveDebates()` |
| Host a debate + thumbnail  | `createDebate()` → upload to `thumbnails` bucket, insert debate + segments |
| Enter a room               | `joinDebate()` → sets role + `can_publish` (audience = false) |
| Assembly → Live            | `setDebateStatus(id,'live')` (host only via RLS) |
| Audience Vote buttons      | `castVote()` (one per person, enforced) / `subscribeTally()` live |
| Judge scorecard            | `submitBallot()` (judges only) |
| End event → Results        | `finalizeDebate()` → winner, results, W/L + points awarded |
| Q&A                        | `askQuestion()` / `subscribeQuestions()` / host `setQuestionStatus()` |
| Gifts                      | `sendGift()` |
| Profile / record / wallet  | `getProfile()` |
| Follow                     | `follow()` / `unfollow()` |
| Leaderboard                | `topProfiles()` |
| Teams (create + roster)    | `createTeam()` / `addTeamMember()` / `setTeamRole()` / `removeTeamMember()` |
| Store                      | `redeemPerk()` |

## Security model (the important part)

- **RLS is on for every table.** Profiles, debates (public + unlisted), participants, results,
  and the leaderboard are world-readable; everything that mutates is owner/host/role gated.
- **House rules live in the database, not the client**, so a hacked frontend can't cheat:
  - `cast_vote` is one row per `(debate, voter)` — a second vote is a no-op.
  - `submit_ballot` rejects anyone who isn't a `judge` participant.
  - `finalize_debate` only runs for the host and is the *only* path that writes wins/losses/points.
  - `join_debate` sets `can_publish=false` for audience — this is what Phase 2 reads to deny mic.
- Team-admin checks go through a `security definer` helper (`is_team_admin`) to avoid RLS recursion.

---

## Phase 2 preview — LiveKit room service (next)

The single seam between this schema and live A/V is **`debate_participants.can_publish`**. The token
service reads it and grants media accordingly:

| Role       | canPublish (mic/cam) | canSubscribe | Notes |
|------------|----------------------|--------------|-------|
| host       | ✓                    | ✓            | also room admin (mute others) |
| moderator  | ✓                    | ✓            | may speak any segment |
| debater    | ✓ (gated by segment) | ✓            | server mutes off-turn |
| judge      | ✓ (Q&A only)         | ✓            | on the dais |
| audience   | ✗                    | ✓            | questions only |

Next file set will add a Netlify function `livekit-token.ts` that:
1. verifies the Supabase JWT, 2. looks up the caller's `debate_participants` row, 3. mints a LiveKit
`AccessToken` with `canPublish = row.can_publish`, and 4. for the host, returns admin grants plus the
**Egress** handle to start recording and the **RTMP simulcast to YouTube**.
