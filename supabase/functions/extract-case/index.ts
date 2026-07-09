/**
 * extract-case: Deterministic extraction for instant case creation
 *
 * Ported from prospector-desk 3/mine.py + hunt.py
 * FAST (<100ms) - no LLM calls, pure regex/keyword matching
 *
 * Pipeline:
 *   1. Extract title from article or fallback
 *   2. Detect organization (gazetteer + NER patterns)
 *   3. Map category via keyword matching
 *   4. Score impact (1-5) based on rights/scale terms
 *   5. Attempt basic WHO/ACTION/WHOM triple extraction
 *   6. Return structured case data ready for insertion
 *
 * The LLM steward can enrich this data async later.
 */

// =============================================================================
// Constants (ported from mine.py and hunt.py)
// =============================================================================

const CATEGORIES = [
  "Surveillance",
  "Discrimination",
  "Labor Exploitation",
  "Privacy Violation",
  "Manipulation",
  "Misinformation",
  "Accessibility",
  "Healthcare",
  "Education",
  "Safety",
  "Environmental",
  "Efficiency",
  "Automation",
  "Personalization",
  "Prediction",
  "Content Generation",
] as const;

type Category = (typeof CATEGORIES)[number];

// Categories that require human judgment - never auto-assign
const JUDGMENT_NEVER_AUTO = new Set([
  "Discrimination",
  "Labor Exploitation",
  "Privacy Violation",
  "Manipulation",
  "Misinformation",
]);

// AI-related terms (from hunt.py AI_LEXICON)
const AI_LEXICON = [
  "artificial intelligence",
  " ai ",
  "machine learning",
  "facial recognition",
  "face recognition",
  "algorithm",
  "chatbot",
  "large language model",
  "llm",
  "computer vision",
  "predictive",
  "neural network",
  "generative ai",
  "biometric",
  "automated decision",
  "deep learning",
  "ai-powered",
  "ai tool",
];

// Deployment signals (from hunt.py DEPLOY_SIGNALS)
const DEPLOY_SIGNALS = [
  "deploy",
  "deployed",
  "rolls out",
  "rolled out",
  "roll out",
  "adopt",
  "adopted",
  "implement",
  "implemented",
  "contract",
  "awarded",
  "approve",
  "approved",
  "launch",
  "launched",
  "install",
  "installed",
  "purchase",
  "purchased",
  "signed a deal",
  "pilot program",
  "now uses",
  "began using",
  "will use",
  "in use",
  "went live",
  "goes live",
  "expands use",
];

// Rights-affecting terms -> higher impact
const RIGHTS_TERMS = [
  "police",
  "law enforcement",
  "immigration",
  "benefits",
  "hiring",
  "sentencing",
  "welfare",
  "biometric",
  "surveillance",
  "medical decision",
  "school discipline",
  "eviction",
  "credit",
  "insurance claim",
];

// Scale terms -> higher impact
const SCALE_TERMS = [
  "statewide",
  "nationwide",
  "national",
  "millions",
  "every student",
  "all residents",
  "citywide",
  "districtwide",
  "across the country",
];

// Organization hint words (from hunt.py ORG_HINT_WORDS)
const ORG_HINT_WORDS = [
  "Department",
  "Police",
  "County",
  "City",
  "University",
  "District",
  "Agency",
  "Authority",
  "Hospital",
  "Inc",
  "Corp",
  "AI",
  "Administration",
  "Bureau",
  "Office",
  "Schools",
  "Health",
];

// Words that start phrases but aren't organizations
const STOP_STARTS = new Set([
  "The",
  "This",
  "That",
  "These",
  "Those",
  "But",
  "And",
  "For",
  "With",
  "From",
  "When",
  "While",
  "According",
  "Copyright",
  "Published",
  "Share",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]);

// Public body words (deployers vs vendors)
const PUBLIC_BODY_WORDS = [
  "Department",
  "County",
  "City",
  "Police",
  "District",
  "Agency",
  "Authority",
  "Schools",
  "University",
  "Hospital",
  "Bureau",
  "Administration",
  "Office",
];

