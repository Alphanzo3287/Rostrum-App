// =====================================================================
// The Rostrum · src/server/gavelRetrieval.ts
// Fast, free, direct retrieval from Gavel's curated sources.
//
// WHY NOT the model's built-in web_search tool: that runs a server-side
// agent loop (think → search → think → search → answer) which takes
// 10-40s and costs $10/1,000 searches. Netlify kills synchronous
// functions at 10s on Free/Personal plans, so it could never finish.
//
// Instead we call the curated sources' OWN public APIs directly and in
// PARALLEL (~1-2s total, no API keys, no search fees), then hand the
// evidence to a single model call. Same live data, same curated tiers,
// a fraction of the latency and cost.
//
// Every client is best-effort: it has its own timeout and can never fail
// the request — a slow source is simply omitted from the evidence.
// =====================================================================
import type { FactSource } from './gavelCore';
import { detectTopic, type Topic } from './gavelSources';

const CONTACT = 'gavel@rostrums.site';
const UA = `TheRostrum/Gavel (${CONTACT})`;
const PER_SOURCE_TIMEOUT_MS = 2600;   // a slow index must never blow the budget

export interface Evidence extends FactSource { abstract: string }

/** fetch with a hard timeout; resolves null instead of throwing. */
async function get(url: string, headers: Record<string, string> = {}): Promise<any | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PER_SOURCE_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, ...headers }, signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; } finally { clearTimeout(timer); }
}

const clean = (s: string) => String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------------
// Tier 1 — scholarly indexes
// ---------------------------------------------------------------------

/** OpenAlex — open scholarly index (250M+ works). */
export async function searchOpenAlex(q: string, n = 4): Promise<Evidence[]> {
  const d = await get(`https://api.openalex.org/works?search=${encodeURIComponent(q)}&per_page=${n}&sort=relevance_score:desc&mailto=${encodeURIComponent(CONTACT)}`);
  const works = Array.isArray(d?.results) ? d.results : [];
  return works.map((w: any): Evidence => {
    const auths = (w.authorships || []).slice(0, 3).map((a: any) => a.author?.display_name).filter(Boolean);
    return {
      title: clean(w.title || w.display_name), year: w.publication_year ?? null,
      authors: auths.length ? auths.join(', ') + ((w.authorships || []).length > 3 ? ' et al.' : '') : 'unknown authors',
      journal: w.primary_location?.source?.display_name || 'OpenAlex',
      citations: w.cited_by_count ?? 0,
      url: w.open_access?.oa_url || w.doi || w.id || '',
      kind: 'academic', abstract: reconstructAbstract(w.abstract_inverted_index),
    };
  }).filter((s: Evidence) => s.title);
}

/** Semantic Scholar — AI-powered academic search. */
export async function searchSemanticScholar(q: string, n = 4): Promise<Evidence[]> {
  const fields = 'title,abstract,year,authors,venue,citationCount,url,externalIds';
  const d = await get(`https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(q)}&limit=${n}&fields=${fields}`);
  const items = Array.isArray(d?.data) ? d.data : [];
  return items.map((p: any): Evidence => ({
    title: clean(p.title), year: p.year ?? null,
    authors: (p.authors || []).slice(0, 3).map((a: any) => a.name).filter(Boolean).join(', ') || 'unknown authors',
    journal: p.venue || 'Semantic Scholar',
    citations: p.citationCount ?? 0,
    url: p.url || (p.externalIds?.DOI ? `https://doi.org/${p.externalIds.DOI}` : ''),
    kind: 'academic', abstract: clean(p.abstract).slice(0, 1200),
  })).filter((s: Evidence) => s.title);
}

/** Crossref — DOI + scholarly metadata. */
export async function searchCrossref(q: string, n = 3): Promise<Evidence[]> {
  const d = await get(`https://api.crossref.org/works?query=${encodeURIComponent(q)}&rows=${n}&select=title,author,issued,container-title,URL,abstract,is-referenced-by-count&mailto=${encodeURIComponent(CONTACT)}`);
  const items = Array.isArray(d?.message?.items) ? d.message.items : [];
  return items.map((w: any): Evidence => ({
    title: clean(Array.isArray(w.title) ? w.title[0] : w.title),
    year: w.issued?.['date-parts']?.[0]?.[0] ?? null,
    authors: (w.author || []).slice(0, 3).map((a: any) => [a.given, a.family].filter(Boolean).join(' ')).filter(Boolean).join(', ') || 'unknown authors',
    journal: (Array.isArray(w['container-title']) ? w['container-title'][0] : w['container-title']) || 'Crossref',
    citations: w['is-referenced-by-count'] ?? 0,
    url: w.URL || '',
    kind: 'academic', abstract: clean(w.abstract).slice(0, 800),
  })).filter((s: Evidence) => s.title);
}

