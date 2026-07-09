// file-case v2: instant deterministic extraction + async LLM enrichment
// 1. Accept URL, rate limit, dedupe
// 2. Fetch article, run deterministic extraction (fast)
// 3. Insert as 'live' with basic fields immediately
// 4. Queue for LLM enrichment (reenactment, story, deep extraction)

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-anon-id",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const supa = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ============ DETERMINISTIC EXTRACTION (ported from extract-case) ============ */

const GAZETTEER: Record<string, { name: string; type: string }> = {
  "clearview ai": { name: "Clearview AI", type: "vendor" },
  "clearview": { name: "Clearview AI", type: "vendor" },
  "palantir": { name: "Palantir", type: "vendor" },
  "amazon": { name: "Amazon", type: "vendor" },
  "aws": { name: "Amazon Web Services", type: "vendor" },
  "google": { name: "Google", type: "vendor" },
  "meta": { name: "Meta", type: "vendor" },
  "facebook": { name: "Meta", type: "vendor" },
  "microsoft": { name: "Microsoft", type: "vendor" },
  "openai": { name: "OpenAI", type: "vendor" },
  "ibm": { name: "IBM", type: "vendor" },
  "nypd": { name: "NYPD", type: "government" },
  "lapd": { name: "LAPD", type: "government" },
  "nsa": { name: "NSA", type: "government" },
  "fbi": { name: "FBI", type: "government" },
  "ice": { name: "ICE", type: "government" },
  "dhs": { name: "DHS", type: "government" },
  "cbp": { name: "CBP", type: "government" },
  "irs": { name: "IRS", type: "government" },
  "tsa": { name: "TSA", type: "government" },
};

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "Surveillance": ["surveillance", "facial recognition", "face recognition", "tracking", "monitoring", "spying", "wiretap", "cctv", "camera", "biometric"],
  "Healthcare": ["hospital", "patient", "medical", "health", "diagnosis", "treatment", "clinical", "doctor", "nurse", "sepsis", "cancer"],
  "Education": ["school", "student", "teacher", "university", "college", "classroom", "education", "academic", "campus"],
  "Law Enforcement": ["police", "arrest", "crime", "officer", "detective", "investigation", "criminal", "enforcement"],
  "Employment": ["hiring", "recruitment", "employee", "worker", "job", "resume", "interview", "workplace", "hr"],
  "Financial": ["bank", "loan", "credit", "insurance", "mortgage", "financial", "fraud", "trading"],
  "Government": ["government", "federal", "state", "agency", "regulation", "policy", "public sector"],
  "Transportation": ["driving", "vehicle", "traffic", "autonomous", "self-driving", "uber", "lyft", "transit"],
  "Social Media": ["social media", "content moderation", "recommendation", "algorithm", "feed", "viral"],
  "Retail": ["retail", "shopping", "store", "customer", "checkout", "inventory"],
};

const RIGHTS_TERMS = ["arrest", "detain", "deny", "reject", "terminate", "fire", "evict", "deport", "suspend", "expel", "ban"];
const SCALE_TERMS = ["nationwide", "statewide", "citywide", "million", "billion", "thousands", "mass", "widespread"];
const AI_TERMS = ["ai", "artificial intelligence", "machine learning", "algorithm", "automated", "predictive", "neural", "deep learning"];
const DEPLOY_VERBS = ["deploy", "use", "implement", "adopt", "install", "launch", "roll out", "introduce"];
const WHOM_PATTERNS = ["student", "patient", "resident", "citizen", "customer", "employee", "worker", "applicant", "driver", "user"];

function extractOrg(text: string): string | null {
  const lower = text.toLowerCase();
  // Check gazetteer first
  for (const [key, val] of Object.entries(GAZETTEER)) {
    if (lower.includes(key)) return val.name;
  }
  // NER-style: capitalized multi-word phrases
  const matches = text.match(/(?:[A-Z][a-z]+\s+){1,3}(?:Department|Agency|Police|School|University|Hospital|Corporation|Inc|LLC|Company)/g);
  if (matches?.length) return matches[0].trim();
  return null;
}

function extractCategory(text: string): string {
  const lower = text.toLowerCase();
  let best = "Automation";
  let bestScore = 0;
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.filter(k => lower.includes(k)).length;
    if (score > bestScore) { bestScore = score; best = cat; }
  }
  return best;
}

function extractImpact(text: string, sourceTier: number): number {
  const lower = text.toLowerCase();
  let impact = 1;
  // Rights-affecting terms
  if (RIGHTS_TERMS.some(t => lower.includes(t))) impact += 1;
  // Scale terms
  if (SCALE_TERMS.some(t => lower.includes(t))) impact += 1;
  // AI terms (confirms relevance)
  if (AI_TERMS.some(t => lower.includes(t))) impact += 1;
  // First-party source bonus
  if (sourceTier === 1) impact += 1;
  return Math.min(5, impact);
}

