// =====================================================================
// The Rostrum · src/server/gavelSources.ts
// Gavel's curated evidence allow-list.
//
// Gavel never searches the open web. Every live search is restricted to a
// vetted set of scholarly, government, international, and primary-source
// domains, chosen per claim by a zero-cost heuristic topic router. This
// makes verdicts (a) far harder to poison with SEO/blog spam, (b) cheaper
// (fewer junk pages entering context), and (c) defensible in a debate —
// every citation traces to an institution a scholar would accept.
//
// Format rules (Anthropic web_search): bare domains, NO scheme, and
// subdomains are matched automatically — so `nih.gov` already covers
// pubmed.ncbi.nlm.nih.gov and pmc.ncbi.nlm.nih.gov.
// =====================================================================

/** Tier 1 — peer-reviewed / scholarly indexes. Always in play. */
export const TIER1_SCHOLARLY = [
  'scholar.google.com',   // scholarly articles + citations
  'semanticscholar.org',  // AI-powered academic search
  'core.ac.uk',           // millions of open-access papers
  'doaj.org',             // open-access journals
  'crossref.org',         // DOI + scholarly metadata
  'openalex.org',         // open scholarly index
];

/** Tier 1 (domain-specific preprint / paper repositories). */
const ARXIV = 'arxiv.org';
const SSRN = 'ssrn.com';

/** Tier 2 — government. `nih.gov` covers PubMed + PubMed Central. */
const GOV_HEALTH = ['nih.gov', 'cdc.gov'];
const GOV_STATS = ['census.gov', 'bls.gov', 'data.gov'];
const GOV_LAW = ['congress.gov', 'loc.gov', 'archives.gov', 'supremecourt.gov'];
const GOV_SCIENCE = ['nasa.gov', 'nsf.gov'];

/** Tier 3 — international organizations. */
const INTL_HEALTH = ['who.int'];
const INTL_ECON = ['worldbank.org', 'imf.org', 'oecd.org'];
const INTL_GENERAL = ['un.org', 'unesco.org'];

/** Tier 4 — university libraries (deep humanities / special collections). */
export const TIER4_LIBRARIES = [
  'library.harvard.edu', 'library.stanford.edu', 'libraries.mit.edu',
  'library.princeton.edu', 'library.yale.edu', 'bodleian.ox.ac.uk', 'lib.cam.ac.uk',
];

/** Tier 5 — religion & ancient texts (primary sources). */
const RELIGION = [
  'sefaria.org', 'quran.com', 'biblegateway.com',
  'sacred-texts.com', 'perseus.tufts.edu', 'deadseascrolls.org.il',
];

/** Tier 6 — law. */
const LAW = ['law.cornell.edu', 'oyez.org', 'justia.com'];

/** Tier 7 — reliable data. */
const DATA = ['ourworldindata.org', 'data.gov', 'data.worldbank.org', 'data.un.org'];

/** Tier 8 — general knowledge. Orientation only; must be corroborated. */
export const TIER8_GENERAL = ['britannica.com', 'plato.stanford.edu', 'iep.utm.edu', 'wikipedia.org'];

// ---------------------------------------------------------------------
// Topic router — plain regex, no model call, no cost.
// ---------------------------------------------------------------------
export type Topic = 'health' | 'law' | 'religion' | 'economics' | 'science' | 'history' | 'philosophy' | 'general';

