// =====================================================================
// DISCONTINUED. The Rostrum moved to a direct-payment ("Patreon") model:
// creators are paid in real cash straight to their own Stripe accounts,
// so there is no buying D-Bucks, no cashing out, and no buy-back. This
// endpoint is intentionally disabled so no money can move through the
// retired flows even if an old client calls it.
// =====================================================================
import type { Handler } from '@netlify/functions';

export const handler: Handler = async () => ({
  statusCode: 410,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ error: 'This feature has been discontinued.' }),
});
