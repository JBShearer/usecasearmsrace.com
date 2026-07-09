// search-cases v4: the semantic engine surfaced.
//
// The parser is VOCABULARY-GROUNDED, not part-of-speech guesswork. The
// query is greedy longest-matched (up to 4-grams) against the live graph:
// entity canonical names + aliases, action verbs + aliases, and the
// community's modifier terms. Compound nouns and proper nouns fall out of
// longest-match for free ("cobb county police", "facial recognition").
// Role direction comes from position: an entity before a matched verb is
// WHO, after it is WHOM. Every modifier the community files becomes parser
// vocabulary, so the engine gets smarter as the wiki layer grows.
//
// Paths, all SQL, no embeddings on the hot path:
//   {browse:true, category?}      recent live cases (boot feed)
//   {q}                           fast ILIKE + parsed structured scoring
//   {q, web:true}                 adds cached GDELT+GNews prospects
//   {id}                          one case + canonical triple names
//   {who,action,whom, deep:true}  explicit structured triple query

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
function json(body: unknown) {
  return new Response(JSON.stringify(body),
    { headers: { ...CORS, "Content-Type": "application/json" } });
}
const CASE_COLS = "id, title, raw_title, summary, article_quote, category, "
  + "faction, impact, heaven_votes, hell_votes, source_url, source_tier, "
  + "tech_types, data_types, modifier_terms, extraction, status, created_at";

/* ---------------- graph vocabulary cache (60s TTL) ---------------- */
type Vocab = {
  t: number;
  entities: Map<string, { id: string; name: string }>;
  actions: Map<string, { id: string; verb: string }>;
  modifiers: Set<string>;
};
let VOCAB: Vocab | null = null;
function normText(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 \-']/g, " ")
    .replace(/\s+/g, " ").trim();
}
async function loadVocab(): Promise<Vocab> {
  if (VOCAB && Date.now() - VOCAB.t < 60_000) return VOCAB;
  const entities = new Map(); const actions = new Map();
  const modifiers = new Set<string>();
  const [e, a, m] = await Promise.all([
    supa.from("entities").select("id, canonical_name, aliases").limit(3000),
    supa.from("actions").select("id, canonical_verb, aliases").limit(1500),
    supa.from("modifiers").select("term").order("support", { ascending: false })
      .limit(3000),
  ]);
  for (const row of e.data ?? []) {
    const rec = { id: row.id, name: row.canonical_name };
    entities.set(normText(row.canonical_name), rec);
    for (const al of row.aliases ?? []) entities.set(normText(al), rec);
  }
  for (const row of a.data ?? []) {
    const rec = { id: row.id, verb: row.canonical_verb };
    actions.set(normText(row.canonical_verb), rec);
    for (const al of row.aliases ?? []) actions.set(normText(al), rec);
  }
  for (const row of m.data ?? []) modifiers.add(row.term);
  VOCAB = { t: Date.now(), entities, actions, modifiers };
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
};
const STOP = new Set(["the","a","an","of","to","in","on","for","and","or",
  "did","does","do","is","are","was","were","by","with","at","who","what"]);
function parseQuery(q: string, v: Vocab): Parsed {
  const tokens = normText(q).split(" ").filter(Boolean);
  const out: Parsed = { who: null, whom: null, action: null,
    entities: [], mods: [], free: [] };
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
  // role direction: entity before the verb is WHO, after is WHOM
  const actIdx = seq.findIndex((s) => s.type === "action");
  const ents = seq.map((s, idx) => ({ s, idx }))
    .filter((x) => x.s.type === "entity");
  if (actIdx >= 0) {
    const before = ents.filter((x) => x.idx < actIdx);
    const after = ents.filter((x) => x.idx > actIdx);
    out.who = (before[0]?.s.val as Parsed["who"]) ?? null;
    out.whom = (after[0]?.s.val as Parsed["whom"]) ?? null;
  } else if (ents.length >= 2) {
    out.who = ents[0].s.val as Parsed["who"];
    out.whom = ents[1].s.val as Parsed["whom"];
  }
  return out;
}