// Gazetteer: known organizations (from hunt_config.json)
const GAZETTEER = [
  "Clearview AI",
  "Palantir",
  "Axon",
  "Flock Safety",
  "SoundThinking",
  "OpenAI",
  "Anthropic",
  "Google",
  "Microsoft",
  "Meta",
  "Amazon",
  "Babel Street",
  "Motorola Solutions",
  "Verkada",
  "PredPol",
  "Geolitica",
  "Workday",
  "HireVue",
  "UnitedHealth",
  "Cigna",
  "Epic Systems",
  "Department of Homeland Security",
  "ICE",
  "Customs and Border Protection",
  "FBI",
  "Department of Justice",
  "NYPD",
  "LAPD",
  "Los Angeles Unified",
];

// Trusted domains -> source tier 1
const TRUSTED_DOMAINS = [
  "npr.org",
  "reuters.com",
  "apnews.com",
  "propublica.org",
  "themarkup.org",
  "404media.co",
  "wired.com",
  "arstechnica.com",
  "technologyreview.com",
  "biometricupdate.com",
  "statnews.com",
  "govtech.com",
  "route-fifty.com",
  "statescoop.com",
  "edscoop.com",
  "cyberscoop.com",
  "fedscoop.com",
];

// =============================================================================
// Types
// =============================================================================

interface ExtractionRequest {
  url: string;
  title?: string; // Optional pre-extracted title
  text: string; // Article body text
}

interface ExtractedCase {
  title: string;
  organization: string;
  category: Category;
  impact: number; // 1-5
  source_url: string;
  source_tier: number; // 1 or 2
  description: string;
  vendor: string | null;
  subject: string | null; // WHO
  verb: string | null; // ACTION
  object: string | null; // WHOM
  story_arc: string | null;
  confidence: {
    ai_terms: number;
    deploy_signals: number;
    named_org: boolean;
    evidence_score: number;
  };
}

interface ExtractionResponse {
  success: boolean;
  case?: ExtractedCase;
  error?: string;
  processing_ms: number;
}

// =============================================================================
// CORS Configuration
// =============================================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-anon-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// =============================================================================
// Helper Functions
// =============================================================================

function has(text: string, ...words: string[]): boolean {
  const lower = text.toLowerCase();
  return words.some((w) => lower.includes(w));
}

function getSourceTier(url: string): number {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.endsWith(".gov") || host.endsWith(".mil") || host.endsWith(".edu")) {
      return 1;
    }
    if (TRUSTED_DOMAINS.some((d) => host.endsWith(d))) {
      return 1;
    }
  } catch {
    // Invalid URL, default to tier 2
  }
  return 2;
}

// =============================================================================
// Organization Extraction (from hunt.py _find_orgs)
// =============================================================================

function findOrganizations(text: string): { gazetteer: string[]; heuristic: string[] } {
  const lowerText = text.toLowerCase();

  // Gazetteer hits
  const gazetteerHits = GAZETTEER.filter((g) => lowerText.includes(g.toLowerCase()));

  // Heuristic pattern: capitalized multi-word phrases with org-like words
  const pattern =
    /\b([A-Z][A-Za-z&.'']+(?:\s+(?:of|the|and)\s+[A-Z][A-Za-z&.'']+|\s+[A-Z][A-Za-z&.'']+){0,4})/g;
  const counts: Record<string, number> = {};

  let match;
  while ((match = pattern.exec(text)) !== null) {
    const cand = match[1].trim();
    const first = cand.split(/\s+/)[0];

    if (STOP_STARTS.has(first) || cand.length < 4) continue;

    if (ORG_HINT_WORDS.some((w) => cand.includes(w))) {
      counts[cand] = (counts[cand] || 0) + 1;
    }
  }

  // Sort by frequency
  const heuristic = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);

  return { gazetteer: gazetteerHits, heuristic };
}

// =============================================================================
// Category Mapping (from mine.py map_category)
// =============================================================================

