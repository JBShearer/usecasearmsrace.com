// search-cases: lean semantic search with lazy vocab loading
// Fast path: ILIKE for simple queries, vocab loads only when needed
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

const COLS = "id, title, raw_title, summary, article_quote, faction, impact, heaven_votes, hell_votes, source_url, source_tier, tech_types, data_types, modifier_terms, extraction, status, created_at, who_id, whom_id, action_id";

function json(body: unknown) {
  return new Response(JSON.stringify(body), { headers: { ...CORS, "Content-Type": "application/json" } });
}

// ============ LAZY VOCAB (loads once, caches 5min) ============
type Vocab = {
  entities: Map<string, { id: string; name: string }>;
  actions: Map<string, { id: string; verb: string }>;
  modifiers: Set<string>;
};
let vocabCache: { v: Vocab; t: number } | null = null;

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 \-']/g, " ").replace(/\s+/g, " ").trim();
}

async function getVocab(): Promise<Vocab> {
  if (vocabCache && Date.now() - vocabCache.t < 300_000) return vocabCache.v;

  const entities = new Map<string, { id: string; name: string }>();
  const actions = new Map<string, { id: string; verb: string }>();
  const modifiers = new Set<string>();

  // Parallel fetch - only what we need
  const [e, a, m] = await Promise.all([
    supa.from("entities").select("id, canonical_name, aliases").limit(2000),
    supa.from("actions").select("id, canonical_verb, aliases").limit(500),
    supa.from("modifiers").select("term").limit(1000),
  ]);

  for (const row of e.data ?? []) {
    const rec = { id: row.id, name: row.canonical_name };
    entities.set(norm(row.canonical_name), rec);
    for (const al of row.aliases ?? []) entities.set(norm(al), rec);
  }
  for (const row of a.data ?? []) {
    const rec = { id: row.id, verb: row.canonical_verb };
    actions.set(norm(row.canonical_verb), rec);
    for (const al of row.aliases ?? []) actions.set(norm(al), rec);
  }
  for (const row of m.data ?? []) modifiers.add(row.term);

  vocabCache = { v: { entities, actions, modifiers }, t: Date.now() };
  return vocabCache.v;
}

// ============ PARSER (greedy longest-match) ============
type Parsed = {
  who: { id: string; name: string } | null;
  whom: { id: string; name: string } | null;
  action: { id: string; verb: string } | null;
  entities: { id: string; name: string }[];
  mods: string[];
  free: string[];
};

const STOP = new Set(["the","a","an","of","to","in","on","for","and","or","is","are","was","were","by","with","at"]);

function parse(q: string, v: Vocab): Parsed {
  const tokens = norm(q).split(" ").filter(Boolean);
  const out: Parsed = { who: null, whom: null, action: null, entities: [], mods: [], free: [] };
  const seq: { type: string; idx: number; val: any }[] = [];
  let i = 0;

  while (i < tokens.length) {
    let matched = false;
    for (let len = Math.min(4, tokens.length - i); len >= 1; len--) {
      const gram = tokens.slice(i, i + len).join(" ");
      if (v.entities.has(gram)) {
        const ent = v.entities.get(gram)!;
        seq.push({ type: "entity", idx: seq.length, val: ent });
        out.entities.push(ent);
        i += len; matched = true; break;
      }
      if (v.actions.has(gram)) {
        const act = v.actions.get(gram)!;
        if (!out.action) { out.action = act; seq.push({ type: "action", idx: seq.length, val: act }); }
        i += len; matched = true; break;
      }
      if (v.modifiers.has(gram)) {
        out.mods.push(gram);
        i += len; matched = true; break;
      }
    }
    if (!matched) {
      const t = tokens[i];
      if (!STOP.has(t) && t.length > 2) out.free.push(t);
      i++;
    }
  }

  // Role assignment: entity before verb = WHO, after = WHOM
  const actIdx = seq.findIndex(s => s.type === "action");
  const ents = seq.filter(s => s.type === "entity");
  if (actIdx >= 0) {
    const before = ents.filter(e => e.idx < actIdx);
    const after = ents.filter(e => e.idx > actIdx);
    out.who = before[0]?.val ?? null;
    out.whom = after[0]?.val ?? null;
  } else if (ents.length >= 2) {
    out.who = ents[0].val;
    out.whom = ents[1].val;
  }
  return out;
}

