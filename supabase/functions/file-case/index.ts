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

const RIGHTS_TERMS = ["arrest", "detain", "deny", "reject", "terminate", "fire", "evict", "deport", "suspend", "expel", "ban"];
const SCALE_TERMS = ["nationwide", "statewide", "citywide", "million", "billion", "thousands", "mass", "widespread"];
const AI_TERMS = ["ai", "artificial intelligence", "machine learning", "algorithm", "automated", "predictive", "neural", "deep learning"];
const DEPLOY_VERBS = ["deploy", "use", "implement", "adopt", "install", "launch", "roll out", "introduce"];
const WHOM_PATTERNS = ["student", "patient", "resident", "citizen", "customer", "employee", "worker", "applicant", "driver", "user"];

function extractAllOrgs(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  // Check gazetteer
  for (const [key, val] of Object.entries(GAZETTEER)) {
    if (lower.includes(key) && !found.includes(val.name)) {
      found.push(val.name);
      if (found.length >= 4) break;
    }
  }
  // NER-style: capitalized multi-word phrases
  if (found.length < 4) {
    const matches = text.match(/(?:[A-Z][a-z]+\s+){1,3}(?:Department|Agency|Police|School|University|Hospital|Corporation|Inc|LLC|Company)/g) || [];
    for (const m of matches) {
      const name = m.trim();
      if (!found.includes(name)) {
        found.push(name);
        if (found.length >= 4) break;
      }
    }
  }
  return found;
}

function extractOrg(text: string): string | null {
  const orgs = extractAllOrgs(text);
  return orgs[0] || null;
}

function extractAllActions(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const verb of DEPLOY_VERBS) {
    if (lower.includes(verb) && !found.includes(verb + "s")) {
      found.push(verb + "s");
      if (found.length >= 4) break;
    }
  }
  return found;
}

function extractAllWhom(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const pattern of WHOM_PATTERNS) {
    if (lower.includes(pattern) && !found.includes(pattern + "s")) {
      found.push(pattern + "s");
      if (found.length >= 4) break;
    }
  }
  return found;
}

function extractTriple(text: string): { who: string | null; action: string | null; whom: string | null; who_choices: string[]; action_choices: string[]; whom_choices: string[] } {
  const who_choices = extractAllOrgs(text);
  const action_choices = extractAllActions(text);
  const whom_choices = extractAllWhom(text);

  return {
    who: who_choices[0] || null,
    action: action_choices[0] || null,
    whom: whom_choices[0] || null,
    who_choices,
    action_choices,
    whom_choices,
  };
}

function extractImpact(text: string, sourceTier: number): number {
  const lower = text.toLowerCase();
  let impact = 1;
  if (RIGHTS_TERMS.some(t => lower.includes(t))) impact += 1;
  if (SCALE_TERMS.some(t => lower.includes(t))) impact += 1;
  if (AI_TERMS.some(t => lower.includes(t))) impact += 1;
  if (sourceTier === 1) impact += 1;
  return Math.min(5, impact);
}

interface ArticleData {
  title: string;
  text: string;
  summary: string;
  quote: string;
}

