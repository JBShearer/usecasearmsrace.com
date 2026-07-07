// Supabase Edge Function: search-cases
// Multi-source news/content discovery with parallel fetching and deduplication

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://usecasearmsrace.com",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

interface SearchRequest {
  query: string;
  who?: string;
  action?: string;
  whom?: string;
}

interface Article {
  title: string;
  url: string;
  source: string;
  snippet: string;
  via: string;
  published?: string;
}

interface SearchResponse {
  articles: Article[];
  meta?: {
    query: string;
    sources_queried: string[];
    duration_ms: number;
  };
}

// Timeout wrapper for fetch with 5 second limit
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 5000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Google News RSS search
async function searchGoogleNews(query: string): Promise<Article[]> {
  const articles: Article[] = [];
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://news.google.com/rss/search?q=${encodedQuery}&hl=en-US&gl=US&ceid=US:en`;

    const response = await fetchWithTimeout(url);
    if (!response.ok) return articles;

    const xml = await response.text();

    // Parse RSS items using regex (lightweight for edge)
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const titleRegex = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/;
    const linkRegex = /<link>(.*?)<\/link>/;
    const pubDateRegex = /<pubDate>(.*?)<\/pubDate>/;
    const sourceRegex = /<source[^>]*>(.*?)<\/source>/;

    let match;
    while ((match = itemRegex.exec(xml)) !== null && articles.length < 8) {
      const item = match[1];

      const titleMatch = item.match(titleRegex);
      const linkMatch = item.match(linkRegex);
      const pubDateMatch = item.match(pubDateRegex);
      const sourceMatch = item.match(sourceRegex);

      const title = titleMatch?.[1] || titleMatch?.[2] || "";
      const url = linkMatch?.[1] || "";
      const sourceName = sourceMatch?.[1] || "Google News";

      if (title && url) {
        articles.push({
          title: decodeHtmlEntities(title),
          url,
          source: sourceName,
          snippet: "",
          via: "googlenews",
          published: pubDateMatch?.[1] || undefined,
        });
      }
    }
  } catch (error) {
    console.error("Google News error:", error);
  }
  return articles;
}

// Reddit JSON API search
async function searchReddit(query: string): Promise<Article[]> {
  const articles: Article[] = [];
  try {
    const encodedQuery = encodeURIComponent(`${query} AI`);
    const url = `https://www.reddit.com/search.json?q=${encodedQuery}&sort=relevance&limit=5`;

    const response = await fetchWithTimeout(url, {
      headers: {
        "User-Agent": "UseCaseArmsRace/1.0 (research aggregator)",
      },
    });
    if (!response.ok) return articles;

    const data = await response.json();
    const posts = data?.data?.children || [];

    for (const post of posts.slice(0, 5)) {
      const d = post.data;
      if (!d.title || !d.permalink) continue;

      articles.push({
        title: d.title,
        url: d.url || `https://www.reddit.com${d.permalink}`,
        source: `r/${d.subreddit}`,
        snippet: d.selftext?.slice(0, 200) || "",
        via: "reddit",
        published: d.created_utc
          ? new Date(d.created_utc * 1000).toISOString()
          : undefined,
      });
    }
  } catch (error) {
    console.error("Reddit error:", error);
  }
  return articles;
}

// Hacker News via Algolia API
async function searchHackerNews(query: string): Promise<Article[]> {
  const articles: Article[] = [];
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://hn.algolia.com/api/v1/search?query=${encodedQuery}&tags=story&hitsPerPage=5`;

    const response = await fetchWithTimeout(url);
    if (!response.ok) return articles;

    const data = await response.json();
    const hits = data?.hits || [];

    for (const hit of hits.slice(0, 5)) {
      if (!hit.title) continue;

      const articleUrl =
        hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`;

      articles.push({
        title: hit.title,
        url: articleUrl,
        source: "Hacker News",
        snippet: hit.story_text?.slice(0, 200) || "",
        via: "hackernews",
        published: hit.created_at || undefined,
      });
    }
  } catch (error) {
    console.error("Hacker News error:", error);
  }
  return articles;
}

// arXiv API search
async function searchArxiv(query: string): Promise<Article[]> {
  const articles: Article[] = [];
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `http://export.arxiv.org/api/query?search_query=all:${encodedQuery}&start=0&max_results=5&sortBy=relevance`;

    const response = await fetchWithTimeout(url);
    if (!response.ok) return articles;

    const xml = await response.text();

    // Parse Atom feed entries
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    const titleRegex = /<title>([\s\S]*?)<\/title>/;
    const linkRegex = /<id>(.*?)<\/id>/;
    const summaryRegex = /<summary>([\s\S]*?)<\/summary>/;
    const publishedRegex = /<published>(.*?)<\/published>/;

    let match;
    while ((match = entryRegex.exec(xml)) !== null && articles.length < 5) {
      const entry = match[1];

      const titleMatch = entry.match(titleRegex);
      const linkMatch = entry.match(linkRegex);
      const summaryMatch = entry.match(summaryRegex);
      const publishedMatch = entry.match(publishedRegex);

      const title = titleMatch?.[1]?.replace(/\s+/g, " ").trim() || "";
      const url = linkMatch?.[1] || "";
      const summary = summaryMatch?.[1]?.replace(/\s+/g, " ").trim() || "";

      if (title && url) {
        articles.push({
          title,
          url,
          source: "arXiv",
          snippet: summary.slice(0, 200),
          via: "arxiv",
          published: publishedMatch?.[1] || undefined,
        });
      }
    }
  } catch (error) {
    console.error("arXiv error:", error);
  }
  return articles;
}

