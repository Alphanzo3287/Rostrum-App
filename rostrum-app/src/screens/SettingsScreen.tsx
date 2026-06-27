// =====================================================================
// The Rostrum · src/screens/SettingsScreen.tsx
// Account settings. Currently: YouTube connection (connect once, stream
// automatically on every debate). More settings can be added here over time.
// =====================================================================
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getYouTubeConnection, connectYouTube, disconnectYouTube, type YouTubeConnection } from '../lib/youtube';
import { C, ui, display, solidGold } from '../lib/theme';
import { Scroll, ghostBtn } from '../components/ui';

export function SettingsScreen({ onBack }: { onBack?: () => void }) {
  const [params, setParams] = useSearchParams();
  const [yt, setYt]         = useState<YouTubeConnection | null>(null);
  const [busy, setBusy]     = useState(false);
  const [banner, setBanner] = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    getYouTubeConnection().then(setYt).catch(() => {});
    // Handle redirect back from Google OAuth
    const ytParam = params.get('yt');
    if (ytParam === 'connected') {
      setBanner({ msg: 'YouTube connected! You can now stream directly from your debates.', ok: true });
      getYouTubeConnection().then(setYt).catch(() => {});
      params.delete('yt'); setParams(params, { replace: true });
    } else if (ytParam === 'error') {
      const reason = params.get('reason');
      const reasonText: Record<string, string> = {
        auth: 'Your session could not be verified. Try logging out and back in, then reconnect.',
        token: 'Google rejected the token exchange. The OAuth redirect URI may not match exactly.',
        state_decode: 'The security token was corrupted in transit.',
        db: 'Connected to Google, but saving the tokens failed.',
        access_denied: 'You declined the YouTube permission, or you are not added as a Test user in Google Cloud.',
        missing_credentials: 'The server is missing the Google client ID/secret. They need to be set in Netlify environment variables.',
      };
      const detail = reason ? (reasonText[reason] ?? `Reason: ${reason}`) : '';
      setBanner({ msg: `YouTube connection failed. ${detail}`, ok: false });
      params.delete('yt'); setParams(params, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleConnect() {
    setBusy(true);
    try { await connectYouTube(); }   // redirects browser — never returns
    catch (e: any) { setBanner({ msg: e?.message ?? 'Could not start connection', ok: false }); setBusy(false); }
  }

  async function handleDisconnect() {
    if (!window.confirm('Disconnect your YouTube account? You will need to reconnect to stream.')) return;
    setBusy(true);
    try {
      await disconnectYouTube();
      setYt({ connected: false, channel_id: null, channel_title: null });
      setBanner({ msg: 'YouTube account disconnected.', ok: true });
    } catch (e: any) {
      setBanner({ msg: e?.message ?? 'Could not disconnect', ok: false });
    } finally { setBusy(false); }
  }

  return (
    <Scroll title="Settings" onBack={onBack} maxWidth={680}>
      {banner && (
        <div style={{ padding:'12px 16px', borderRadius:8, marginBottom:20,
          background: banner.ok ? `${C.jade}22` : `${C.garnet}22`,
          border: `1px solid ${banner.ok ? C.jade : C.garnet}`,
          color: banner.ok ? C.jadeHi : C.garnetHi, fontFamily:ui, fontSize:13 }}>
          {banner.msg}
        </div>
      )}

      {/* ── YouTube integration ── */}
      <div style={{ padding:'20px 22px', borderRadius:12, border:`1px solid ${C.hair}`, background:C.panel, marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
          {/* YouTube logo */}
          <div style={{ width:36, height:36, borderRadius:8, background:'#ff0000',
            display:'flex', alignItems:'center', justifyContent:'center',
            flexShrink:0 }}>
            <span style={{ color:'#fff', fontSize:18, lineHeight:1 }}>▶</span>
          </div>
          <div>
            <div style={{ fontFamily:display, fontSize:17, fontWeight:700, color:C.ink }}>YouTube</div>
            <div style={{ fontFamily:ui, fontSize:12, color:C.faint, marginTop:2 }}>
              Connect once — stream automatically from every debate.
            </div>
          </div>
          {yt?.connected && (
            <div style={{ marginLeft:'auto', padding:'4px 10px', borderRadius:999,
              background:`${C.jade}22`, border:`1px solid ${C.jade}44`,
              fontFamily:ui, fontSize:11, fontWeight:700, color:C.jadeHi }}>
              Connected
            </div>
          )}
        </div>

        {!yt
          ? <div style={{ fontFamily:ui, fontSize:13, color:C.faint }}>Loading…</div>
          : yt.connected ? (
            <>
              <div style={{ fontFamily:ui, fontSize:13, color:C.dim, marginBottom:14 }}>
                Streaming as <strong style={{ color:C.ink }}>{yt.channel_title ?? yt.channel_id}</strong>.
                When you create a debate with YouTube enabled, The Rostrum automatically creates the broadcast
                on your channel — you just press go live.
              </div>
              <button onClick={handleDisconnect} disabled={busy} style={{ ...ghostBtn }}>
                {busy ? 'Disconnecting…' : 'Disconnect YouTube'}
              </button>
            </>
          ) : (
            <>
              <p style={{ fontFamily:ui, fontSize:13, color:C.dim, lineHeight:1.55, margin:'0 0 14px' }}>
                Connect your YouTube account to stream your debates live. The Rostrum will create the broadcast,
                set the title, description, and thumbnail, and start streaming automatically — just like StreamYard.
                You can also schedule future debates as YouTube live events.
              </p>
              <button onClick={handleConnect} disabled={busy} style={solidGold}>
                {busy ? 'Connecting…' : 'Connect YouTube account'}
              </button>
            </>
          )
        }
      </div>
    </Scroll>
  );
}