/* ---------------- structured candidate fetch + scoring ---------------- */
async function structuredSearch(p: Parsed, category: string | null) {
  const ors: string[] = [];
  const entIds = p.entities.map((e) => e.id);
  if (entIds.length) {
    ors.push(`who_id.in.(${entIds.join(",")})`);
    ors.push(`whom_id.in.(${entIds.join(",")})`);
  }
  if (p.action) ors.push(`action_id.eq.${p.action.id}`);
  if (p.mods.length) {
    ors.push(`modifier_terms.ov.{${p.mods.map((m) => '"' + m + '"').join(",")}}`);
  }
  for (const f of p.free.slice(0, 4)) {
    ors.push(`title.ilike.*${f}*`); ors.push(`summary.ilike.*${f}*`);
  }
  if (!ors.length) return [];
  let q = supa.from("cases").select(CASE_COLS + ", who_id, whom_id, action_id")
    .eq("status", "live").or(ors.join(",")).limit(80);
  if (category) q = q.eq("category", category);
  const { data } = await q;
  const scored = (data ?? []).map((c) => {
    let score = (c.impact ?? 0);
    const matched: string[] = [];
    if (p.who && c.who_id === p.who.id) { score += 40; matched.push("WHO: " + p.who.name); }
    if (p.whom && c.whom_id === p.whom.id) { score += 40; matched.push("WHOM: " + p.whom.name); }
    // reversed direction still counts, just less
    if (p.who && c.whom_id === p.who.id) score += 12;
    if (p.whom && c.who_id === p.whom.id) score += 12;
    for (const e of p.entities) {
      if (!p.who && !p.whom && (c.who_id === e.id || c.whom_id === e.id)) {
        score += 30; matched.push(e.name);
      }
    }
    if (p.action && c.action_id === p.action.id) {
      score += 30; matched.push("ACTION: " + p.action.verb);
    }
    const terms: string[] = c.modifier_terms ?? [];
    for (const m of p.mods) if (terms.includes(m)) { score += 15; matched.push("#" + m); }
    const hay = ((c.title ?? "") + " " + (c.summary ?? "")).toLowerCase();
    for (const f of p.free) {
      if ((c.title ?? "").toLowerCase().includes(f)) score += 10;
      else if (hay.includes(f)) score += 4;
    }
    return { c, score, matched };
  }).filter((x) => x.score > (x.c.impact ?? 0))
    .sort((a, b) => b.score - a.score).slice(0, 20);
  return scored.map((x) => ({ ...x.c, _score: x.score, _matched: x.matched }));
}

/* ---------------- web prospects (cached, never mixed in) ---------------- */
const WEB_CACHE = new Map<string, { t: number; r: unknown[] }>();
const WEB_TTL = 10 * 60 * 1000;
async function webSearch(q: string) {
  const hit = WEB_CACHE.get(q);
  if (hit && Date.now() - hit.t < WEB_TTL) return hit.r;
  const out: { title: string; url: string; domain: string }[] = [];
  const enc = encodeURIComponent;
  try {
    const g = await fetch("https://api.gdeltproject.org/api/v2/doc/doc?query="
      + enc(q + " sourcelang:english")
      + "&mode=artlist&maxrecords=5&timespan=30d&format=json",
      { signal: AbortSignal.timeout(2200) });
    if (g.ok) {
      const data = await g.json();
      for (const a of (data.articles ?? []).slice(0, 5)) {
        out.push({ title: a.title ?? "", url: a.url ?? "", domain: a.domain ?? "" });
      }
    }
  } catch (_) { /* best effort */ }
  try {
    const r = await fetch("https://news.google.com/rss/search?q=" + enc(q)
      + "&hl=en-US&gl=US&ceid=US:en", { signal: AbortSignal.timeout(2200) });
    if (r.ok) {
      const xml = await r.text();
      const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
      for (const it of items.slice(0, 5)) {
        const t = ((it.match(/<title>([\s\S]*?)<\/title>/) ?? [])[1] ?? "")
          .replace(/<[^>]*>/g, "");
        const l = (it.match(/<link>([\s\S]*?)<\/link>/) ?? [])[1] ?? "";
        const s = (it.match(/<source url="([^"]*)"/) ?? [])[1] ?? "";
        if (l) out.push({ title: t, url: l, domain: s });
      }
    }
  } catch (_) { /* best effort */ }
  const seen = new Set<string>();
  const dedup = out.filter((r) => r.url && !seen.has(r.url) && seen.add(r.url))
    .slice(0, 6);
  WEB_CACHE.set(q, { t: Date.now(), r: dedup });
  if (WEB_CACHE.size > 500) WEB_CACHE.delete(WEB_CACHE.keys().next().value!);
  return dedup;
}