function mapCategory(title: string, body: string): Category {
  const text = (title + " " + body).toLowerCase();

  // Surveillance (machine-safe to auto-assign)
  if (
    has(
      text,
      "facial recognition",
      "face recognition",
      "face capture",
      "biometric",
      "license plate",
      "iris scan",
      "gait recognition"
    )
  ) {
    return "Surveillance";
  }

  // Healthcare
  if (has(text, "clinical", "patient", "diagnos", "medical", "health")) {
    return "Healthcare";
  }

  // Environmental
  if (
    has(
      text,
      "wildfire",
      "climate",
      "weather",
      "emission",
      "pollut",
      "environment",
      "species",
      "watershed",
      "flood"
    )
  ) {
    return "Environmental";
  }

  // Education
  if (has(text, "curriculum", "student", "tutor", "training course", "learning platform", "education")) {
    return "Education";
  }

  // Safety
  if (
    has(
      text,
      "fraud",
      "threat detect",
      "anomaly detect",
      "hazard",
      "safety inspection",
      "search and rescue",
      "counterfeit",
      "malware",
      "cybersecurity"
    )
  ) {
    return "Safety";
  }

  // Accessibility
  if (
    has(
      text,
      "accessib",
      "translation",
      "multilingual",
      "section 508",
      "sign language",
      "plain language",
      "transcription",
      "chatbot",
      "virtual assistant",
      "virtual agent",
      "call center"
    )
  ) {
    return "Accessibility";
  }

  // Content Generation
  if (has(text, "generative") && has(text, "summar", "draft", "write", "content", "document generation")) {
    return "Content Generation";
  }

  // Prediction
  if (has(text, "predict", "forecast", "estimat", "projection")) {
    return "Prediction";
  }

  // Personalization
  if (has(text, "personaliz", "recommend", "tailor")) {
    return "Personalization";
  }

  // Efficiency
  if (has(text, "efficien", "productivity", "streamlin", "reduce time", "workload")) {
    return "Efficiency";
  }

  // Default
  return "Automation";
}

function guardCategory(cat: Category): Category {
  return JUDGMENT_NEVER_AUTO.has(cat) ? "Automation" : cat;
}

// =============================================================================
// Impact Scoring (from mine.py map_impact + hunt.py assemble_case)
// =============================================================================

function mapImpact(text: string, sourceTier: number): number {
  const lower = text.toLowerCase();
  let impact = 2; // base

  // Rights-affecting terms
  if (RIGHTS_TERMS.some((w) => lower.includes(w))) {
    impact += 1;
  }

  // Scale terms
  if (SCALE_TERMS.some((w) => lower.includes(w))) {
    impact += 1;
  }

  // Tier 1 source boost
  if (sourceTier === 1) {
    impact = Math.min(5, impact + 1);
  }

  return Math.max(1, Math.min(5, impact));
}

// =============================================================================
// Evidence Scoring (from hunt.py score_candidate)
// =============================================================================

function scoreEvidence(
  title: string,
  body: string
): { score: number; aiTerms: number; deploySignals: number; namedOrg: boolean } {
  const text = (title + " " + body).toLowerCase();

  // AI terms
  const aiTerms = AI_LEXICON.filter((w) => text.includes(w)).length;
  if (aiTerms === 0) {
    return { score: 0, aiTerms: 0, deploySignals: 0, namedOrg: false };
  }

  let score = Math.min(aiTerms, 4) * 5; // up to 20

  // Deployment signals
  const deploySignals = DEPLOY_SIGNALS.filter((w) => text.includes(w)).length;
  score += Math.min(deploySignals, 5) * 8; // up to 40

  // Named organization
  const { gazetteer, heuristic } = findOrganizations(title + " " + body);
  const namedOrg = gazetteer.length > 0 || heuristic.length > 0;
  score += gazetteer.length > 0 ? 15 : heuristic.length > 0 ? 10 : 0;

  // Money specificity
  if (body.includes("$") || /\b\d+ (million|thousand|billion)\b/.test(text)) {
    score += 10;
  }

  // Proceeding specificity
  if (/\b(20\d\d|approved|unanimously|vote)\b/.test(text)) {
    score += 5;
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    aiTerms,
    deploySignals,
    namedOrg,
  };
}