// Wikipedia API search
async function searchWikipedia(query: string): Promise<Article[]> {
  const articles: Article[] = [];
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodedQuery}&format=json&srlimit=5&origin=*`;

    const response = await fetchWithTimeout(url);
    if (!response.ok) return articles;

    const data = await response.json();
    const results = data?.query?.search || [];

    for (const result of results.slice(0, 5)) {
      if (!result.title) continue;

      const pageUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(
        result.title.replace(/ /g, "_")
      )}`;

      // Strip HTML tags from snippet
      const snippet = (result.snippet || "")
        .replace(/<[^>]*>/g, "")
        .slice(0, 200);

      articles.push({
        title: result.title,
        url: pageUrl,
        source: "Wikipedia",
        snippet,
        via: "wikipedia",
        published: result.timestamp || undefined,
      });
    }
  } catch (error) {
    console.error("Wikipedia error:", error);
  }
  return articles;
}

// Helper to decode HTML entities
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

// Build search query from structured input
function buildQuery(params: SearchRequest): string {
  const parts: string[] = [];

  if (params.query) {
    parts.push(params.query);
  }

  // Append structured NVN (Noun-Verb-Noun) components if provided
  if (params.who) parts.push(params.who);
  if (params.action) parts.push(params.action);
  if (params.whom) parts.push(params.whom);

  return parts.join(" ").trim() || "artificial intelligence";
}

// Deduplicate articles by URL
function deduplicateArticles(articles: Article[]): Article[] {
  const seen = new Set<string>();
  const unique: Article[] = [];

  for (const article of articles) {
    // Normalize URL for deduplication
    const normalizedUrl = article.url
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "");

    if (!seen.has(normalizedUrl) && article.title && article.url) {
      seen.add(normalizedUrl);
      unique.push(article);
    }
  }

  return unique;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }

  // Only accept POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const startTime = Date.now();

  try {
    const body: SearchRequest = await req.json();
    const query = buildQuery(body);

    // Execute all searches in parallel
    const [googleNews, reddit, hackerNews, arxiv, wikipedia] =
      await Promise.allSettled([
        searchGoogleNews(query),
        searchReddit(query),
        searchHackerNews(query),
        searchArxiv(query),
        searchWikipedia(query),
      ]);

    // Collect results from successful sources
    const allArticles: Article[] = [];
    const sourcesQueried: string[] = [];

    if (googleNews.status === "fulfilled") {
      allArticles.push(...googleNews.value);
      sourcesQueried.push("googlenews");
    }
    if (reddit.status === "fulfilled") {
      allArticles.push(...reddit.value);
      sourcesQueried.push("reddit");
    }
    if (hackerNews.status === "fulfilled") {
      allArticles.push(...hackerNews.value);
      sourcesQueried.push("hackernews");
    }
    if (arxiv.status === "fulfilled") {
      allArticles.push(...arxiv.value);
      sourcesQueried.push("arxiv");
    }
    if (wikipedia.status === "fulfilled") {
      allArticles.push(...wikipedia.value);
      sourcesQueried.push("wikipedia");
    }

    // Deduplicate and limit results
    const articles = deduplicateArticles(allArticles).slice(0, 15);

    const response: SearchResponse = {
      articles,
      meta: {
        query,
        sources_queried: sourcesQueried,
        duration_ms: Date.now() - startTime,
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Search error:", error);
    return new Response(
      JSON.stringify({
        error: "Search failed",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }
});