/** arXiv — physics, AI, math, CS preprints (Atom XML, parsed leniently). */
export async function searchArxiv(q: string, n = 3): Promise<Evidence[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PER_SOURCE_TIMEOUT_MS);
  try {
    const res = await fetch(`https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(q)}&max_results=${n}`,
      { headers: { 'User-Agent': UA }, signal: ctrl.signal });
    if (!res.ok) return [];
    const xml = await res.text();
    const entries = xml.split('<entry>').slice(1, n + 1);
    return entries.map((e): Evidence => {
      const pick = (tag: string) => clean((e.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)) || [])[1] || '');
      const link = (e.match(/<id>([\s\S]*?)<\/id>/) || [])[1] || '';
      return {
        title: pick('title'), year: Number((pick('published').match(/(\d{4})/) || [])[1]) || null,
        authors: (e.match(/<name>([\s\S]*?)<\/name>/g) || []).slice(0, 3).map(m => clean(m)).join(', ') || 'unknown authors',
        journal: 'arXiv', citations: 0, url: clean(link),
        kind: 'academic', abstract: pick('summary').slice(0, 1000),
      };
    }).filter(s => s.title);
  } catch { return []; } finally { clearTimeout(timer); }
}

// ---------------------------------------------------------------------
// Tier 2 — government (PubMed covers Malcolm's PubMed + PMC entries)
// ---------------------------------------------------------------------

/** PubMed — medicine, biology, health (NCBI E-utilities; two hops). */
export async function searchPubMed(q: string, n = 4): Promise<Evidence[]> {
  const s = await get(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(q)}&retmode=json&retmax=${n}&sort=relevance`);
  const ids: string[] = s?.esearchresult?.idlist ?? [];
  if (!ids.length) return [];
  const d = await get(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`);
  const result = d?.result;
  if (!result) return [];
  return ids.map((id): Evidence | null => {
    const r = result[id];
    if (!r?.title) return null;
    return {
      title: clean(r.title), year: Number((String(r.pubdate || '').match(/(\d{4})/) || [])[1]) || null,
      authors: (r.authors || []).slice(0, 3).map((a: any) => a.name).filter(Boolean).join(', ') || 'unknown authors',
      journal: r.source || 'PubMed', citations: 0,
      url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
      kind: 'academic', abstract: '',   // esummary omits abstracts; title+journal still anchors the claim
    };
  }).filter(Boolean) as Evidence[];
}

// ---------------------------------------------------------------------
// Tier 8 — general knowledge. Orientation ONLY; must be corroborated.
// Wikipedia is continuously updated, so it also covers present-day facts
// that journals structurally cannot.
// ---------------------------------------------------------------------
export async function searchWikipedia(q: string, n = 3): Promise<Evidence[]> {
  const d = await get(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&srlimit=${n}&origin=*`);
  const hits = d?.query?.search ?? [];
  return hits.map((h: any): Evidence => ({
    title: clean(h.title), year: null, authors: 'en.wikipedia.org', journal: 'Wikipedia',
    citations: 0, url: `https://en.wikipedia.org/?curid=${h.pageid}`,
    kind: 'web', published: h.timestamp ? String(h.timestamp).slice(0, 10) : '',
    abstract: clean(h.snippet),
  })).filter((s: Evidence) => s.title);
}

// ---------------------------------------------------------------------
// Orchestration — pick 2-3 indexes by topic and run them in PARALLEL.
// ---------------------------------------------------------------------
type Retriever = (q: string) => Promise<Evidence[]>;

function retrieversFor(topic: Topic, fresh: boolean): Retriever[] {
  // Present-day claims: journals can't answer, so lead with continuously
  // updated references and keep one scholarly index for corroboration.
  if (fresh) return [q => searchWikipedia(q, 4), q => searchOpenAlex(q, 2)];

  switch (topic) {
    case 'health':     return [q => searchPubMed(q, 4), q => searchOpenAlex(q, 3), q => searchWikipedia(q, 1)];
    case 'science':    return [q => searchArxiv(q, 3), q => searchOpenAlex(q, 3), q => searchWikipedia(q, 1)];
    case 'law':
    case 'history':
    case 'religion':   return [q => searchOpenAlex(q, 3), q => searchWikipedia(q, 3), q => searchSemanticScholar(q, 2)];
    case 'economics':
    case 'philosophy':
    default:           return [q => searchOpenAlex(q, 3), q => searchSemanticScholar(q, 3), q => searchWikipedia(q, 1)];
  }
}

/**
 * Retrieve live evidence for a claim from the curated sources.
 * Runs every selected index concurrently; a failing/slow index is skipped.
 * Academic results are ordered first so the model weights them above
 * encyclopedias, matching the tier policy.
 */
export async function retrieveEvidence(query: string, opts: { fresh?: boolean; limit?: number } = {}): Promise<Evidence[]> {
  const topic = detectTopic(query);
  const settled = await Promise.allSettled(retrieversFor(topic, !!opts.fresh).map(r => r(query)));
  const all: Evidence[] = [];
  for (const s of settled) if (s.status === 'fulfilled') all.push(...s.value);

  // Dedupe by URL, then by normalised title.
  const seen = new Set<string>();
  const unique = all.filter(e => {
    const key = (e.url || e.title).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 80);
    if (!key || seen.has(key)) return false;
    seen.add(key); return true;
  });

  // Academic first (tier policy), then everything else.
  unique.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'academic' ? -1 : 1));
  return unique.slice(0, opts.limit ?? 6);
}

function reconstructAbstract(inv: Record<string, number[]> | null | undefined): string {
  if (!inv) return '';
  const slots: string[] = [];
  for (const [word, positions] of Object.entries(inv)) for (const pos of positions) slots[pos] = word;
  return slots.filter(Boolean).join(' ').slice(0, 1200);
}