// =============================================================================
// Basic Triple Extraction (WHO/ACTION/WHOM)
// =============================================================================

interface Triple {
  subject: string | null;
  verb: string | null;
  object: string | null;
}

function extractTriple(title: string, body: string, organization: string): Triple {
  const text = title + " " + body;
  const lower = text.toLowerCase();

  // Default subject is the detected organization
  let subject: string | null = organization !== "Unknown" ? organization : null;

  // Try to detect verb from common action patterns
  let verb: string | null = null;
  let object: string | null = null;

  // Verb detection patterns (common AI actions)
  const verbPatterns: [RegExp, string][] = [
    [/\b(deploys?|deployed)\b/i, "deploys"],
    [/\b(uses?|using)\b/i, "uses"],
    [/\b(monitors?|monitoring)\b/i, "monitors"],
    [/\b(tracks?|tracking)\b/i, "tracks"],
    [/\b(scans?|scanning)\b/i, "scans"],
    [/\b(collects?|collecting)\b/i, "collects"],
    [/\b(analyzes?|analyzing)\b/i, "analyzes"],
    [/\b(predicts?|predicting)\b/i, "predicts"],
    [/\b(denies?|denying|denied)\b/i, "denies"],
    [/\b(rejects?|rejecting|rejected)\b/i, "rejects"],
    [/\b(flags?|flagging|flagged)\b/i, "flags"],
    [/\b(automates?|automating)\b/i, "automates"],
    [/\b(replaces?|replacing)\b/i, "replaces"],
    [/\b(screens?|screening)\b/i, "screens"],
    [/\b(identifies?|identifying)\b/i, "identifies"],
  ];

  for (const [pattern, verbLabel] of verbPatterns) {
    if (pattern.test(title) || pattern.test(body.slice(0, 500))) {
      verb = verbLabel;
      break;
    }
  }

  // Object detection patterns (what's being affected)
  const objectPatterns: [RegExp, string][] = [
    [/\bfacial recognition\b.*?(?:of\s+)?(\w+(?:\s+\w+)?)/i, null], // Use match
    [/\blicense plate/i, "license plates"],
    [/\bjob applicant/i, "job applicants"],
    [/\bresume/i, "job applicants"],
    [/\bstudent/i, "students"],
    [/\bpatient/i, "patients"],
    [/\bcustomer/i, "customers"],
    [/\bcitizen/i, "citizens"],
    [/\bresident/i, "residents"],
    [/\bdriver/i, "drivers"],
    [/\bworker/i, "workers"],
    [/\bemployee/i, "employees"],
    [/\bclaim/i, "claims"],
    [/\bapplication/i, "applications"],
    [/\bbenefits?\b/i, "benefit recipients"],
    [/\bimmigra/i, "immigrants"],
    [/\bsuspect/i, "suspects"],
    [/\bpedestrian/i, "pedestrians"],
    [/\b(?:the )?public\b/i, "the public"],
  ];

  for (const [pattern, objLabel] of objectPatterns) {
    if (pattern.test(lower)) {
      object = objLabel;
      break;
    }
  }

  return { subject, verb, object };
}

// =============================================================================
// Story Arc Detection (mirrored from detect_story_arc in SQL)
// =============================================================================

