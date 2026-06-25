# Phase 2 — LiveKit Room Service

This adds live audio/video to the chamber, with the mic/permission rules enforced on the server.
The seam is `debate_participants.can_publish` (set in Phase 1): the token function reads it, so a
hacked client still can't grab a mic it wasn't granted.

```
netlify/functions/
  livekit-token.ts     mint a join token; grants come from your participant row
  livekit-control.ts   host-only: mic gating, mute audience, recording, YouTube simulcast, remove
  livekit-webhook.ts   egress_ended -> recording_url; joins/leaves -> viewer_count
src/server/supabaseAdmin.ts   service-role client + JWT verification (server only)
src/lib/livekit.ts            client wrappers (getRoomToken, openMic/closeMic, startRecording, …)
src/lib/useRoom.tsx           React hook: connect + expose participants/tracks/mic-cam
src/components/VideoTile.tsx  renders a real track in the chamber tile (avatar fallback)
```

## Setup

1. Create a project at **LiveKit Cloud** (or self-host). Copy the **URL, API key, API secret**.
2. Fill the LiveKit + server-Supabase + S3 values in `.env`. The functions use the **service-role**
   key and run only on the server — never expose it to the browser.
3. Install SDKs:
   ```bash
   npm i livekit-client                 # app
   npm i -D @netlify/functions          # function types
   npm i livekit-server-sdk@^2          # functions (pin to v2)
   ```
4. In the LiveKit project settings, add a **webhook** pointing at
   `https://YOUR-SITE/.netlify/functions/livekit-webhook`.
5. Recording: either set the S3 vars, or on LiveKit Cloud enable built-in egress storage and remove
   the `S3Upload` block in `livekit-control.ts`.

## How the chamber wires up

Replace the prototype's mock pieces with these, in your real repo:

| Chamber action (prototype)            | LiveKit call |
|---------------------------------------|--------------|
| Enter the room                        | `useRoom(debateId)` → connects, returns `members` |
| Camera filmstrip / grid / speaker tile| render `<VideoTile member={m} active={m.isSpeaking}/>` from `members` |
| Audience "Mic off" (greyed)           | `useRoom` returns `canPublish=false`; `toggleMic` is a no-op for them |
| Debater mic toggle                    | `toggleMic()` (only works while the host has granted publish) |
| Host **Begin debate · go live**       | `setDebateStatus(id,'live')` + `startRecording(id)` + `startYouTube(id, key)` |
| Host **Next segment**                 | `applySegmentMics(id, debaters, activeSide)` — opens the speaking side, closes the rest |
| Host **Mute all**                     | `muteAudience(id)` |
| Host **End event**                    | `stopEgress(id, egressId)` → `finalizeDebate(id)` → Results screen |
| Results **Download MP4**              | `debate.recording_url` (filled by the webhook) |

### The "only the current speaker is live" rule

`applySegmentMics` is the heart of it. On each segment change the host opens `canPublish` for the
debaters on the active side and closes it for everyone else; moderators and the host keep their own
seats. Because permission changes come from the server (`updateParticipant`), the opposing side
*cannot* unmute during your time — the client never had the grant. `useRoom` listens for
`ParticipantPermissionsChanged`, so each debater's mic button enables/disables itself automatically.

## Order of operations recap

Phase 1 (done): identity, profiles, debates, votes, ballots, results, teams, wallet — all RLS-guarded.
Phase 2 (this): real-time A/V + recording + simulcast, gated by the same `can_publish` flag.
Next: wire the prototype screens to `api.ts` + `useRoom` in your repo, then ship Stripe for paid
entry/gifts (the `transactions` table and `is_paid`/`price_cents` columns are already there).