async function fetchArticle(url: string): Promise<ArticleData | null> {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "UCAR-Bot/1.0 (AI Use Case Registry)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const html = await r.text();

    // Extract title: prefer Open Graph, fall back to <title>
    const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1]
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)?.[1];
    const titleTag = html.match(/<title[^>]*>([^<]+)</i)?.[1]?.trim();
    const title = ogTitle?.trim() || titleTag || "";

    // Extract description: prefer Open Graph
    const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1]
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i)?.[1]
      || html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1];

    // Strip HTML for text
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .slice(0, 20000);

    // Extract summary: OG desc or first AI-relevant paragraph
    let summary = ogDesc?.trim() || "";
    if (!summary) {
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 60);
      for (const s of sentences.slice(0, 20)) {
        if (AI_TERMS.some(t => s.toLowerCase().includes(t))) {
          summary = s.trim().slice(0, 300);
          break;
        }
      }
    }

    // Extract quote: find quoted text or impactful sentence
    let quote = "";
    const quoteMatch = text.match(/"([^"]{40,200})"/);
    if (quoteMatch) {
      quote = quoteMatch[1];
    } else {
      // Find sentence with rights term + AI term
      for (const s of text.split(/[.!?]+/).slice(0, 30)) {
        const lower = s.toLowerCase();
        if (RIGHTS_TERMS.some(t => lower.includes(t)) && AI_TERMS.some(t => lower.includes(t))) {
          quote = s.trim().slice(0, 250);
          break;
        }
      }
    }

    return { title, text, summary, quote };
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

  try {
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

    // dedupe by url hash (do this first, before rate limit check)
    const digest = await crypto.subtle.digest("SHA-1",
      new TextEncoder().encode(parsed.href));
    const externalId = "web:" + Array.from(new Uint8Array(digest))
      .map((x) => x.toString(16).padStart(2, "0")).join("").slice(0, 20);
    const { data: existing } = await supa.from("cases").select("id, status")
      .eq("external_id", externalId).maybeSingle();
    if (existing) return json(200, { ok: true, dedupe: true, case_id: existing.id });

    // rate limit: 5 filings/hour/identity (skip if submitter column doesn't exist)
    try {
      const since = new Date(Date.now() - 3600_000).toISOString();
      const { count } = await supa.from("cases")
        .select("id", { count: "exact", head: true })
        .eq("submitter", userId).gte("created_at", since);
      if ((count ?? 0) >= 5) return json(429, { error: "filing cooldown, try later" });
    } catch { /* submitter column may not exist, skip rate limit */ }

    // Fetch and extract (deterministic, fast)
    const article = await fetchArticle(parsed.href);
    const combinedText = article ? `${article.title} ${article.text}` : parsed.hostname;
    const sourceTier = /\.(gov|mil|edu)$/.test(parsed.hostname) ? 1 : 2;

    const impact = extractImpact(combinedText, sourceTier);
    const triple = extractTriple(combinedText);

    // Build better title from triple
    let smartTitle = article?.title || "";
    if (triple.who && triple.action && triple.whom) {
      smartTitle = `${triple.who} ${triple.action} ${triple.whom}`;
    } else if (triple.who && triple.action) {
      smartTitle = `${triple.who} ${triple.action} AI`;
    } else if (!smartTitle) {
      smartTitle = `AI deployment at ${triple.who || parsed.hostname}`;
    }

    // Build case row - go straight to 'live' with basic extraction
    // Note: schema uses 'faction' not 'category' - faction is heaven/hell/unaligned
    const row: Record<string, unknown> = {
      external_id: externalId,
      raw_title: article?.title || `Filed from ${parsed.hostname}`,
      title: smartTitle.slice(0, 200),
      summary: article?.summary?.slice(0, 500) || null,
      article_quote: article?.quote?.slice(0, 300) || null,
      source_url: parsed.href,
      source_tier: sourceTier,
      faction: "unaligned", // Deterministic extraction can't judge good/evil
      impact,
      status: "live", // Instant live! Not staged.
      extraction: {
        deterministic: true,
        who_choices: triple.who_choices,
        action_choices: triple.action_choices,
        whom_choices: triple.whom_choices,
        extracted_at: new Date().toISOString(),
      },
    };

    // Try with submitter first
    const { data: kase, error } = await supa.from("cases")
      .insert({ ...row, submitter: userId }).select("id").single();

    if (error || !kase) {
      // Fallback: try without submitter column (older schema)
      const { data: kase2, error: error2 } = await supa.from("cases")
        .insert(row).select("id").single();
      if (error2 || !kase2) return json(500, { error: error2?.message ?? "insert failed" });
      // Queue for LLM enrichment
      await supa.from("extraction_queue").insert({ case_id: kase2.id }).catch(() => {});
      return json(200, { ok: true, case_id: kase2.id, instant: true, ms: Date.now() - t0 });
    }

    // Queue for LLM enrichment (reenactment, story, etc.)
    await supa.from("extraction_queue").insert({ case_id: kase.id }).catch(() => {});

    return json(200, { ok: true, case_id: kase.id, instant: true, ms: Date.now() - t0 });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : "unknown error" });
  }
});
