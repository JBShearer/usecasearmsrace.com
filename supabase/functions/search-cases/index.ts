// search-cases v5: semantic expansion + Tavily for speed
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
const TAVILY_KEY = Deno.env.get("TAVILY_API_KEY") || "";

function json(body: unknown) {
  return new Response(JSON.stringify(body),
    { headers: { ...CORS, "Content-Type": "application/json" } });
}
const CASE_COLS = "id, title, raw_title, summary, article_quote, "
  + "faction, impact, heaven_votes, hell_votes, source_url, source_tier, "
  + "tech_types, data_types, modifier_terms, extraction, status, created_at";

/* ---------------- graph vocabulary cache (60s TTL) ---------------- */
type Vocab = {
  t: number;
  entities: Map<string, { id: string; name: string }>;
  actions: Map<string, { id: string; verb: string }>;
  modifiers: Set<string>;
  expand: Map<string, { alt: string; weight: number }[]>;
};
let VOCAB: Vocab | null = null;
function normText(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 \-']/g, " ").replace(/\s+/g, " ").trim();
}
async function loadVocab(): Promise<Vocab> {
  if (VOCAB && Date.now() - VOCAB.t < 60_000) return VOCAB;
  const entities = new Map(); const actions = new Map();
  const modifiers = new Set<string>();
  const [e, a, m, x] = await Promise.all([
    supa.from("entities").select("id, canonical_name, aliases").limit(3000),
    supa.from("actions").select("id, canonical_verb, synonyms").limit(1500),
    supa.from("modifiers").select("term").order("support", { ascending: false }).limit(3000),
    supa.from("term_expansions").select("term, alt, weight").order("weight", { ascending: false }).limit(8000),
  ]);
  for (const row of e.data ?? []) {
    const rec = { id: row.id, name: row.canonical_name };
    entities.set(normText(row.canonical_name), rec);
    for (const al of row.aliases ?? []) entities.set(normText(al), rec);
  }
  for (const row of a.data ?? []) {
    const rec = { id: row.id, verb: row.canonical_verb };
    actions.set(normText(row.canonical_verb), rec);
    for (const al of row.synonyms ?? []) actions.set(normText(al), rec);
  }
  for (const row of m.data ?? []) modifiers.add(row.term);
  const expand = new Map<string, { alt: string; weight: number }[]>();
  for (const row of x.data ?? []) {
    const list = expand.get(row.term) ?? [];
    if (list.length < 8 && !list.some((l) => l.alt === row.alt)) {
      list.push({ alt: row.alt, weight: row.weight });
    }
    expand.set(row.term, list);
  }
  VOCAB = { t: Date.now(), entities, actions, modifiers, expand };
  return VOCAB;
}

/* ---------------- vocabulary-grounded parse ---------------- */
type Parsed = {
  who: { id: string; name: string } | null;
  whom: { id: string; name: string } | null;
  action: { id: string; verb: string } | null;
  entities: { id: string; name: string }[];
  mods: string[];
  free: string[];
  fuzzy: { from: string; to: string }[];
  expanded: Record<string, { alt: string; weight: number }[]>;
};
const STOP = new Set(["the","a","an","of","to","in","on","for","and","or",
  "did","does","do","is","are","was","were","by","with","at","who","what"]);