/* ---------------- handler ---------------- */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const b = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const t0 = Date.now();

  // single case + canonical triple names (detail/permalink)
  if (b.id) {
    const { data } = await supa.from("cases")
      .select(CASE_COLS + ", who_id, whom_id, action_id, triple_locked")
      .eq("id", b.id).in("status", ["live", "under_review"]).limit(1);
    const kase = (data ?? [])[0] as Record<string, unknown> | undefined;
    if (kase && kase.triple_locked && kase.who_id && kase.action_id && kase.whom_id) {
      const [w, a, t] = await Promise.all([
        supa.from("entities").select("canonical_name").eq("id", kase.who_id).single(),
        supa.from("actions").select("canonical_verb").eq("id", kase.action_id).single(),
        supa.from("entities").select("canonical_name").eq("id", kase.whom_id).single(),
      ]);
      kase.canonical = {
        who: w.data?.canonical_name ?? null,
        action: a.data?.canonical_verb ?? null,
        whom: t.data?.canonical_name ?? null,
      };
    }
    return json({ results: data ?? [], ms: Date.now() - t0 });
  }

  const category = b.category ? String(b.category) : null;

  // boot feed
  if (b.browse) {
    let q = supa.from("cases").select(CASE_COLS).eq("status", "live")
      .order("created_at", { ascending: false }).limit(60);
    if (category) q = q.eq("category", category);
    const { data } = await q;
    return json({ results: data ?? [], ms: Date.now() - t0 });
  }

  // explicit structured triple query (from the parse-preview chips)
  if (b.deep && (b.who || b.action || b.whom)) {
    const v = await loadVocab();
    const p = parseQuery(
      [b.who, b.action, b.whom].filter(Boolean).join(" "), v);
    const results = await structuredSearch(p, category);
    return json({ results, parsed: describeParse(p), ms: Date.now() - t0 });
  }

  // typed query: fast ILIKE + parsed structured scoring, merged
  const fastQ = String(b.q ?? "").trim();
  if (fastQ) {
    const v = await loadVocab();
    const p = parseQuery(fastQ, v);
    let ilikeQ = supa.from("cases").select(CASE_COLS).eq("status", "live")
      .or(`title.ilike.%${fastQ}%,raw_title.ilike.%${fastQ}%,summary.ilike.%${fastQ}%`)
      .limit(20);
    if (category) ilikeQ = ilikeQ.eq("category", category);
    const [ilike, structured] = await Promise.all([
      ilikeQ, structuredSearch(p, category),
    ]);
    const seen = new Set<string>();
    const merged: unknown[] = [];
    for (const c of structured) {
      if (!seen.has((c as { id: string }).id)) {
        seen.add((c as { id: string }).id); merged.push(c);
      }
    }
    for (const c of ilike.data ?? []) {
      if (!seen.has(c.id)) { seen.add(c.id); merged.push(c); }
    }
    let web_results: unknown[] = [];
    if (b.web && fastQ.length >= 4) web_results = await webSearch(fastQ.slice(0, 120));
    return json({ results: merged.slice(0, 20), web_results,
      parsed: describeParse(p), ms: Date.now() - t0 });
  }

  return json({ results: [], ms: Date.now() - t0 });
});

function describeParse(p: Parsed) {
  return {
    who: p.who?.name ?? null,
    action: p.action?.verb ?? null,
    whom: p.whom?.name ?? null,
    entities: p.entities.map((e) => e.name),
    modifiers: p.mods,
    free: p.free,
  };
}
