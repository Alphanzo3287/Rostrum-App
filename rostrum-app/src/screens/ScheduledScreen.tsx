// =====================================================================
// The Rostrum · src/screens/ScheduledScreen.tsx
// What you see when you open a debate that hasn't started yet: a live
// countdown, RSVP, share, and (for the host) a button to open the doors.
// When the host starts it, everyone here advances into the chamber.
// =====================================================================
import { useEffect, useState } from 'react';
import { getDebate, getRsvp, setRsvp, clearRsvp, startDebate, subscribeDebate, rescheduleDebate, type RsvpInfo } from '../lib/api';
import { rescheduleYouTubeBroadcast } from '../lib/youtube';
import type { Debate } from '../lib/types';
import { useAuth } from '../lib/auth';
import { C, ui, display, mono, solidGold, a } from '../lib/theme';
import { Avatar } from '../components/ui';
import { ShareButton } from '../components/ShareSheet';

const FMT: Record<string, string> = {
  oxford:'Oxford · Formal', cross_exam:'Cross-Examination', lincoln_douglas:'Lincoln–Douglas',
  town_hall:'Town Hall · Open', freestyle:'Freestyle',
};

export function ScheduledScreen({ debateId, onBack, onStarted }: {
  debateId: string; onBack: () => void; onStarted: () => void;
}) {
  const { user } = useAuth();
  const [d, setD] = useState<Debate | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [rsvp, setRsvpState] = useState<RsvpInfo>({ going: 0, interested: 0, mine: null });
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let on = true;
    getDebate(debateId).then(({ debate }) => { if (on) setD(debate); })
      .catch(e => { if (on) setErr(e?.message ?? 'Could not load this debate'); });
    getRsvp(debateId).then(r => { if (on) setRsvpState(r); }).catch(() => {});
    const off = subscribeDebate(debateId, (row) => {
      if (row.status && row.status !== 'scheduled') onStarted();   // doors opened — go in
    });
    return () => { on = false; off(); };
  }, [debateId, onStarted]);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  async function choose(status: 'going' | 'interested') {
    if (!user) { setErr('Sign in to RSVP.'); return; }
    const next = rsvp.mine === status ? null : status;
    // optimistic
    setRsvpState(r => {
      const dec = (k: 'going'|'interested') => r.mine === k ? 1 : 0;
      const going = r.going - dec('going') + (next === 'going' ? 1 : 0);
      const interested = r.interested - dec('interested') + (next === 'interested' ? 1 : 0);
      return { going, interested, mine: next };
    });
    try { if (next) await setRsvp(debateId, next); else await clearRsvp(debateId); }
    catch { getRsvp(debateId).then(setRsvpState).catch(() => {}); }
  }

  const [showResched, setShowResched] = useState(false);
  const [reschedBusy, setReschedBusy] = useState(false);
  const [reschedErr, setReschedErr] = useState<string | null>(null);

  async function doReschedule(newISO: string) {
    setReschedBusy(true); setReschedErr(null);
    try {
      await rescheduleDebate(debateId, newISO);
      // Keep the YouTube broadcast in lockstep. Best-effort: if there's no
      // broadcast attached, the backend returns 404 and we ignore it — the
      // debate move still stands.
      try { await rescheduleYouTubeBroadcast(debateId, newISO); }
      catch (e: any) { if (!/no broadcast/i.test(e?.message ?? '')) throw e; }
      const fresh = await getDebate(debateId);
      setD(fresh);
      setShowResched(false);
    } catch (e: any) {
      setReschedErr(e?.message ?? 'Could not reschedule');
    } finally {
      setReschedBusy(false);
    }
  }

  async function start() {
    setBusy(true);
    try { await startDebate(debateId); onStarted(); }
    catch (e: any) { setErr(e?.message ?? 'Could not start'); setBusy(false); }
  }

  if (err) return <Center><p style={{ fontFamily:ui, color:C.garnetHi }}>{err}</p></Center>;
  if (!d) return <Center><p style={{ fontFamily:ui, color:C.faint }}>Loading…</p></Center>;

  const isHost = user?.id === d.host_id;
  const when = d.scheduled_at ? new Date(d.scheduled_at) : null;
  const ms = when ? when.getTime() - now : 0;
  const live = ms <= 0;
  const url = typeof window !== 'undefined' ? `${window.location.origin}/debate/${debateId}` : '';

  return (
    <div style={{ position:'absolute', inset:0, overflowY:'auto', background:C.base }}>
      <div style={{ maxWidth:720, margin:'0 auto', padding:'22px 22px 80px' }}>
        <button onClick={onBack} style={iconBtn}>‹</button>

        <div style={{ marginTop:18, borderRadius:14, overflow:'hidden', border:`1px solid ${C.hair}`, background:C.panel }}>
          <div style={{ position:'relative', height:180, background: d.thumbnail_url ? '#000'
            : `linear-gradient(150deg, ${a(C.gold,'26')}, ${C.base} 75%)` }}>
            {d.thumbnail_url && <img src={d.thumbnail_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />}
            <span style={{ position:'absolute', top:14, left:14, fontFamily:ui, fontSize:10.5, fontWeight:700,
              letterSpacing:'1.5px', textTransform:'uppercase', color:C.base, background:C.gold, padding:'4px 10px', borderRadius:4 }}>
              {live ? 'Starting any moment' : 'Upcoming'}</span>
          </div>

          <div style={{ padding:'20px 22px 24px' }}>
            <div style={{ fontFamily:ui, fontSize:11, fontWeight:700, letterSpacing:'.6px', textTransform:'uppercase', color:C.faint }}>
              {FMT[d.format] ?? d.format}{d.is_paid ? ` · $${(d.price_cents/100).toFixed(0)}` : ' · Free'}</div>
            <h1 style={{ fontFamily:display, fontSize:30, lineHeight:1.12, color:C.ink, margin:'8px 0 14px', fontWeight:600 }}>{d.motion}</h1>

            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
              <Avatar url={d.host?.avatar_url} name={d.host?.display_name} size={34} />
              <div>
                <div style={{ fontFamily:ui, fontSize:14, color:C.ink, fontWeight:600 }}>{d.host?.display_name ?? 'Host'}</div>
                {d.host?.handle && <div style={{ fontFamily:mono, fontSize:11.5, color:C.faint }}>@{d.host.handle}</div>}
              </div>
              <div style={{ marginLeft:'auto' }}>
                <ShareButton url={url} title={d.motion} text={`Join me for: ${d.motion}`} />
              </div>
            </div>

            {/* countdown */}
            <div style={{ border:`1px solid ${C.hairHi}`, borderRadius:11, padding:'16px', background:C.panel2, marginBottom:18 }}>
              {when && <div style={{ fontFamily:ui, fontSize:12.5, color:C.dim, marginBottom: live ? 0 : 10 }}>
                {when.toLocaleString([], { weekday:'short', month:'short', day:'numeric', hour:'numeric', minute:'2-digit' })}</div>}
              {!live
                ? <Countdown ms={ms} />
                : <div style={{ fontFamily:ui, fontSize:14, color:C.goldHi, fontWeight:600 }}>The host is about to open the doors…</div>}
            </div>

            {/* rsvp */}
            <div style={{ display:'flex', gap:10, marginBottom:8 }}>
              <RsvpBtn label="Going" active={rsvp.mine==='going'} count={rsvp.going} c={C.jade} hi={C.jadeHi} onClick={() => choose('going')} />
              <RsvpBtn label="Interested" active={rsvp.mine==='interested'} count={rsvp.interested} c={C.gold} hi={C.goldHi} onClick={() => choose('interested')} />
            </div>
            <p style={{ fontFamily:ui, fontSize:11.5, color:C.faint, margin:'4px 0 0' }}>
              {rsvp.going + rsvp.interested === 0 ? 'Be the first to RSVP.'
                : `${rsvp.going} going · ${rsvp.interested} interested`}</p>

            {isHost && (
              <div style={{ marginTop:22, paddingTop:18, borderTop:`1px solid ${C.hair}` }}>
                <button onClick={start} disabled={busy} style={{ ...solidGold, width:'100%', opacity: busy ? 0.6 : 1 }}>
                  {busy ? 'Opening…' : 'Open the doors now'}</button>
                <p style={{ fontFamily:ui, fontSize:11.5, color:C.faint, textAlign:'center', margin:'8px 0 0' }}>
                  Starts the assembly — anyone waiting here joins automatically.</p>
                {!live && when && (
                  <button onClick={() => { setReschedErr(null); setShowResched(true); }}
                    style={{ width:'100%', marginTop:10, padding:'11px', borderRadius:8, cursor:'pointer',
                      fontFamily:ui, fontWeight:600, fontSize:13.5, color:C.dim,
                      border:`1px solid ${C.hairHi}`, background:'transparent' }}>
                    Change date &amp; time
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showResched && when && (
        <RescheduleModal
          current={when}
          busy={reschedBusy}
          error={reschedErr}
          onCancel={() => setShowResched(false)}
          onSave={doReschedule}
        />
      )}
    </div>
  );
}

function RescheduleModal({ current, busy, error, onCancel, onSave }: {
  current: Date; busy: boolean; error: string | null;
  onCancel: () => void; onSave: (iso: string) => void;
}) {
  // datetime-local wants local time with no zone; format the current value so
  // the picker opens on the existing slot rather than blank.
  const pad = (n: number) => String(n).padStart(2, '0');
  const local = `${current.getFullYear()}-${pad(current.getMonth()+1)}-${pad(current.getDate())}T${pad(current.getHours())}:${pad(current.getMinutes())}`;
  const [val, setVal] = useState(local);
  const minLocal = (() => {
    const d = new Date(Date.now() + 5*60000);
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  })();

  return (
    <div onClick={onCancel} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)',
      display:'grid', placeItems:'center', zIndex:60, padding:20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width:'100%', maxWidth:420, borderRadius:14,
        border:`1px solid ${C.hair}`, background:C.panel, padding:'22px' }}>
        <h3 style={{ fontFamily:display, fontSize:20, color:C.ink, margin:'0 0 4px', fontWeight:600 }}>Change date &amp; time</h3>
        <p style={{ fontFamily:ui, fontSize:12.5, color:C.faint, margin:'0 0 16px' }}>
          Everyone who RSVP’d keeps their spot. If this debate streams to YouTube, the broadcast moves too.
        </p>
        <input type="datetime-local" value={val} min={minLocal}
          onChange={e => setVal(e.target.value)}
          style={{ width:'100%', padding:'11px', borderRadius:8, colorScheme:'dark',
            border:`1px solid ${C.hairHi}`, background:C.panel2, color:C.ink, fontFamily:ui, fontSize:14 }} />
        {error && <p style={{ fontFamily:ui, fontSize:12.5, color:C.garnetHi, margin:'10px 0 0' }}>{error}</p>}
        <div style={{ display:'flex', gap:10, marginTop:18 }}>
          <button onClick={onCancel} disabled={busy} style={{ flex:1, padding:'11px', borderRadius:8, cursor:'pointer',
            fontFamily:ui, fontWeight:600, fontSize:13.5, color:C.dim, border:`1px solid ${C.hairHi}`, background:'transparent' }}>
            Cancel
          </button>
          <button onClick={() => onSave(new Date(val).toISOString())} disabled={busy || !val}
            style={{ ...solidGold, flex:1, opacity: (busy || !val) ? 0.6 : 1 }}>
            {busy ? 'Moving…' : 'Save new time'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Countdown({ ms }: { ms: number }) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const Unit = ({ n, l }: { n: number; l: string }) => (
    <div style={{ textAlign:'center', minWidth:54 }}>
      <div style={{ fontFamily:mono, fontSize:26, fontWeight:700, color:C.ink }}>{String(n).padStart(2,'0')}</div>
      <div style={{ fontFamily:ui, fontSize:9.5, letterSpacing:'1px', textTransform:'uppercase', color:C.faint }}>{l}</div>
    </div>
  );
  return (
    <div style={{ display:'flex', gap:8 }}>
      {d > 0 && <Unit n={d} l="days" />}
      <Unit n={h} l="hrs" /><Unit n={m} l="min" /><Unit n={sec} l="sec" />
    </div>
  );
}

function RsvpBtn({ label, active, count, c, hi, onClick }: {
  label: string; active: boolean; count: number; c: string; hi: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{ flex:1, padding:'12px 8px', borderRadius:8, cursor:'pointer',
      fontFamily:ui, fontWeight:700, fontSize:13.5, color: active ? C.base : C.ink,
      border:`1px solid ${active ? hi : C.hairHi}`,
      background: active ? `linear-gradient(180deg, ${hi}, ${c})` : 'transparent' }}>
      {active ? `✓ ${label}` : label}{count > 0 && <span style={{ opacity:.8, fontWeight:600 }}> · {count}</span>}
    </button>
  );
}

const iconBtn: React.CSSProperties = { width:34, height:34, borderRadius:7, border:`1px solid ${C.hair}`,
  background:'rgba(0,0,0,0.25)', color:C.dim, cursor:'pointer', fontSize:17, lineHeight:1 };
function Center({ children }: { children: React.ReactNode }) {
  return <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center', background:C.base }}>{children}</div>;
}