// ============ SEARCH ============
async function search(q: string, p: Parsed) {
  const ors: string[] = [];

  // Structured matches (high value)
  const entIds = p.entities.map(e => e.id);
  if (entIds.length) {
    ors.push(`who_id.in.(${entIds.join(",")})`);
    ors.push(`whom_id.in.(${entIds.join(",")})`);
  }
  if (p.action) ors.push(`action_id.eq.${p.action.id}`);
  if (p.mods.length) {
    ors.push(`modifier_terms.ov.{${p.mods.map(m => '"' + m + '"').join(",")}}`);
  }

  // Text fallback
  for (const f of p.free.slice(0, 3)) {
    ors.push(`title.ilike.*${f}*`);
    ors.push(`summary.ilike.*${f}*`);
  }
  // Always include raw query terms
  ors.push(`title.ilike.*${q}*`);
  ors.push(`summary.ilike.*${q}*`);

  const { data } = await supa.from("cases").select(COLS)
    .eq("status", "live").or(ors.join(",")).limit(40);

  // Score results
  return (data ?? []).map(c => {
    let score = c.impact ?? 1;
    const matched: string[] = [];

    if (p.who && c.who_id === p.who.id) { score += 50; matched.push("WHO:" + p.who.name); }
    if (p.whom && c.whom_id === p.whom.id) { score += 50; matched.push("WHOM:" + p.whom.name); }
    if (p.who && c.whom_id === p.who.id) score += 15; // reversed
    if (p.whom && c.who_id === p.whom.id) score += 15;
    if (p.action && c.action_id === p.action.id) { score += 40; matched.push("ACTION:" + p.action.verb); }

    const terms: string[] = c.modifier_terms ?? [];
    for (const m of p.mods) if (terms.includes(m)) { score += 20; matched.push("#" + m); }

    const hay = ((c.title ?? "") + " " + (c.summary ?? "")).toLowerCase();
    if (hay.includes(q.toLowerCase())) score += 10;

    return { ...c, _score: score, _matched: matched };
  }).sort((a, b) => b._score - a._score).slice(0, 20);
}

// ============ WEB SEARCH ============
async function webSearch(q: string) {
  const out: { title: string; url: string; domain: string }[] = [];
  const enc = encodeURIComponent;

  const [gdelt, google] = await Promise.all([
    fetch("https://api.gdeltproject.org/api/v2/doc/doc?query=" + enc(q + " sourcelang:english")
      + "&mode=artlist&maxrecords=5&timespan=30d&format=json",
      { signal: AbortSignal.timeout(2000) })
      .then(async r => r.ok ? ((await r.json()).articles ?? []).slice(0, 5).map((a: any) => ({
        title: a.title ?? "", url: a.url ?? "", domain: a.domain ?? ""
      })) : []).catch(() => []),
    fetch("https://news.google.com/rss/search?q=" + enc(q) + "&hl=en-US&gl=US&ceid=US:en",
      { signal: AbortSignal.timeout(2000) })
      .then(async r => {
        if (!r.ok) return [];
        const xml = await r.text();
        return (xml.match(/<item>[\s\S]*?<\/item>/g) ?? []).slice(0, 5).map((it: string) => ({
          title: ((it.match(/<title>([\s\S]*?)<\/title>/) ?? [])[1] ?? "").replace(/<[^>]*>/g, ""),
          url: (it.match(/<link>([\s\S]*?)<\/link>/) ?? [])[1] ?? "",
          domain: (it.match(/<source url="([^"]*)"/) ?? [])[1] ?? ""
        })).filter((x: any) => x.url);
      }).catch(() => [])
  ]);
  out.push(...gdelt, ...google);
  const seen = new Set<string>();
  return out.filter(r => r.url && !seen.has(r.url) && seen.add(r.url)).slice(0, 8);
}

// ============ HANDLER ============
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const b = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const t0 = Date.now();

  // Single case by ID
  if (b.id) {
    const { data } = await supa.from("cases").select(COLS)
      .eq("id", b.id).in("status", ["live", "under_review"]).limit(1);
    return json({ results: data ?? [], ms: Date.now() - t0 });
  }

  // Browse: fast path, no vocab needed
  if (b.browse) {
    const { data } = await supa.from("cases").select(COLS).eq("status", "live")
      .order("created_at", { ascending: false }).limit(60);
    return json({ results: data ?? [], ms: Date.now() - t0 });
  }

  // Text search with semantic parsing
  const q = String(b.q ?? "").trim();
  if (q) {
    // Load vocab lazily (cached after first call)
    const vocab = await getVocab();
    const parsed = parse(q, vocab);

    // If we found structured matches, use semantic search
    const hasStructure = parsed.entities.length || parsed.action || parsed.mods.length;

    let results;
    if (hasStructure) {
      results = await search(q, parsed);
    } else {
      // Pure text search - faster
      const { data } = await supa.from("cases").select(COLS).eq("status", "live")
        .or(`title.ilike.%${q}%,raw_title.ilike.%${q}%,summary.ilike.%${q}%`)
        .limit(20);
      results = data ?? [];
    }

    // Web results if requested
    let web_results: unknown[] = [];
    if (b.web && q.length >= 3) {
      web_results = await webSearch(q.slice(0, 120));
    }

    return json({
      results,
      web_results,
      parsed: {
        who: parsed.who?.name ?? null,
        action: parsed.action?.verb ?? null,
        whom: parsed.whom?.name ?? null,
        entities: parsed.entities.map(e => e.name),
        modifiers: parsed.mods,
        free: parsed.free,
      },
      ms: Date.now() - t0
    });
  }

  // Empty query fallback
  const { data } = await supa.from("cases").select(COLS).eq("status", "live")
    .order("created_at", { ascending: false }).limit(60);
  return json({ results: data ?? [], ms: Date.now() - t0 });
});
