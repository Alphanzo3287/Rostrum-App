// =====================================================================
// The Rostrum · src/components/EvidenceViewer.tsx
// Batch C4 — Evidence Feed (concept panel 1 rail) + Evidence Viewer
// (concept panel 6). Every field is real: debate_evidence/evidence_feed
// for the list, evidence_comments for the thread. No "Notes" tab is
// included — the concept shows one, but there's no notes table, and this
// project doesn't ship UI that has nothing real behind it.
// =====================================================================
import { useEffect, useState } from 'react';
import {
  getEvidenceFeed, addEvidence, getEvidenceComments, addEvidenceComment,
  type EvidenceItem, type EvidenceKind, type EvidenceComment,
} from '../lib/api';
import type { Side } from '../lib/types';
import { C, ui, display, mono, a, field, solidGold } from '../lib/theme';
import { Avatar } from './ui';

const KIND_ICON: Record<EvidenceKind, string> = {
  pdf: '📄', chart: '📊', video: '🎬', article: '📰', image: '🖼', book: '📚', link: '🔗',
};

/* ------------------------------ FEED PANEL ------------------------------ */
export function EvidencePanel({ debateId, canAdd }: { debateId: string; canAdd: boolean }) {
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [open, setOpen] = useState<EvidenceItem | null>(null);
  const [adding, setAdding] = useState(false);

  const reload = () => getEvidenceFeed(debateId).then(setItems).catch(() => {});
  useEffect(() => { reload(); const iv = setInterval(reload, 6000); return () => clearInterval(iv); }, [debateId]);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <h3 style={{ fontFamily: display, fontSize: 21, color: C.ink, margin: '0 0 2px' }}>Evidence Feed</h3>
        {canAdd && (
          <button onClick={() => setAdding(true)} style={{ padding: '5px 11px', borderRadius: 8, cursor: 'pointer',
            fontFamily: ui, fontSize: 11.5, fontWeight: 700, color: C.goldHi, background: a(C.gold, '14'),
            border: `1px solid ${a(C.gold, '44')}` }}>+ Add</button>
        )}
      </div>
      {items.length === 0 ? (
        <p style={{ fontFamily: ui, fontSize: 12.5, color: C.faint, marginTop: 10 }}>No evidence submitted yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
          {items.map(it => (
            <button key={it.id} onClick={() => setOpen(it)} style={{ textAlign: 'left', cursor: 'pointer',
              padding: '10px 12px', borderRadius: 12, background: C.panel2, border: `1px solid ${C.hair}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 15 }}>{KIND_ICON[it.kind] ?? '📎'}</span>
                <span style={{ fontFamily: ui, fontSize: 13, fontWeight: 600, color: C.ink, flex: 1, minWidth: 0,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.title}</span>
                {it.side && (
                  <span style={{ fontFamily: ui, fontSize: 9.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
                    color: it.side === 'prop' ? C.jadeHi : C.garnetHi }}>{it.side}</span>
                )}
              </div>
              <div style={{ fontFamily: ui, fontSize: 11, color: C.faint, marginTop: 4 }}>
                Added by {it.added_name ?? 'Unknown'} · {it.comment_count} comment{it.comment_count === 1 ? '' : 's'}
              </div>
            </button>
          ))}
        </div>
      )}

      {adding && <AddEvidenceModal debateId={debateId} onClose={() => setAdding(false)} onAdded={() => { setAdding(false); reload(); }} />}
      {open && <EvidenceViewerModal item={open} onClose={() => setOpen(null)} />}
    </>
  );
}

/* ---------------------------- ADD EVIDENCE ---------------------------- */
function AddEvidenceModal({ debateId, onClose, onAdded }: { debateId: string; onClose: () => void; onAdded: () => void }) {
  const [kind, setKind] = useState<EvidenceKind>('link');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [citation, setCitation] = useState('');
  const [side, setSide] = useState<Side | ''>('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    if (!title.trim()) { setErr('Title is required.'); return; }
    setBusy(true); setErr('');
    try {
      await addEvidence(debateId, { kind, title: title.trim(), url: url.trim() || null, citation: citation.trim() || null, side: side || null });
      onAdded();
    } catch (e: any) { setErr(e?.message ?? 'Could not add evidence.'); }
    finally { setBusy(false); }
  }

  return (
    <ModalShell onClose={onClose} title="Add evidence">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label style={labelStyle}>Kind
          <select value={kind} onChange={e => setKind(e.target.value as EvidenceKind)} style={field}>
            {(['link', 'article', 'pdf', 'chart', 'image', 'video', 'book'] as EvidenceKind[]).map(k => (
              <option key={k} value={k}>{KIND_ICON[k]} {k}</option>
            ))}
          </select>
        </label>
        <label style={labelStyle}>Title
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="The Federalist No. 10" style={field} />
        </label>
        <label style={labelStyle}>URL (optional)
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" style={field} />
        </label>
        <label style={labelStyle}>Citation (optional)
          <input value={citation} onChange={e => setCitation(e.target.value)} placeholder="Madison, 1787" style={field} />
        </label>
        <label style={labelStyle}>Supports which side? (optional)
          <select value={side} onChange={e => setSide(e.target.value as Side | '')} style={field}>
            <option value="">—</option>
            <option value="prop">Proposition</option>
            <option value="opp">Opposition</option>
          </select>
        </label>
        {err && <div style={{ fontFamily: ui, fontSize: 12, color: C.garnetHi }}>{err}</div>}
        <button onClick={submit} disabled={busy} style={{ ...solidGold, marginTop: 4, opacity: busy ? .6 : 1 }}>
          {busy ? 'Adding…' : 'Add evidence'}
        </button>
      </div>
    </ModalShell>
  );
}
const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5, fontFamily: ui, fontSize: 11.5, color: C.dim };

/* ---------------------------- VIEWER MODAL ---------------------------- */
export function EvidenceViewerModal({ item, onClose }: { item: EvidenceItem; onClose: () => void }) {
  const [comments, setComments] = useState<EvidenceComment[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = () => getEvidenceComments(item.id).then(setComments).catch(() => {});
  useEffect(() => { reload(); }, [item.id]);

  async function post() {
    if (!draft.trim()) return;
    setBusy(true);
    try { await addEvidenceComment(item.id, draft.trim()); setDraft(''); await reload(); }
    catch { /* non-fatal */ }
    finally { setBusy(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'grid', placeItems: 'center',
      background: a(C.base, 'CC'), backdropFilter: 'blur(6px)', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: 'min(920px, 100%)', maxHeight: '86vh', borderRadius: 16, overflow: 'hidden',
        background: C.panel, border: `1px solid ${C.hair}`, display: 'flex', boxShadow: '0 30px 80px rgba(0,0,0,.5)' }}>

        {/* preview */}
        <div style={{ flex: '1 1 58%', minWidth: 0, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${C.hair}` }}>
          <div style={{ padding: '16px 18px', borderBottom: `1px solid ${C.hair}`, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ fontSize: 20 }}>{KIND_ICON[item.kind] ?? '📎'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: display, fontSize: 18, fontWeight: 600, color: C.ink }}>{item.title}</div>
              {item.citation && <div style={{ fontFamily: ui, fontSize: 12, color: C.faint, marginTop: 3 }}>{item.citation}</div>}
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.faint, fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: C.base2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <EvidencePreview item={item} />
          </div>
          {item.url && (
            <div style={{ padding: '10px 18px', borderTop: `1px solid ${C.hair}` }}>
              <a href={item.url} target="_blank" rel="noreferrer" style={{ fontFamily: ui, fontSize: 12.5, color: C.goldHi, textDecoration: 'none' }}>
                Open original ↗
              </a>
            </div>
          )}
        </div>

        {/* comments */}
        <div style={{ flex: '1 1 42%', minWidth: 260, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 16px 10px', fontFamily: ui, fontSize: 11, fontWeight: 700, letterSpacing: '.1em',
            textTransform: 'uppercase', color: C.faint, borderBottom: `1px solid ${C.hair}` }}>
            Comments ({comments.length})
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {comments.length === 0
              ? <span style={{ fontFamily: ui, fontSize: 12, color: C.faint }}>No comments yet — start the discussion.</span>
              : comments.map(c => (
                <div key={c.id} style={{ display: 'flex', gap: 8 }}>
                  <Avatar url={c.author?.avatar_url} name={c.author?.display_name} size={28} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: ui, fontSize: 12.5, fontWeight: 700, color: C.ink }}>{c.author?.display_name ?? 'Someone'}</div>
                    <div style={{ fontFamily: ui, fontSize: 13, color: C.dim, marginTop: 2, wordBreak: 'break-word' }}>{c.body}</div>
                  </div>
                </div>
              ))}
          </div>
          <div style={{ padding: 12, borderTop: `1px solid ${C.hair}`, display: 'flex', gap: 8 }}>
            <input value={draft} onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !busy) post(); }}
              placeholder="Add a comment…" style={{ ...field, flex: 1 }} />
            <button onClick={post} disabled={busy || !draft.trim()} style={{ ...solidGold, padding: '10px 16px',
              opacity: busy || !draft.trim() ? .5 : 1 }}>Post</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EvidencePreview({ item }: { item: EvidenceItem }) {
  if (!item.url) {
    return <div style={{ padding: 40, textAlign: 'center', fontFamily: ui, fontSize: 13, color: C.faint }}>No preview available for this item.</div>;
  }
  if (item.kind === 'image') return <img src={item.url} alt={item.title} style={{ maxWidth: '100%', maxHeight: '58vh', objectFit: 'contain' }} />;
  if (item.kind === 'video') {
    const embed = toEmbedUrl(item.url);
    return embed
      ? <iframe src={embed} title={item.title} style={{ width: '100%', aspectRatio: '16/9', border: 'none' }} allowFullScreen />
      : <video src={item.url} controls style={{ maxWidth: '100%', maxHeight: '58vh' }} />;
  }
  if (item.kind === 'pdf') return <iframe src={item.url} title={item.title} style={{ width: '100%', height: '58vh', border: 'none', background: '#fff' }} />;
  // article / link / chart / book — no reliable in-app embed; show a clean open-original card.
  return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ fontSize: 34, marginBottom: 10 }}>{KIND_ICON[item.kind] ?? '📎'}</div>
      <div style={{ fontFamily: ui, fontSize: 13, color: C.faint }}>Open the link to view this {item.kind}.</div>
    </div>
  );
}
function toEmbedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  return null;
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 250, display: 'grid', placeItems: 'center',
      background: a(C.base, 'CC'), backdropFilter: 'blur(6px)', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: 420, maxWidth: '100%', borderRadius: 14, background: C.panel, border: `1px solid ${C.hair}`,
        padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ fontFamily: display, fontSize: 19, color: C.ink, margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.faint, fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