async function parseQuery(q: string, v: Vocab, noFuzzy = false): Promise<Parsed> {
  const tokens = normText(q).split(" ").filter(Boolean);
  const out: Parsed = { who: null, whom: null, action: null,
    entities: [], mods: [], free: [], fuzzy: [], expanded: {} };
  const seq: { type: string; val: unknown }[] = [];
  let i = 0;
  while (i < tokens.length) {
    let matched = false;
    for (let len = Math.min(4, tokens.length - i); len >= 1; len--) {
      const gram = tokens.slice(i, i + len).join(" ");
      if (v.entities.has(gram)) {
        const ent = v.entities.get(gram)!;
        seq.push({ type: "entity", val: ent }); out.entities.push(ent);
        i += len; matched = true; break;
      }
      if (v.actions.has(gram)) {
        const act = v.actions.get(gram)!;
        if (!out.action) { out.action = act; seq.push({ type: "action", val: act }); }
        i += len; matched = true; break;
      }
      if (v.modifiers.has(gram)) {
        out.mods.push(gram); seq.push({ type: "mod", val: gram });
        i += len; matched = true; break;
      }
    }
    if (!matched) {
      const t = tokens[i];
      if (!STOP.has(t) && t.length > 2) out.free.push(t);
      i++;
    }
  }
  // fuzzy snap
  if (!noFuzzy && out.free.length) {
    const candidates = out.free.filter((t) => t.length >= 4).slice(0, 5);
    if (candidates.length) {
      try {
        const { data } = await supa.rpc("fuzzy_snap", { tokens: candidates });
        for (const row of data ?? []) {
          const g = row.snapped as string;
          out.fuzzy.push({ from: row.token, to: g });
          out.free = out.free.filter((f) => f !== row.token);
          if (v.entities.has(g)) out.entities.push(v.entities.get(g)!);
          else if (v.actions.has(g) && !out.action) out.action = v.actions.get(g)!;
          else if (v.modifiers.has(g)) out.mods.push(g);
        }
      } catch (_) { /* fuzzy is best-effort */ }
    }
  }
  // expansion
  const wants = new Set<string>();
  for (const e of out.entities) wants.add(normText(e.name));
  if (out.action) wants.add(normText(out.action.verb));
  for (const m of out.mods) wants.add(m);
  for (const term of wants) {
    const alts = v.expand.get(term);
    if (alts?.length) out.expanded[term] = alts;
  }
  // role direction
  const actIdx = seq.findIndex((s) => s.type === "action");
  const ents = seq.map((s, idx) => ({ s, idx })).filter((x) => x.s.type === "entity");
  if (actIdx >= 0) {
    const before = ents.filter((x) => x.idx < actIdx);
    const after = ents.filter((x) => x.idx > actIdx);
    out.who = (before[0]?.s.val as Parsed["who"]) ?? null;
    out.whom = (after[0]?.s.val as Parsed["whom"]) ?? null;
  } else if (ents.length >= 2) {
    out.who = ents[0].s.val as Parsed["who"];
    out.whom = ents[1].s.val as Parsed["who"];
  }
  return out;
}

/* ---------------- structured search with expansion ---------------- */
async function structuredSearch(p: Parsed, v: Vocab, exclude: Set<string>) {
  const ors: string[] = [];
  const altEnt = new Map<string, number>();
  const altAct = new Map<string, number>();
  const altMod = new Map<string, number>();
  for (const [term, alts] of Object.entries(p.expanded)) {
    for (const a of alts) {
      if (exclude.has(a.alt)) continue;
      const e = v.entities.get(a.alt);
      if (e) { altEnt.set(e.id, Math.max(altEnt.get(e.id) ?? 0, a.weight)); continue; }
      const ac = v.actions.get(a.alt);
      if (ac) { altAct.set(ac.id, Math.max(altAct.get(ac.id) ?? 0, a.weight)); continue; }
      altMod.set(a.alt, Math.max(altMod.get(a.alt) ?? 0, a.weight));
    }
  }
  const entIds = [...new Set([...p.entities.map((e) => e.id), ...altEnt.keys()])];
  if (entIds.length) {
    ors.push(`who_id.in.(${entIds.join(",")})`);
    ors.push(`whom_id.in.(${entIds.join(",")})`);
  }
  const actIds = [...new Set([...(p.action ? [p.action.id] : []), ...altAct.keys()])];
  if (actIds.length) ors.push(`action_id.in.(${actIds.join(",")})`);
  const allMods = [...new Set([...p.mods, ...altMod.keys()])];
  if (allMods.length) {
    ors.push(`modifier_terms.ov.{${allMods.map((m) => '"' + m + '"').join(",")}}`);
  }
  for (const f of p.free.slice(0, 4)) {
    ors.push(`title.ilike.*${f}*`); ors.push(`summary.ilike.*${f}*`);
  }
  if (!ors.length) return [];
  const { data } = await supa.from("cases").select(CASE_COLS + ", who_id, whom_id, action_id")
    .eq("status", "live").or(ors.join(",")).limit(80);
  const scored = (data ?? []).map((c) => {
    let score = (c.impact ?? 0);
    const matched: string[] = [];
    if (p.who && c.who_id === p.who.id) { score += 40; matched.push("WHO:" + p.who.name); }
    if (p.whom && c.whom_id === p.whom.id) { score += 40; matched.push("WHOM:" + p.whom.name); }
    if (p.who && c.whom_id === p.who.id) score += 12;
    if (p.whom && c.who_id === p.whom.id) score += 12;
    for (const e of p.entities) {
      if (!p.who && !p.whom && (c.who_id === e.id || c.whom_id === e.id)) {
        score += 30; matched.push(e.name);
      }
    }
    if (p.action && c.action_id === p.action.id) { score += 30; matched.push("ACTION:" + p.action.verb); }
    if (altEnt.size && (altEnt.has(c.who_id) || altEnt.has(c.whom_id))) {
      const w = Math.max(altEnt.get(c.who_id) ?? 0, altEnt.get(c.whom_id) ?? 0);
      score += Math.round(30 * w); matched.push("~entity");
    }
    if (altAct.has(c.action_id)) {
      score += Math.round(24 * altAct.get(c.action_id)!); matched.push("~action");
    }
    const terms: string[] = c.modifier_terms ?? [];
    for (const m of p.mods) if (terms.includes(m)) { score += 15; matched.push("#" + m); }
    for (const [m, w] of altMod) if (terms.includes(m)) {
      score += Math.round(15 * w); matched.push("~" + m);
    }
    const hay = ((c.title ?? "") + " " + (c.summary ?? "")).toLowerCase();
    for (const f of p.free) {
      if ((c.title ?? "").toLowerCase().includes(f)) score += 10;
      else if (hay.includes(f)) score += 4;
    }
    return { c, score, matched };
  }).filter((x) => x.score > (x.c.impact ?? 0)).sort((a, b) => b.score - a.score).slice(0, 20);
  return scored.map((x) => ({ ...x.c, _score: x.score, _matched: x.matched }));
}

