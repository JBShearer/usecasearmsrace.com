// search-cases: the search engine endpoint. Fast paths use ILIKE only.
// Deep/semantic search is disabled until embed() dependencies are fixed.

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

// Server-side web fan-out: GDELT DOC + Google News RSS IN PARALLEL.
// Results are PROSPECTS, returned under web_results, never mixed into the record.
async function webSearch(q: string): Promise<
  { title: string; url: string; domain: string; published: string }[]> {
  const out: { title: string; url: string; domain: string; published: string }[] = [];
  const enc = encodeURIComponent;

  // Fire BOTH requests in parallel with aggressive timeouts
  const gdeltPromise = fetch("https://api.gdeltproject.org/api/v2/doc/doc?query="
    + enc(q + " sourcelang:english")
    + "&mode=artlist&maxrecords=5&timespan=30d&format=json",
    { signal: AbortSignal.timeout(2500) })
    .then(async r => {
      if (!r.ok) return [];
      const data = await r.json();
      return (data.articles ?? []).slice(0, 5).map((a: { title?: string; url?: string; domain?: string; seendate?: string }) => ({
        title: a.title ?? "", url: a.url ?? "",
        domain: a.domain ?? "", published: a.seendate ?? ""
      }));
    })
    .catch(() => []);

  const googlePromise = fetch("https://news.google.com/rss/search?q=" + enc(q)
    + "&hl=en-US&gl=US&ceid=US:en", { signal: AbortSignal.timeout(2500) })
    .then(async r => {
      if (!r.ok) return [];
      const xml = await r.text();
      const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
      return items.slice(0, 5).map((it: string) => {
        const t = (it.match(/<title>([\s\S]*?)<\/title>/) ?? [])[1] ?? "";
        const l = (it.match(/<link>([\s\S]*?)<\/link>/) ?? [])[1] ?? "";
        const s = (it.match(/<source url="([^"]*)"/) ?? [])[1] ?? "";
        return { title: t.replace(/<[^>]*>/g, ""), url: l, domain: s, published: "" };
      }).filter((x: { url: string }) => x.url);
    })
    .catch(() => []);

  // Wait for both in parallel - max 2.5s instead of 8s
  const [gdelt, google] = await Promise.all([gdeltPromise, googlePromise]);
  out.push(...gdelt, ...google);

  const seen = new Set<string>();
  return out.filter((r) => r.url && !seen.has(r.url) && seen.add(r.url)).slice(0, 8);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const b = req.method === "POST" ? await req.json() : {};
  const t0 = Date.now();

  // Direct case fetch for the play flow
  if (b.id) {
    const { data } = await supa.from("cases").select("*").eq("id", b.id)
      .in("status", ["live", "under_review"]).limit(1);
    return new Response(JSON.stringify({ results: data ?? [], ms: Date.now() - t0 }),
      { headers: { ...CORS, "Content-Type": "application/json" } });
  }

  // Load all cases (empty query) - for initial page load
  const fastQ = String(b.q ?? "").trim();
  if (!fastQ && !b.who && !b.action && !b.whom && !b.deep && !b.id) {
    const { data } = await supa.from("cases")
      .select("id, title, raw_title, summary, article_quote, category, faction, impact, heaven_votes, hell_votes, source_url, source_tier, tech_types, data_types, extraction, created_at")
      .eq("status", "live")
      .order("created_at", { ascending: false })
      .limit(100);
    return new Response(JSON.stringify({
      results: data ?? [],
      ms: Date.now() - t0,
    }), { headers: { ...CORS, "Content-Type": "application/json" } });
  }

  // Fast path for realtime typing: ILIKE only, no embedding
  // DB and web search run IN PARALLEL for speed
  if (fastQ && !b.who && !b.action && !b.whom && !b.deep) {
    // Fire DB and web in parallel - don't wait for DB to decide on web
    const dbPromise = supa.from("cases")
      .select("id, title, raw_title, summary, article_quote, category, faction, impact, heaven_votes, hell_votes, source_url, source_tier, tech_types, data_types, extraction, created_at")
      .eq("status", "live")
      .or(`title.ilike.%${fastQ}%,raw_title.ilike.%${fastQ}%,summary.ilike.%${fastQ}%`)
      .limit(20);

    const webPromise = (b.web && fastQ.length > 3)
      ? webSearch(fastQ.slice(0, 120))
      : Promise.resolve([]);

    const [dbResult, web_results] = await Promise.all([dbPromise, webPromise]);

    return new Response(JSON.stringify({
      results: dbResult.data ?? [],
      web_results,
      ms: Date.now() - t0,
    }), { headers: { ...CORS, "Content-Type": "application/json" } });
  }

  // Fallback: return empty if no conditions matched
  // (Deep semantic search disabled - would need embed() from steward.ts)
  return new Response(JSON.stringify({
    results: [],
    ms: Date.now() - t0,
    note: "Use q parameter for text search"
  }), { headers: { ...CORS, "Content-Type": "application/json" } });
});
