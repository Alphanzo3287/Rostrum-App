# First Run — standing up The Rostrum end to end

The goal of this pass is not new features. It's to take one debate through its whole life against
real infrastructure and find what's actually broken. Budget ~45 minutes.

You'll touch three accounts: **Supabase** (data/auth/storage), **LiveKit Cloud** (A/V), and the
**Netlify CLI** (to run the app + serverless functions together locally). Recording/egress and YouTube
are optional and intentionally skipped for the first smoke test.

---

## 1. Supabase project

1. Create a project at supabase.com. Note the project ref.
2. **Project Settings → API** — copy three values for later: the **Project URL**, the **anon public**
   key, and the **service_role** key (secret — server-only).
3. **Apply the schema, in order.** Easiest is the CLI from the repo root:
   ```bash
   supabase link --project-ref YOUR-REF
   supabase db push          # applies migrations 0001 → 0006 in order
   ```
   Or, without the CLI: open **SQL Editor** and paste each file in order — `0001_schema.sql`,
   `0002_functions.sql`, `0003_rls.sql`, `0004_slides.sql`, `0005_segments_state.sql`,
   `0006_broadcast_secrets.sql` — running each before the next.
4. **Seed the catalogs.** `db push` does **not** run `seed.sql` on a remote project. Paste
   `supabase/seed.sql` into the SQL Editor and run it, or the Store and achievements will be empty
   (the app handles empty gracefully, but you want data to test against).
5. **Turn off email confirmation for testing.** Auth → Providers → Email → disable **Confirm email**.
   The app expects a session immediately after sign-up (that's what drives onboarding); with
   confirmation on, sign-up returns no session and the flow stalls.

What `0003` already did for you, so you don't have to: created the public **avatars** and
**thumbnails** storage buckets, and added `votes / participants / questions / results / gifts / debates`
to the **realtime** publication. You can verify under Database → Replication and Storage.

---

## 2. LiveKit Cloud project

1. Create a project at cloud.livekit.io.
2. From the project's **Settings / Keys**, copy three values: the **WebSocket URL**
   (`wss://your-project.livekit.cloud`), an **API Key**, and its **API Secret**.
3. That's all you need for the smoke test. The client never sees these — the `livekit-token`
   function signs a token server-side and hands the URL + token to the browser.

(Egress recording needs the S3 vars and a deployed webhook; leave both for later. `goLive` wraps
recording in try/catch and YouTube returns "skipped" when no key is set, so the live debate runs fine
without them — you just won't get a downloadable MP4 yet.)

---

## 3. Environment

Copy `.env.example` to `.env` and fill it. Which var feeds which side:

| Variable | Value | Used by |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase Project URL | browser (client) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key | browser (client) |
| `SUPABASE_URL` | same Project URL | Netlify functions |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key | Netlify functions |
| `LIVEKIT_URL` | `wss://…livekit.cloud` | Netlify functions (returned to client) |
| `LIVEKIT_API_KEY` | LiveKit API key | Netlify functions |
| `LIVEKIT_API_SECRET` | LiveKit API secret | Netlify functions |
| `S3_*` | leave blank for now | recording (optional) |

The `VITE_`-prefixed vars are the only ones shipped to the browser. Everything else stays server-side
in the functions — the service-role key and LiveKit secret must never get a `VITE_` prefix.

---

## 4. Run it

```bash
npm install
npm install -g netlify-cli      # one time
netlify dev                     # serves the Vite app AND the functions on one origin
```

**Use `netlify dev`, not `npm run dev`.** The chamber fetches its LiveKit token from
`/.netlify/functions/livekit-token`; plain `vite` doesn't serve that path, so the chamber would fail to
connect. `netlify dev` runs both and loads `.env` automatically. It'll open on something like
`http://localhost:8888`.

---

## 5. The two-browser smoke test

Open the app in a normal window (User A) and an incognito window (User B). Walk the lifecycle and watch
the specific thing at each step — that's where the real bugs surface.

1. **A signs up.** → lands on onboarding.
   *Watch:* a row appears in `profiles` (the `handle_new_user` trigger). If sign-up hangs or no
   onboarding → email confirmation is still on (step 1.5).
2. **A completes onboarding** (photo, name, topics). → lands on the lobby.
   *Watch:* the file lands in the **avatars** bucket; the `profiles` row gets bio/topics. A 403 on
   upload means the storage policy/uid-path is off.
3. **A hosts a debate** (Host → wizard → Create). → lands in the chamber, Assembly phase.
   *Watch:* a `debates` row, `status = 'assembly'`, `livekit_room` set, thumbnail in **thumbnails**.
4. **B signs up, opens the same `/debate/:id` URL.**
   *Watch:* both names show in the Assembly roster. If B can't connect, check the `netlify dev` logs
   for the token function and re-check `LIVEKIT_URL/KEY/SECRET`.
5. **A clicks "Begin debate · go live."**
   *Watch (the big one):* `status` flips to live and **B's screen updates on its own**; the segment
   clock starts and **counts down on both screens**. If B's screen is static, realtime isn't reaching
   the client — verify the tables are in the publication and Realtime is enabled.
6. **Segment mics.** A toggles mic (allowed). Advance to the next segment.
   *Watch:* the speaking side changes and the mic button enables/disables itself as permission flips
   (`ParticipantPermissionsChanged`). An audience member's mic stays inert.
7. **B votes Proposition.**
   *Watch:* the poll bars move on **both** screens (`subscribeTally`). A second tap does nothing
   (one vote per person, enforced in `cast_vote`).
8. **B asks a question; A approves it** in the Q&A tab.
9. **A clicks "End event."**
   *Watch:* `finalize_debate` writes a `debate_results` row and updates `profiles` points/wins; both
   windows route to `/debate/:id/results`. (Download MP4 stays "processing" until egress is configured —
   expected.)
10. **Results → Back to lobby.**

If all ten pass, the core product works and Stripe/deck-conversion are safe to build on top.

---

## 6. Troubleshooting map

| Symptom | Likely cause | Fix |
|---|---|---|
| Sign-up never reaches onboarding | email confirmation on | Auth → Email → disable Confirm email |
| Onboarding avatar upload 403 | storage policy / wrong uid folder | confirm `0003` ran; path is `${uid}/…` |
| Chamber stuck "connecting", token 401/500 | functions not running or bad keys | use `netlify dev`; check `LIVEKIT_*`, service-role key |
| B's clock/poll/status never updates | realtime not delivered | Database → Replication: confirm publication + Realtime on |
| Vote/create/join returns empty or errors | an RLS policy too strict | check the table's policy against the failing role |
| Store is empty | `seed.sql` not run on remote | paste `seed.sql` in SQL Editor |
| Download MP4 never appears | egress/webhook not set up | expected for now — wire S3 + the webhook later |

---

## After a green run

In priority order: **Stripe** for paid entry + gifts (the `transactions` table and
`is_paid`/`price_cents` already exist), then the **deck-conversion** job (PPTX/PDF/Slides → PNG before
`uploadDeck`), then **egress + the LiveKit webhook** so recordings and live viewer counts populate.
See `WIRING.md` for the full remaining list.