const TOPIC_RE: [Topic, RegExp][] = [
  ['health', /\b(health|medical|medicine|disease|virus|vaccin\w*|cancer|drug|patient|clinical|mortality|epidemic|pandemic|mental health|nutrition|obesity|smoking|abortion|opioid|therapy|diagnos\w*)\b/i],
  ['law', /\b(law|legal|constitution\w*|amendment|court|supreme court|justice|statute|legislat\w*|congress|senate|bill|ruling|precedent|rights|unconstitutional|crime|sentenc\w*|prison|police)\b/i],
  ['religion', /\b(god|bible|biblical|quran|qur'?an|torah|talmud|scripture|christian\w*|muslim|islam\w*|jew\w*|judaism|hindu\w*|buddh\w*|church|mosque|synagogue|prophet|jesus|muhammad|moses|gospel|verse|theolog\w*|dead sea scrolls|apostle|salvation|sin)\b/i],
  ['economics', /\b(econom\w*|wage|inflation|unemploy\w*|gdp|tax\w*|tariff|trade|poverty|inequality|labor|labour|market|income|welfare|budget|deficit|debt|immigration|housing|minimum wage|union|recession)\b/i],
  ['science', /\b(physic\w*|chemistr\w*|biolog\w*|climate|carbon|emission|energy|nuclear|space|nasa|astronom\w*|evolution|genetic\w*|quantum|ai|artificial intelligence|algorithm|computer|math\w*|engineer\w*|temperature|species|ecosystem)\b/i],
  ['history', /\b(histor\w*|century|ancient|medieval|war|empire|revolution|colonial|slavery|civil war|founding|treaty|archive|primary source|1[0-9]{3}\b|dynasty|abolition)\b/i],
  ['philosophy', /\b(philosoph\w*|ethic\w*|moral\w*|metaphysic\w*|epistem\w*|utilitarian\w*|kant\w*|aristotl\w*|plato\w*|free will|consciousness|virtue|justice as|ontolog\w*)\b/i],
];

/** Detect the dominant topic of a claim. First match wins (ordered by specificity). */
export function detectTopic(text: string): Topic {
  const t = text || '';
  for (const [topic, re] of TOPIC_RE) if (re.test(t)) return topic;
  return 'general';
}

/** Topic → the domains most likely to hold authoritative evidence. */
const TOPIC_DOMAINS: Record<Topic, string[]> = {
  health:     [...GOV_HEALTH, ...INTL_HEALTH, 'ourworldindata.org'],
  law:        [...LAW, ...GOV_LAW],
  religion:   [...RELIGION, 'plato.stanford.edu', ...TIER4_LIBRARIES.slice(0, 3)],
  economics:  [...GOV_STATS, ...INTL_ECON, SSRN, 'ourworldindata.org'],
  science:    [ARXIV, ...GOV_SCIENCE, 'ourworldindata.org'],
  history:    ['loc.gov', 'archives.gov', 'perseus.tufts.edu', ...TIER4_LIBRARIES.slice(0, 3)],
  philosophy: ['plato.stanford.edu', 'iep.utm.edu', 'perseus.tufts.edu'],
  general:    [...INTL_GENERAL, 'ourworldindata.org'],
};

/** Present-day facts: statistics agencies and data portals, not journals. */
const FRESH_DOMAINS = [...GOV_STATS, ...GOV_HEALTH, ...INTL_ECON, ...INTL_HEALTH, ...DATA, 'congress.gov'];

/** Keep the list tight: relevance beats breadth, and shorter = fewer wasted tokens. */
const MAX_DOMAINS = 18;

/**
 * Choose the allow-list for a claim.
 * `fresh` claims (present-day state) skip the journals and go to the
 * statistical/data agencies that actually publish current figures.
 */
export function selectDomains(text: string, opts: { fresh?: boolean } = {}): string[] {
  const topic = detectTopic(text);
  const ordered = opts.fresh
    // Tier 2/3/7 first — journals can't answer "what is true today".
    ? [...FRESH_DOMAINS, ...TOPIC_DOMAINS[topic], ...TIER1_SCHOLARLY, ...TIER8_GENERAL]
    // Tier 1 scholarly + topic experts first; encyclopedias last, as orientation only.
    : [...TIER1_SCHOLARLY, ...TOPIC_DOMAINS[topic], ...TIER8_GENERAL];
  return dedupe(ordered).slice(0, MAX_DOMAINS);
}

/** Broad scholarly net for the "Find Sources" tool (no single claim to route on). */
export function defaultDomains(): string[] {
  return dedupe([...TIER1_SCHOLARLY, ARXIV, SSRN, ...GOV_HEALTH, ...GOV_STATS, ...INTL_ECON, ...TIER8_GENERAL]).slice(0, MAX_DOMAINS);
}

function dedupe(list: string[]): string[] {
  return Array.from(new Set(list));
}
