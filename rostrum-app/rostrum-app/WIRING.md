# Wiring Pass — connecting the prototype to the backend

Swapping the prototype's mock state for `api.ts`, `auth.tsx`, and `useRoom`, screen by screen.
These files run in your real repo (Vite/Next + Netlify), not the chat preview.

## Done this pass
- **App.tsx** — `AuthProvider` + session-gated routing (Auth → Onboard → Lobby).
- **AuthScreen.tsx** — sign up / log in via `useAuth`.
- **OnboardScreen.tsx** — `completeOnboarding` (avatar upload + profile fields).
- **LobbyScreen.tsx** — `listLiveDebates()`, real thumbnails + host.
- **SlideStage.tsx** — presenter-driven deck, synced via `subscribeSlide` (+ `0004_slides.sql`).
- **ChamberScreen.tsx** — the big one, fully wired:
  - cameras via `useRoom` + `VideoTile`; synced deck via `SlideStage`
  - authoritative segment clock via `useDebate` (+ `0005_segments_state.sql`)
  - poll / Q&A / scorecard via `ContextRail`
  - role dock via `RoleDock` — host go-live (record + simulcast), pause/next-segment with
    mic-gating, mute-all, end → finalize; debater mic/cam/share-slides; judge ballot; audience vote/ask
- **useDebate.tsx**, **ContextRail.tsx**, **RoleDock.tsx** — supporting the chamber.
- **CreateDebateScreen.tsx** — `createDebate()` (thumbnail + LiveKit room), per-segment side + timers,
  optional deck upload, and a private YouTube key (`setBroadcastKey` + `0006_broadcast_secrets.sql`).
- **ResultsScreen.tsx** — `getResults()` verdict + judge/audience tallies + **Download MP4** from
  `recording_url` + share links.
- **ProfileScreen.tsx** — own profile or by handle: record, points, followers, achievements, wallet,
  socials, follow/unfollow (`getProfile`, `getAchievements`, `amFollowing`, `follow`/`unfollow`).
- **LeaderboardScreen.tsx** — people by points (`topProfiles`) + teams by wins (`listTeams`).
- **TeamsScreen.tsx** — list + create + roster admin (`createTeam`, `listTeamMembers`, add by @handle,
  `setTeamRole`, `removeTeamMember`).
- **StoreScreen.tsx** — perks catalog + wallet + atomic `redeemPerk` (`listPerks`, `myPerkIds`).
- **components/ui.tsx** — shared Avatar / Stat / Section / Scroll for the screens above.
- **Routing** — `react-router` with real URLs. `App.tsx` gates auth→onboard→app, then routes:
  `/` lobby, `/host`, `/debate/:id` (chamber), `/debate/:id/results`, `/u/:handle` + `/me` profile,
  `/leaderboard`, `/teams`, `/store`. Browse routes share the `NavBar` shell; chamber/create/results
  are full-bleed. Entry plumbing added: `package.json`, `index.html`, `main.tsx`, `vite.config.ts`,
  `tsconfig.json`, `netlify.toml`, `public/_redirects` (SPA fallback).

The whole app now navigates end to end. `npm install && npm run dev` runs it once the `.env` is filled.

## Next (in priority order)
1. **Stripe** — paid entry + gifts (the `transactions` table + `is_paid`/`price_cents` already exist).
   Checkout for paid debates before `joinDebate`; gift flow on `sendGift`.
2. **Deck conversion** — a small serverless job to rasterize PPTX/PDF/Google Slides → PNG before `uploadDeck`.
3. **Polish** — replace the onboarding heuristic with a real `onboarded` flag; add a 404/empty states pass.

## Chamber integration recipe

```tsx
const { members, canPublish, micOn, camOn, toggleMic, toggleCam } = useRoom(debate.id);

// camera tiles — replace FilmTile/SpeakerTile with the real one
{members.map(m => <VideoTile key={m.identity} member={m} active={m.isSpeaking} />)}

// the presentation panel
<SlideStage debateId={debate.id} canPresent={canPublish} dim={layout === 'spotlight'} />

// audience Vote buttons -> live poll
const tally = await castVote(debate.id, side);     // one per person, server-enforced
useEffect(() => subscribeTally(debate.id, setTally), [debate.id]);

// host: "Begin debate · go live"
await setDebateStatus(debate.id, 'live');
await startRecording(debate.id);
await startYouTube(debate.id, youtubeStreamKey);

// host: "Next segment" -> opens the speaking side's mics, closes the rest
await applySegmentMics(debate.id, debaters, nextSeg.side);

// judge scorecard -> submit
await submitBallot(debate.id, { prop, opp });

// host: "End event"
await stopEgress(debate.id, egressId);
await finalizeDebate(debate.id);                   // -> Results
```

### Mic button states (no extra code)
`useRoom` already returns `canPublish`, and `toggleMic` is a no-op when false. So the audience mic is
inert by construction, and a debater's mic enables/disables itself as the host advances segments
(the hook listens for `ParticipantPermissionsChanged`). The "only the current speaker is live" rule
needs no client logic — it's the server permission flipping.

### Slide control
The presenter (any on-mic participant) drives `SlideStage`; everyone else follows. Audience members
get no arrows, and even a forged `set_slide` call is rejected server-side unless the caller has
`can_publish`. Forward/back works via the on-screen arrows **and** the ← / → keys.
```
