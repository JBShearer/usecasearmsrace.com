// vote: one-tap good/evil. One vote per identity per case, switchable,
// tap-again-to-clear. Anonymous play via x-anon-id device uuid.

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-anon-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const voter = await resolveUser(req);
  if (!voter) return json(401, { error: "identity required" });
  const b = await req.json().catch(() => ({}));
  const v = b.vote === "heaven" ? 1 : b.vote === "hell" ? -1
    : b.vote === "clear" ? 0 : null;
  if (!b.case_id || v === null) return json(400, { error: "case_id and vote required" });
  const { data, error } = await supa.rpc("apply_case_vote",
    { p_case: b.case_id, p_voter: voter, p_vote: v });
  if (error) return json(500, { error: error.message });
  const row = Array.isArray(data) ? data[0] : data;
  return json(200, { heaven: row?.heaven ?? 0, hell: row?.hell ?? 0,
    your_vote: row?.your_vote ?? 0 });
});
