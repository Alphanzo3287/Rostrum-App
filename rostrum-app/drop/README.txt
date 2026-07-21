ROSTRUM — DROP-IN FIX · Lecture-mode Prop/Opp panels
=====================================================

WHAT THIS FIXES
  In Lecture mode (and Speaker's Corner), the Proposition / Opposition side
  panels were showing on the broadcast/record view. A lecture is one speaker
  + slide deck — no sides. This hides that rail in both the live view and the
  pre-show "assembly" view, and lets the stage go full-width.

DROP-IN PATH (mirrors your VS Code tree exactly)
  rostrum-app/src/screens/BroadcastScreen.tsx

  This zip mirrors that path, so you can drop the rostrum-app/ folder straight
  in and "Replace All" — same as Batch C2.

VERIFIED
  Typechecked with real tsc against your repo — zero new errors introduced.
  (One pre-existing error on line 75 was already on main; untouched here.)

TEST AFTER DEPLOY
  Start a fresh Lecture debate -> the right-hand Prop/Opp rail should be gone
  and the deck/camera fills the stage.
