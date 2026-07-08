// submit-verdict: the whole play transaction. One call, no LLM, instant.
// 1. record the player's triple + HUMAN faction vote + notes
// 2. recompute vote totals and (maybe) case faction  [SQL, atomic]
// 3. recompute canonical triple consensus            [pure TS, tested]
// 4. mint the player's card deterministically        [pure TS, tested]
// Collective stats return ONLY after the vote is recorded: no anchoring.

import { createClient } from "npm:@supabase/supabase-js@2";
import { consensus, makeResolver, Submission } from "../../shared/consensus.ts";
import { deriveCard, noteReward, repDelta } from "../../shared/cardstats.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-anon-id",
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


const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function resolveUser(req: Request): Promise<string | null> {
  const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (jwt) {
    const { data } = await supa.auth.getUser(jwt);
    if (data.user?.id) return data.user.id;
  }
  // Anonymous play: client-held uuid. Rep accrues to the device identity;
  // it can be merged into a real account later. Never trusted for tiers.
  const anon = req.headers.get("x-anon-id") ?? "";
  return UUID_RE.test(anon) ? anon.toLowerCase() : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const userId = await resolveUser(req);
  if (!userId) return json(401, { error: "auth required" });

  const b = await req.json();
  const { case_id, who, action, whom, faction_vote, notes = "",
          who_free = false, action_free = false, whom_free = false,
          nuance_before = null, nuance_after = null,
          quick = false, verdict } = b;

  // Quick vote mode: just update vote counts, no triple/card
  if (quick && verdict) {
    if (!["heaven", "hell"].includes(verdict)) {
      return json(400, { error: "verdict must be heaven or hell" });
    }
    const { data: kase } = await supa.from("cases")
      .select("id, status, heaven_votes, hell_votes").eq("id", case_id).single();
    if (!kase || kase.status !== "live") {
      return json(409, { error: "case not open for voting" });
    }
    // Increment vote count directly (simple, no duplicate check for quick votes)
    const update = verdict === "heaven"
      ? { heaven_votes: (kase.heaven_votes || 0) + 1 }
      : { hell_votes: (kase.hell_votes || 0) + 1 };
    await supa.from("cases").update(update).eq("id", case_id);
    const total = (kase.heaven_votes || 0) + (kase.hell_votes || 0) + 1;
    const heaven = verdict === "heaven" ? (kase.heaven_votes || 0) + 1 : (kase.heaven_votes || 0);
    return json(200, {
      success: true,
      collective: {
        heaven_pct: Math.round(100 * heaven / total),
        votes: total,
      },
    });
  }

  if (!["heaven", "hell"].includes(faction_vote)) {
    return json(400, { error: "faction_vote must be heaven or hell" });
  }
  const { data: kase } = await supa.from("cases")
    .select("id, status, impact, source_tier, faction, action_id")
    .eq("id", case_id).single();
  if (!kase || kase.status !== "live") {
    return json(409, { error: "case not open for play" });
  }

  // rep weight for consensus: capped in the pure module too
  const { data: rep } = await supa.from("reputation")
    .select("rep").eq("user_id", userId).maybeSingle();
  const repWeight = 1 + Math.min(3, (rep?.rep ?? 0) / 250);

  const { error: subErr } = await supa.from("triple_submissions").upsert({
    case_id, user_id: userId,
    who_text: String(who).slice(0, 120),
    action_text: String(action).slice(0, 120),
    whom_text: String(whom).slice(0, 120),
    who_free, action_free, whom_free,
    faction_vote, notes: String(notes).slice(0, 4000),
    nuance_before, nuance_after, rep_weight: repWeight,
  }, { onConflict: "case_id,user_id" });
  if (subErr) return json(500, { error: subErr.message });

  // votes + faction (atomic, floor + hysteresis in SQL)
  await supa.rpc("apply_vote_totals", { p_case: case_id });

  // consensus over all submissions
  const { data: subs } = await supa.from("triple_submissions")
    .select("who_text, action_text, whom_text, rep_weight")
    .eq("case_id", case_id);
  const { data: ents } = await supa.from("entities")
    .select("canonical_name, aliases");
  const aliasMap: Record<string, string[]> = {};
  for (const e of ents ?? []) aliasMap[e.canonical_name] = e.aliases;
  const resolver = makeResolver(aliasMap);
  const result = consensus(
    (subs ?? []).map((s): Submission => ({
      who: s.who_text, action: s.action_text, whom: s.whom_text,
      repWeight: Number(s.rep_weight),
    })), resolver);

  if (result.locked) {
    const [{ data: whoId }, { data: actionId }, { data: whomId }] =
      await Promise.all([
        supa.rpc("resolve_entity", { q: result.who.key }),
        supa.rpc("resolve_action", { q: result.action.key }),
        supa.rpc("resolve_entity", { q: result.whom.key }),
      ]);
    if (whoId && actionId && whomId) {
      await supa.rpc("apply_canonical_triple", {
        p_case: case_id, p_who: whoId, p_action: actionId,
        p_whom: whomId, p_locked: true,
      });
    }
  }

  // instant deterministic mint: no LLM at mint time, ever
  const { data: act } = kase.action_id
    ? await supa.from("actions").select("valence").eq("id", kase.action_id).single()
    : { data: null };
  const { data: fresh } = await supa.from("cases")
    .select("faction, heaven_votes, hell_votes, title, raw_title")
    .eq("id", case_id).single();
  const stats = deriveCard({
    impact: kase.impact, valence: act?.valence ?? 0,
    sourceTier: (kase.source_tier as 1 | 2) ?? 2,
    faction: fresh!.faction,
  });
  const { data: top } = await supa.from("user_cards").select("serial")
    .eq("case_id", case_id).order("serial", { ascending: false }).limit(1);
  const { data: card, error: cardErr } = await supa.from("user_cards").insert({
    user_id: userId, case_id, serial: (top?.[0]?.serial ?? 0) + 1,
    card_name: fresh!.title ?? fresh!.raw_title,
    faction_at_mint: fresh!.faction,
    atk: stats.atk, def: stats.def, rarity: stats.rarity,
    triple: { who, action, whom },
  }).select().single();
  // duplicate play: unique(case_id,user_id) -> return their existing card
  const finalCard = cardErr
    ? (await supa.from("user_cards").select("*").eq("case_id", case_id)
        .eq("user_id", userId).single()).data
    : card;

  const coins = noteReward(String(notes).length);
  const dRep = repDelta({ submitted: true, noteChars: String(notes).length,
    freeTextUsed: who_free || action_free || whom_free });
  await supa.from("reputation").upsert({ user_id: userId }, // ensure row
    { onConflict: "user_id", ignoreDuplicates: true });
  await supa.from("reputation").update({
    rep: (rep?.rep ?? 0) + dRep,
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId);

  const total = fresh!.heaven_votes + fresh!.hell_votes;
  return json(200, {
    card: finalCard,
    rewards: { coins, rep: dRep },
    collective: {   // shown only now, after their vote is locked in
      heaven_pct: total ? Math.round(100 * fresh!.heaven_votes / total) : null,
      votes: total,
      canonical_locked: result.locked,
    },
  });
});
