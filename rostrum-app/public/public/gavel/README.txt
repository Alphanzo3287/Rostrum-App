GAVEL MASCOT ARTWORK
====================

Drop your transparent PNGs into THIS folder (public/gavel/) using these exact
filenames. Gavel picks them up automatically — no code changes needed. Until a
file exists, a clean branded fallback shows in its place, so partial sets are fine.

Required files
--------------
  gavel-avatar.png    Circular avatar. Used on the button, header, chat bubbles,
                      notifications. (Your purple-ringed avatar image is ideal.)
  gavel-idle.png      Default standing pose. Shown when Gavel is resting.
  gavel-thinking.png  Shown while Gavel is working (searching / reasoning).
  gavel-happy.png     Shown on a clear verdict (Supported / Refuted).
  gavel-unsure.png    Shown when evidence is thin (Contested / Unsupported).
  gavel-error.png     Shown if the AI service fails.
  gavel-wave.png      Friendly wave — used for onboarding / greetings.

Tips
----
  • Square, transparent PNGs (e.g. 512x512) look best; the app scales them down.
  • gavel-avatar.png should be a tight, centered crop (head + shoulders).
  • The other poses can be full-body; they render small beside messages.
  • To host the art elsewhere (Supabase Storage, R2, a CDN) instead of this
    folder, edit the GAVEL_ART paths in src/components/GavelMascot.tsx.

These files are served at /gavel/<filename> once deployed.
