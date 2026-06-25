// =====================================================================
// The Rostrum · src/components/ShareSheet.tsx
// A reusable share control. Drop <ShareButton url=… title=… /> anywhere
// (chamber, invite panel, debate cards, profiles) to let people send a
// debate out via the system share sheet, social, messaging, or email.
// =====================================================================
import { useState } from 'react';
import { C, ui, mono, display, solidGold } from '../lib/theme';

type Target = { key: string; label: string; tint: string; href: (u: string, t: string) => string };

const TARGETS: Target[] = [
  { key: 'x',        label: 'X',        tint: '#E7E2D8', href: (u, t) => `https://twitter.com/intent/tweet?url=${u}&text=${t}` },
  { key: 'facebook', label: 'Facebook', tint: '#5A8DEE', href: (u)    => `https://www.facebook.com/sharer/sharer.php?u=${u}` },
  { key: 'whatsapp', label: 'WhatsApp', tint: '#4FC2A7', href: (u, t) => `https://wa.me/?text=${t}%20${u}` },
  { key: 'reddit',   label: 'Reddit',   tint: '#E2503A', href: (u, t) => `https://www.reddit.com/submit?url=${u}&title=${t}` },
  { key: 'linkedin', label: 'LinkedIn', tint: '#5A8DEE', href: (u)    => `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
  { key: 'email',    label: 'Email',    tint: '#D9B45C', href: (u, t) => `mailto:?subject=${t}&body=${t}%0A%0A${u}` },
];

export function ShareButton({ url, title, text, label = 'Share', compact, style }: {
  url: string; title?: string; text?: string; label?: string; compact?: boolean; style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} title="Share this debate"
        style={{ display:'inline-flex', alignItems:'center', gap:6, fontFamily:ui, fontSize: compact ? 11 : 12.5,
          fontWeight:600, color:C.dim, background:'transparent', border:`1px solid ${C.hair}`, borderRadius:6,
          padding: compact ? '5px 9px' : '7px 12px', cursor:'pointer', ...style }}>
        <ShareGlyph /> {!compact && label}
      </button>
      {open && <ShareModal url={url} title={title} text={text} onClose={() => setOpen(false)} />}
    </>
  );
}

function ShareModal({ url, title, text, onClose }: { url: string; title?: string; text?: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const shareTitle = title ?? 'A debate on The Rostrum';
  const shareText = text ?? shareTitle;
  const eUrl = encodeURIComponent(url);
  const eText = encodeURIComponent(shareText);
  const canNative = typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function';

  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1600); }
    catch { /* field stays selectable as a fallback */ }
  }
  async function native() {
    try { await (navigator as any).share({ title: shareTitle, text: shareText, url }); }
    catch { /* user cancelled */ }
  }

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,0.62)',
      display:'grid', placeItems:'center', padding:18, backdropFilter:'blur(3px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ width:'100%', maxWidth:420, background:C.panel,
        border:`1px solid ${C.hairHi}`, borderRadius:14, padding:'20px 20px 22px', boxShadow:'0 24px 70px rgba(0,0,0,0.6)' }}>
        <div style={{ display:'flex', alignItems:'center', marginBottom:4 }}>
          <h3 style={{ flex:1, fontFamily:display, fontSize:21, color:C.ink, margin:0 }}>Share this debate</h3>
          <button onClick={onClose} aria-label="Close" style={{ background:'none', border:'none', color:C.dim,
            cursor:'pointer', fontSize:20, lineHeight:1, padding:4 }}>×</button>
        </div>
        <p style={{ fontFamily:ui, fontSize:12.5, color:C.faint, margin:'0 0 16px', lineHeight:1.45 }}>
          Anyone with this link can watch — and jump on stage if you’ve sent them a seat.</p>

        <div style={{ display:'flex', gap:8, marginBottom:16 }}>
          <input readOnly value={url} onFocus={e => e.currentTarget.select()}
            style={{ flex:1, fontFamily:mono, fontSize:11.5, color:C.dim, background:C.base,
              border:`1px solid ${C.hair}`, borderRadius:7, padding:'10px 11px' }} />
          <button onClick={copy} style={{ ...solidGold, padding:'0 15px', whiteSpace:'nowrap' }}>
            {copied ? 'Copied ✓' : 'Copy'}</button>
        </div>

        {canNative && (
          <button onClick={native} style={{ width:'100%', marginBottom:14, padding:'11px', borderRadius:8,
            fontFamily:ui, fontWeight:700, fontSize:13.5, color:C.ink, cursor:'pointer',
            background:C.panel2, border:`1px solid ${C.hairHi}` }}>
            Share via your device…</button>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          {TARGETS.map(t => (
            <a key={t.key} href={t.href(eUrl, eText)} target="_blank" rel="noreferrer noopener"
              style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none', padding:'10px 12px',
                borderRadius:8, border:`1px solid ${C.hair}`, background:C.base }}>
              <span style={{ width:9, height:9, borderRadius:'50%', background:t.tint, flexShrink:0 }} />
              <span style={{ fontFamily:ui, fontSize:13, fontWeight:600, color:C.ink }}>{t.label}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function ShareGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
      <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
    </svg>
  );
}
