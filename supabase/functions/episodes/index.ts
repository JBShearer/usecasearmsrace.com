// episodes: public GET of published episodes; admin writes gated by the
// ADMIN_KEY secret (set with: supabase secrets set ADMIN_KEY=...).
// The admin area sends x-admin-key; a wrong key gets a flat 403. Reads
// never require the key.

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-key",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
const supa = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body),
    { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  if (req.method === "GET") {
    const { data, error } = await supa.from("episodes").select("*")
      .eq("published", true)
      .order("featured", { ascending: false })
      .order("sort", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) return json(500, { error: error.message });
    return json(200, { episodes: data });
  }

  const key = req.headers.get("x-admin-key") ?? "";
  const expected = Deno.env.get("ADMIN_KEY") ?? "";
  if (!expected || key !== expected) return json(403, { error: "forbidden" });

  const b = await req.json().catch(() => ({}));
  if (b.action === "list_all") {
    const { data, error } = await supa.from("episodes").select("*")
      .order("featured", { ascending: false })
      .order("sort", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) return json(500, { error: error.message });
    return json(200, { episodes: data });
  }
  if (b.action === "upsert") {
    const e = b.episode ?? {};
    const row = {
      title: String(e.title ?? "").slice(0, 160),
      description: String(e.description ?? "").slice(0, 600),
      video_url: e.video_url ? String(e.video_url).slice(0, 400) : null,
      link_url: e.link_url ? String(e.link_url).slice(0, 400) : null,
      featured: !!e.featured,
      published: e.published !== false,
      sort: Number(e.sort) || 0,
    };
    if (!row.title) return json(400, { error: "title required" });
    const q = e.id
      ? supa.from("episodes").update(row).eq("id", e.id).select().single()
      : supa.from("episodes").insert(row).select().single();
    const { data, error } = await q;
    if (error) return json(500, { error: error.message });
    if (row.featured && data) {
      await supa.from("episodes").update({ featured: false })
        .neq("id", data.id).eq("featured", true);
    }
    return json(200, { episode: data });
  }
  if (b.action === "delete" && b.id) {
    const { error } = await supa.from("episodes").delete().eq("id", b.id);
    if (error) return json(500, { error: error.message });
    return json(200, { ok: true });
  }
  return json(400, { error: "unknown action" });
});
