// search-cases: pure ILIKE, no vocab, maximum speed
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

const COLS = "id, title, raw_title, summary, article_quote, faction, impact, heaven_votes, hell_votes, source_url, source_tier, tech_types, data_types, extraction, status, created_at";

function json(body: unknown) {
  return new Response(JSON.stringify(body), { headers: { ...CORS, "Content-Type": "application/json" } });
}

// Web search: GDELT + Google News in parallel (only when requested)
async function webSearch(q: string) {
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
  const seen = new Set<string>();
  return [...gdelt, ...google].filter(r => r.url && !seen.has(r.url) && seen.add(r.url)).slice(0, 8);
}

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

  // Browse: load recent cases
  if (b.browse) {
    const { data } = await supa.from("cases").select(COLS).eq("status", "live")
      .order("created_at", { ascending: false }).limit(60);
    return json({ results: data ?? [], ms: Date.now() - t0 });
  }

  // Text search - split words, OR them together
  const q = String(b.q ?? "").trim();
  if (q) {
    const words = q.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const ors = words.length
      ? words.flatMap(w => [`title.ilike.%${w}%`, `summary.ilike.%${w}%`])
      : [`title.ilike.%${q}%`, `summary.ilike.%${q}%`];

    const { data } = await supa.from("cases").select(COLS).eq("status", "live")
      .or(ors.join(",")).limit(20);

    // Web results only if requested
    const web_results = b.web && q.length >= 3 ? await webSearch(q.slice(0, 120)) : [];

    return json({ results: data ?? [], web_results, ms: Date.now() - t0 });
  }

  // Empty query = browse
  const { data } = await supa.from("cases").select(COLS).eq("status", "live")
    .order("created_at", { ascending: false }).limit(60);
  return json({ results: data ?? [], ms: Date.now() - t0 });
});
