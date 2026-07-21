ROSTRUM — DROP-IN FIX  ·  Lecture-mode Prop/Opp panels
=======================================================

WHAT THIS FIXES
  In Lecture mode (and Speaker's Corner), the Proposition / Opposition
  side panels were showing on the broadcast/record view. They shouldn't —
  a lecture is one speaker + slide deck, no sides. This hides that rail in
  both the live view and the pre-show "assembly" view, and lets the stage
  go full-width.

HOW TO DEPLOY (same as always)
  Drop the src/ folder into github.dev on `main`, choose "Replace All".
  The single changed file is:
      rostrum-app/src/screens/BroadcastScreen.tsx

  NOTE ON PATH: your source lives under `rostrum-app/` in the repo, but
  this zip mirrors from `src/` because that's what you drag into the
  rostrum-app/ base dir in github.dev. If your drag target is the repo
  ROOT, put the file at:  rostrum-app/src/screens/BroadcastScreen.tsx

VERIFIED
  Typechecked with real tsc against your repo — zero new errors introduced.
  (One pre-existing error on line 75 was already on `main`; untouched here.)

TEST AFTER DEPLOY
  Start a fresh Lecture debate → the right-hand Prop/Opp rail should be gone
  and the deck/camera fills the stage.

NOT IN THIS DROP
  The "recording not in library" issue is a DATA/CONFIG problem, not a code
  bug — waiting on your two Supabase query results (webhook_log + the debate
  row). No file to ship for that yet.
