// search-cases: pure ILIKE + Tavily news (fast warm path)
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
const COLS = "id, title, raw_title, summary, article_quote, faction, impact, heaven_votes, hell_votes, source_url, source_tier, tech_types, data_types, extraction, status, created_at";

function json(body: unknown) {
  return new Response(JSON.stringify(body), { headers: { ...CORS, "Content-Type": "application/json" } });
}

// Web cache (10 min TTL)
const webCache = new Map<string, { t: number; r: any[] }>();
const WEB_TTL = 10 * 60 * 1000;

async function webSearch(q: string) {
  const cached = webCache.get(q);
  if (cached && Date.now() - cached.t < WEB_TTL) return cached.r;

  const out: { title: string; url: string; domain: string }[] = [];

  // Tavily: fast news search (~500-800ms)
  if (TAVILY_KEY) {
    try {
      const r = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: TAVILY_KEY,
          query: q,
          search_depth: "basic",
          topic: "news",
          max_results: 6
        }),
        signal: AbortSignal.timeout(2000)
      });
      if (r.ok) {
        const data = await r.json();
        for (const item of data.results ?? []) {
          out.push({
            title: item.title ?? "",
            url: item.url ?? "",
            domain: item.url ? new URL(item.url).hostname.replace(/^www\./, "") : ""
          });
        }
      }
    } catch (_) { /* timeout or error */ }
  }

  // Fallback to Google News RSS if Tavily fails or no key
  if (!out.length) {
    try {
      const r = await fetch(
        "https://news.google.com/rss/search?q=" + encodeURIComponent(q) + "&hl=en-US&gl=US&ceid=US:en",
        { signal: AbortSignal.timeout(1500) }
      );
      if (r.ok) {
        const xml = await r.text();
        const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
        for (const it of items.slice(0, 6)) {
          const title = ((it.match(/<title>([\s\S]*?)<\/title>/) ?? [])[1] ?? "").replace(/<[^>]*>/g, "");
          const url = (it.match(/<link>([\s\S]*?)<\/link>/) ?? [])[1] ?? "";
          const domain = (it.match(/<source url="([^"]*)"/) ?? [])[1] ?? "";
          if (url) out.push({ title, url, domain });
        }
      }
    } catch (_) { /* timeout */ }
  }

  const seen = new Set<string>();
  const deduped = out.filter(r => r.url && !seen.has(r.url) && seen.add(r.url)).slice(0, 8);

  webCache.set(q, { t: Date.now(), r: deduped });
  if (webCache.size > 200) {
    const oldest = [...webCache.entries()].sort((a, b) => a[1].t - b[1].t)[0];
    if (oldest) webCache.delete(oldest[0]);
  }

  return deduped;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const b = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const t0 = Date.now();

  if (b.id) {
    const { data } = await supa.from("cases").select(COLS)
      .eq("id", b.id).in("status", ["live", "under_review"]).limit(1);
    return json({ results: data ?? [], ms: Date.now() - t0 });
  }

  if (b.browse) {
    const { data } = await supa.from("cases").select(COLS).eq("status", "live")
      .order("created_at", { ascending: false }).limit(60);
    return json({ results: data ?? [], ms: Date.now() - t0 });
  }

  const q = String(b.q ?? "").trim();
  if (q) {
    if (b.web_only) {
      const web_results = q.length >= 3 ? await webSearch(q.slice(0, 120)) : [];
      return json({ results: [], web_results, ms: Date.now() - t0 });
    }

    const words = q.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const ors = words.length
      ? words.flatMap(w => [`title.ilike.%${w}%`, `summary.ilike.%${w}%`])
      : [`title.ilike.%${q}%`, `summary.ilike.%${q}%`];

    const { data } = await supa.from("cases").select(COLS).eq("status", "live")
      .or(ors.join(",")).limit(20);

    const web_results = b.web && q.length >= 3 ? await webSearch(q.slice(0, 120)) : [];
    return json({ results: data ?? [], web_results, ms: Date.now() - t0 });
  }

  const { data } = await supa.from("cases").select(COLS).eq("status", "live")
    .order("created_at", { ascending: false }).limit(60);
  return json({ results: data ?? [], ms: Date.now() - t0 });
});