/* ---------------- Tavily web search (fast) ---------------- */
const webCache = new Map<string, { t: number; r: any[] }>();
const WEB_TTL = 10 * 60 * 1000;

async function webSearch(q: string) {
  const cached = webCache.get(q);
  if (cached && Date.now() - cached.t < WEB_TTL) return cached.r;

  // Always add AI context to searches for relevance
  const aiQuery = /\b(ai|artificial intelligence|machine learning|algorithm|automated)\b/i.test(q)
    ? q
    : `${q} AI artificial intelligence`;

  const out: { title: string; url: string; domain: string; snippet: string }[] = [];
  if (TAVILY_KEY) {
    try {
      const r = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: TAVILY_KEY,
          query: aiQuery,
          search_depth: "basic",
          topic: "news",
          max_results: 8,
          include_domains: [], // could restrict to news domains
          exclude_domains: ["pinterest.com", "instagram.com", "tiktok.com", "youtube.com"]
        }),
        signal: AbortSignal.timeout(3000)
      });
      if (r.ok) {
        const data = await r.json();
        for (const item of data.results ?? []) {
          // Filter out obviously irrelevant results
          const title = (item.title ?? "").toLowerCase();
          const snippet = (item.content ?? "").toLowerCase();
          const hasAI = /\b(ai|artificial intelligence|machine learning|algorithm|automat|facial|recognition|surveillance|predict)\b/.test(title + " " + snippet);
          if (!hasAI) continue; // Skip non-AI results

          out.push({
            title: item.title ?? "",
            url: item.url ?? "",
            domain: item.url ? new URL(item.url).hostname.replace(/^www\./, "") : "",
            snippet: item.content?.slice(0, 200) ?? ""
          });
        }
      }
    } catch (_) {}
  }
  // Fallback to Google News if Tavily fails or returns nothing
  if (!out.length) {
    try {
      const r = await fetch("https://news.google.com/rss/search?q=" + encodeURIComponent(aiQuery) + "&hl=en-US&gl=US&ceid=US:en",
        { signal: AbortSignal.timeout(1500) });
      if (r.ok) {
        const xml = await r.text();
        for (const it of (xml.match(/<item>[\s\S]*?<\/item>/g) ?? []).slice(0, 8)) {
          const title = ((it.match(/<title>([\s\S]*?)<\/title>/) ?? [])[1] ?? "").replace(/<[^>]*>/g, "");
          const url = (it.match(/<link>([\s\S]*?)<\/link>/) ?? [])[1] ?? "";
          const domain = (it.match(/<source url="([^"]*)"/) ?? [])[1] ?? "";
          // Filter for AI relevance
          if (/\b(ai|artificial|intelligence|machine|learning|algorithm|automat|facial|recognition|surveillance|predict)\b/i.test(title)) {
            if (url) out.push({ title, url, domain, snippet: "" });
          }
        }
      }
    } catch (_) {}
  }
  const seen = new Set<string>();
  const deduped = out.filter(r => r.url && !seen.has(r.url) && seen.add(r.url)).slice(0, 8);
  webCache.set(q, { t: Date.now(), r: deduped });
  if (webCache.size > 200) webCache.delete([...webCache.keys()][0]);
  return deduped;
}