function extractTriple(text: string): { who: string | null; action: string | null; whom: string | null } {
  const lower = text.toLowerCase();
  const who = extractOrg(text);
  let action: string | null = null;
  let whom: string | null = null;

  for (const verb of DEPLOY_VERBS) {
    if (lower.includes(verb)) { action = verb + "s"; break; }
  }
  for (const pattern of WHOM_PATTERNS) {
    if (lower.includes(pattern)) { whom = pattern + "s"; break; }
  }

  return { who, action, whom };
}

async function fetchArticle(url: string): Promise<{ title: string; text: string } | null> {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "UCAR-Bot/1.0 (AI Use Case Registry)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const html = await r.text();
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)</i);
    const title = titleMatch?.[1]?.trim() || "";
    // Strip HTML for text
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .slice(0, 15000);
    return { title, text };
  } catch {
    return null;
  }
}

/* ============ MAIN HANDLER ============ */

async function resolveUser(req: Request): Promise<string | null> {
  const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (jwt) {
    const { data } = await supa.auth.getUser(jwt);
    if (data.user?.id) return data.user.id;
  }
  const anon = req.headers.get("x-anon-id") ?? "";
  return UUID_RE.test(anon) ? anon.toLowerCase() : null;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body),
    { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const t0 = Date.now();

  const userId = await resolveUser(req);
  if (!userId) return json(401, { error: "identity required" });

  const b = await req.json().catch(() => ({}));
  const url = String(b.url ?? "").trim();
  let parsed: URL;
  try { parsed = new URL(url); } catch { return json(400, { error: "invalid url" }); }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return json(400, { error: "invalid url" });
  }

  // rate limit: 5 filings/hour/identity
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await supa.from("cases")
    .select("id", { count: "exact", head: true })
    .eq("submitter", userId).gte("created_at", since);
  if ((count ?? 0) >= 5) return json(429, { error: "filing cooldown, try later" });

  // dedupe by url hash
  const digest = await crypto.subtle.digest("SHA-1",
    new TextEncoder().encode(parsed.href));
  const externalId = "web:" + Array.from(new Uint8Array(digest))
    .map((x) => x.toString(16).padStart(2, "0")).join("").slice(0, 20);
  const { data: existing } = await supa.from("cases").select("id, status")
    .eq("external_id", externalId).maybeSingle();
  if (existing) return json(200, { ok: true, dedupe: true, case_id: existing.id });

  // Fetch and extract (deterministic, fast)
  const article = await fetchArticle(parsed.href);
  const combinedText = article ? `${article.title} ${article.text}` : parsed.hostname;
  const sourceTier = /\.(gov|mil|edu)$/.test(parsed.hostname) ? 1 : 2;

  const category = extractCategory(combinedText);
  const impact = extractImpact(combinedText, sourceTier);
  const triple = extractTriple(combinedText);
  const org = extractOrg(combinedText);

  // Build case row - go straight to 'live' with basic extraction
  const row = {
    external_id: externalId,
    raw_title: article?.title || `Filed from ${parsed.hostname}`,
    title: article?.title || `AI deployment at ${org || parsed.hostname}`,
    source_url: parsed.href,
    source_tier: sourceTier,
    category,
    impact,
    status: "live", // Instant live! Not staged.
    extraction: {
      deterministic: true,
      who_choices: triple.who ? [triple.who] : [],
      action_choices: triple.action ? [triple.action] : [],
      whom_choices: triple.whom ? [triple.whom] : [],
      extracted_at: new Date().toISOString(),
    },
    submitter: userId,
  };

  const { data: kase, error } = await supa.from("cases")
    .insert(row).select("id").single();

  if (error || !kase) {
    // Fallback: try without submitter column (older schema)
    const { submitter, ...rowNoSubmitter } = row;
    const { data: kase2, error: error2 } = await supa.from("cases")
      .insert(rowNoSubmitter).select("id").single();
    if (error2 || !kase2) return json(500, { error: error2?.message ?? "insert failed" });
    // Queue for LLM enrichment
    await supa.from("extraction_queue").insert({ case_id: kase2.id }).catch(() => {});
    return json(200, { ok: true, case_id: kase2.id, instant: true, ms: Date.now() - t0 });
  }

  // Queue for LLM enrichment (reenactment, story, etc.)
  await supa.from("extraction_queue").insert({ case_id: kase.id }).catch(() => {});

  return json(200, { ok: true, case_id: kase.id, instant: true, ms: Date.now() - t0 });
});
