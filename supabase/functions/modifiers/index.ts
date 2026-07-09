// modifiers: the community layer. Contributions are typed terms attached
// to a slot of the triple (who/action/whom) or the case. No freeform
// comments: every contribution is graph vocabulary that deepens search.
// Wikipedia energy: anyone adds, duplicates strengthen (support++).

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
const SLOTS = ["who", "action", "whom", "case"];
const KINDS = ["adjective", "adverb", "proper_noun", "compound"];
function normTerm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 \-']/g, " ")
    .replace(/\s+/g, " ").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  if (req.method === "GET") {
    const url = new URL(req.url);
    const caseId = url.searchParams.get("case_id");
    if (!caseId) return json(400, { error: "case_id required" });
    const { data, error } = await supa.from("modifiers")
      .select("slot, kind, term, support")
      .eq("case_id", caseId)
      .order("support", { ascending: false }).limit(60);
    if (error) return json(500, { error: error.message });
    return json(200, { modifiers: data });
  }

  const submitter = await resolveUser(req);
  if (!submitter) return json(401, { error: "identity required" });
  const b = await req.json().catch(() => ({}));
  const term = normTerm(String(b.term ?? ""));
  const slot = String(b.slot ?? "");
  const kind = String(b.kind ?? "");
  if (!b.case_id || !SLOTS.includes(slot) || !KINDS.includes(kind)) {
    return json(400, { error: "case_id, slot, kind required" });
  }
  const words = term.split(" ").filter(Boolean);
  if (term.length < 2 || term.length > 40 || words.length < 1 || words.length > 3) {
    return json(400, { error: "term must be 1-3 words, 2-40 characters" });
  }
  // rate limit: 20 modifier submissions per hour per identity
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await supa.from("modifiers")
    .select("id", { count: "exact", head: true })
    .eq("submitter", submitter).gte("created_at", since);
  if ((count ?? 0) >= 20) return json(429, { error: "modifier cooldown, try later" });

  const { data: existing } = await supa.from("modifiers").select("id, support")
    .eq("case_id", b.case_id).eq("slot", slot).eq("term", term).maybeSingle();
  if (existing) {
    await supa.from("modifiers").update({ support: existing.support + 1 })
      .eq("id", existing.id);
    return json(200, { ok: true, strengthened: true, term });
  }
  const { error } = await supa.from("modifiers").insert({
    case_id: b.case_id, slot, kind, term, submitter,
  });
  if (error) return json(500, { error: error.message });
  return json(200, { ok: true, term });
});