function detectStoryArc(subject: string | null, verb: string | null, object: string | null): string | null {
  const combined = [subject || "", verb || "", object || ""].join(" ").toLowerCase();

  // Panopticon: surveillance, monitoring, tracking
  if (/surveil|monitor|track|watch|scan|camera|recogni/.test(combined)) {
    return "panopticon";
  }

  // Computer Says No: denials, rejections, automated decisions
  if (/deny|reject|flag|block|refuse|declin|automat.*decis/.test(combined)) {
    return "computer_says_no";
  }

  // Rise of Machines: automation replacing humans
  if (/replac|automat|eliminat|robot|job|workforce|layoff/.test(combined)) {
    return "rise_of_machines";
  }

  // Minority Report: prediction, pre-crime, profiling
  if (/predict|profile|forecast|pre.?crime|risk.*score|recidiv/.test(combined)) {
    return "minority_report";
  }

  // Data Harvest: collection, scraping, privacy
  if (/collect|harvest|scrap|data|privacy|consent|personal/.test(combined)) {
    return "data_harvest";
  }

  // Black Box: unexplainable AI, bias, discrimination
  if (/bias|discriminat|unexplain|black.?box|opaque|unfair/.test(combined)) {
    return "black_box";
  }

  return null;
}

// =============================================================================
// Description Extraction
// =============================================================================

function extractDescription(body: string): string {
  // Find sentences containing AI terms
  const sentences = body.split(/(?<=[.!?])\s+/);
  const relevant = sentences.filter((s) => AI_LEXICON.some((w) => s.toLowerCase().includes(w))).slice(0, 3);

  let desc = relevant.join(" ") || body.slice(0, 300);

  if (desc.length > 480) {
    desc = desc.slice(0, 477) + "...";
  }

  return desc.trim();
}

// =============================================================================
// Main Extraction Function
// =============================================================================

function extractCase(req: ExtractionRequest): ExtractedCase {
  const { url, title: providedTitle, text } = req;

  // Use provided title or extract from first line / capitalize words
  const title = (providedTitle || text.split("\n")[0] || "Untitled").slice(0, 200);

  // Find organizations
  const { gazetteer, heuristic } = findOrganizations(title + " " + text);

  // Prefer public bodies over vendors
  const publicBodies = heuristic.filter((o) => PUBLIC_BODY_WORDS.some((w) => o.includes(w)));

  const organization =
    publicBodies[0] || gazetteer[0] || heuristic[0] || "Unknown";

  // Vendor is a gazetteer hit that isn't the organization
  const vendor = gazetteer.find((g) => g !== organization) || null;

  // Category and impact
  const rawCategory = mapCategory(title, text);
  const category = guardCategory(rawCategory);
  const sourceTier = getSourceTier(url);
  const impact = mapImpact(title + " " + text, sourceTier);

  // Evidence scoring
  const evidence = scoreEvidence(title, text);

  // Triple extraction
  const triple = extractTriple(title, text, organization);

  // Story arc
  const storyArc = detectStoryArc(triple.subject, triple.verb, triple.object);

  // Description
  const description = extractDescription(text);

  return {
    title,
    organization: organization.slice(0, 120),
    category,
    impact,
    source_url: url,
    source_tier: sourceTier,
    description,
    vendor,
    subject: triple.subject,
    verb: triple.verb,
    object: triple.object,
    story_arc: storyArc,
    confidence: {
      ai_terms: evidence.aiTerms,
      deploy_signals: evidence.deploySignals,
      named_org: evidence.namedOrg,
      evidence_score: evidence.score,
    },
  };
}

// =============================================================================
// HTTP Handler
// =============================================================================

Deno.serve(async (req: Request): Promise<Response> => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  const start = performance.now();

  try {
    // Only POST
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
        status: 405,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    // Validate input
    if (!body.url || typeof body.url !== "string") {
      return new Response(JSON.stringify({ success: false, error: "Missing url" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    if (!body.text || typeof body.text !== "string") {
      return new Response(JSON.stringify({ success: false, error: "Missing text (article body)" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Extract case
    const extracted = extractCase({
      url: body.url,
      title: body.title,
      text: body.text,
    });

    const processingMs = Math.round(performance.now() - start);

    const response: ExtractionResponse = {
      success: true,
      case: extracted,
      processing_ms: processingMs,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    const processingMs = Math.round(performance.now() - start);
    console.error("extract-case error:", err);

    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
        processing_ms: processingMs,
      }),
      {
        status: 500,
        headers: { ...CORS, "Content-Type": "application/json" },
      }
    );
  }
});