/* ---------------- handler ---------------- */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const b = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const t0 = Date.now();

  // learning signal
  if (b.signal && b.signal.case_id && Array.isArray(b.signal.terms)) {
    const anon = req.headers.get("x-anon-id") ?? null;
    const terms = b.signal.terms.map((t: unknown) => normText(String(t)))
      .filter((t: string) => t && t.length <= 40).slice(0, 8);
    const event = ["open", "vote", "file"].includes(b.signal.event) ? b.signal.event : "open";
    if (terms.length) {
      await supa.from("search_signals").insert({ terms, case_id: b.signal.case_id, event, voter: anon });
    }
    return json({ ok: true, ms: Date.now() - t0 });
  }

  // single case by ID
  if (b.id) {
    const { data } = await supa.from("cases").select(CASE_COLS + ", who_id, whom_id, action_id")
      .eq("id", b.id).in("status", ["live", "under_review"]).limit(1);
    return json({ results: data ?? [], ms: Date.now() - t0 });
  }

  // browse
  if (b.browse) {
    const { data } = await supa.from("cases").select(CASE_COLS).eq("status", "live")
      .order("created_at", { ascending: false }).limit(60);
    return json({ results: data ?? [], ms: Date.now() - t0 });
  }

  // search
  const fastQ = String(b.q ?? "").trim();
  if (fastQ) {
    // web_only mode
    if (b.web_only) {
      const web_results = fastQ.length >= 3 ? await webSearch(fastQ.slice(0, 120)) : [];
      return json({ results: [], web_results, ms: Date.now() - t0 });
    }

    const v = await loadVocab();
    const p = await parseQuery(fastQ, v, !!b.no_fuzzy);
    const exclude = new Set<string>((Array.isArray(b.exclude) ? b.exclude : []).map((x: unknown) => normText(String(x))));

    // parallel: ILIKE + structured
    const ilikeQ = supa.from("cases").select(CASE_COLS).eq("status", "live")
      .or(`title.ilike.%${fastQ}%,raw_title.ilike.%${fastQ}%,summary.ilike.%${fastQ}%`).limit(20);
    const [ilike, structured] = await Promise.all([ilikeQ, structuredSearch(p, v, exclude)]);

    const seen = new Set<string>();
    const merged: unknown[] = [];
    for (const c of structured) {
      if (!seen.has((c as { id: string }).id)) { seen.add((c as { id: string }).id); merged.push(c); }
    }
    for (const c of ilike.data ?? []) {
      if (!seen.has(c.id)) { seen.add(c.id); merged.push(c); }
    }

    let web_results: unknown[] = [];
    if (b.web && fastQ.length >= 4) {
      web_results = await webSearch(fastQ.slice(0, 120));
    }

    return json({
      results: merged.slice(0, 20),
      web_results,
      parsed: {
        who: p.who?.name ?? null,
        action: p.action?.verb ?? null,
        whom: p.whom?.name ?? null,
        entities: p.entities.map((e) => e.name),
        modifiers: p.mods,
        free: p.free,
        fuzzy: p.fuzzy,
        expanded: p.expanded,
      },
      ms: Date.now() - t0
    });
  }

  // empty = browse
  const { data } = await supa.from("cases").select(CASE_COLS).eq("status", "live")
    .order("created_at", { ascending: false }).limit(60);
  return json({ results: data ?? [], ms: Date.now() - t0 });
});
