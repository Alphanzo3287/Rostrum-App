// =====================================================================
// The Rostrum · netlify/functions/youtube-auth.ts
// GET ?action=connect&token=<supabase_jwt>  → redirect to Google OAuth
// GET ?code=<auth_code>&state=<encoded_jwt> → exchange code, store tokens
// =====================================================================
import type { Handler } from '@netlify/functions';
import { supabaseAdmin, userFromToken } from '../../src/server/supabaseAdmin';

const CLIENT_ID    = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const SITE         = process.env.URL || 'https://rostrums.site';
const REDIRECT_URI = `${SITE}/.netlify/functions/youtube-auth`;
const SCOPES       = [
  'https://www.googleapis.com/auth/youtube.force-ssl',
  'https://www.googleapis.com/auth/youtube.upload',
].join(' ');

export const handler: Handler = async (event) => {
  const { action, code, state, token, error: oauthError } = event.queryStringParameters ?? {};

  // ── Google returned an error (user denied, etc.) ─────────────────────
  if (oauthError) {
    console.error('Google OAuth error:', oauthError);
    return redirect(`${SITE}/settings?yt=error&reason=${encodeURIComponent(oauthError)}`);
  }

  // ── Step 1: browser hits ?action=connect&token=<jwt> ─────────────────
  if (action === 'connect') {
    const user = await userFromToken(token ?? '');
    if (!user) return redirect(`${SITE}/settings?yt=error&reason=auth`);

    // Base64-encode the JWT so it survives the OAuth round-trip cleanly.
    const encodedToken = Buffer.from(token ?? '').toString('base64url');

    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', CLIENT_ID);
    url.searchParams.set('redirect_uri', REDIRECT_URI);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', SCOPES);
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');   // always get refresh_token
    url.searchParams.set('state', encodedToken); // safe base64url, no special chars
    return redirect(url.toString());
  }

  // ── Step 2: Google redirects back with ?code=...&state=... ───────────
  if (code && state) {
    // Decode the JWT we carried through as state
    let rawToken: string;
    try {
      rawToken = Buffer.from(state, 'base64url').toString('utf8');
    } catch {
      return redirect(`${SITE}/settings?yt=error&reason=state_decode`);
    }

    const user = await userFromToken(rawToken);
    if (!user) return redirect(`${SITE}/settings?yt=error&reason=auth`);

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri:  REDIRECT_URI,
        grant_type:    'authorization_code',
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokens.access_token) {
      console.error('Token exchange failed:', tokens);
      return redirect(`${SITE}/settings?yt=error&reason=token`);
    }

    // Fetch the user's YouTube channel info
    const chanRes = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );
    const chanData = await chanRes.json();
    const channel  = chanData.items?.[0];

    const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();
    const { error: dbErr } = await supabaseAdmin.from('youtube_tokens').upsert({
      user_id:       user.id,
      access_token:  tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at:    expiresAt,
      channel_id:    channel?.id ?? null,
      channel_title: channel?.snippet?.title ?? null,
      updated_at:    new Date().toISOString(),
    }, { onConflict: 'user_id' });

    if (dbErr) {
      console.error('DB upsert failed:', dbErr);
      return redirect(`${SITE}/settings?yt=error&reason=db`);
    }

    return redirect(`${SITE}/settings?yt=connected`);
  }

  return { statusCode: 400, body: 'bad request' };
};

const redirect = (url: string) => ({
  statusCode: 302,
  headers: { Location: url },
  body: '',
});
