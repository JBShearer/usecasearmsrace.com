// UCAR 2.0 consensus engine. Pure, deterministic, tested.
// A case's canonical triple is the reputation-weighted mode of player
// extractions, per slot, locking only when support is real. Players keep
// their personal triples on their cards; the graph indexes the canon.

export interface Submission {
  who: string;
  action: string;
  whom: string;
  repWeight: number; // >= 0.25, capped at 4 so whales can't own the canon
}

export interface Resolver {
  // maps free text to a canonical key ("the ATF" -> "atf" -> entity)
  resolve(slot: "who" | "whom" | "action", text: string): string;
}

export interface SlotVerdict {
  key: string | null;      // canonical key, null if below thresholds
  share: number;           // weight share of the winner
  distinct: number;        // distinct canonical keys seen
}

export interface ConsensusResult {
  who: SlotVerdict;
  action: SlotVerdict;
  whom: SlotVerdict;
  locked: boolean;         // all three slots met thresholds
}

export const CONSENSUS = {
  MIN_SUBMISSIONS: 3,      // fewer than this: nothing locks
  MIN_SHARE: 0.4,          // winner needs 40% of weight
  MIN_LEAD: 1.15,          // and 15% more weight than the runner-up
  WEIGHT_CAP: 4,
  WEIGHT_FLOOR: 0.25,
};

export function normalizeText(t: string): string {
  return t.toLowerCase()
    .replace(/^(the|a|an)\s+/i, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Default resolver: normalization plus a caller-supplied alias map
// (canonical key -> list of alias strings). The DB-side resolver adds
// trigram and vector matching; this one is what the tests pin down.
export function makeResolver(
  aliasMap: Record<string, string[]>,
): Resolver {
  const lookup = new Map<string, string>();
  for (const [canon, aliases] of Object.entries(aliasMap)) {
    lookup.set(normalizeText(canon), canon);
    for (const a of aliases) lookup.set(normalizeText(a), canon);
  }
  return {
    resolve(_slot, text) {
      const n = normalizeText(text);
      return lookup.get(n) ?? n;
    },
  };
}

function slotConsensus(
  entries: { key: string; w: number }[],
  totalWeight: number,
  n: number,
): SlotVerdict {
  const weights = new Map<string, number>();
  for (const { key, w } of entries) {
    weights.set(key, (weights.get(key) ?? 0) + w);
  }
  const ranked = [...weights.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])); // det. ties
  const [topKey, topW] = ranked[0] ?? [null, 0];
  const runnerW = ranked[1]?.[1] ?? 0;
  const share = totalWeight > 0 ? topW / totalWeight : 0;
  const passes = n >= CONSENSUS.MIN_SUBMISSIONS &&
    share >= CONSENSUS.MIN_SHARE &&
    (runnerW === 0 || topW >= runnerW * CONSENSUS.MIN_LEAD);
  return { key: passes ? topKey : null, share, distinct: ranked.length };
}

export function consensus(
  submissions: Submission[],
  resolver: Resolver,
): ConsensusResult {
  const n = submissions.length;
  const capped = submissions.map((s) => ({
    ...s,
    w: Math.min(CONSENSUS.WEIGHT_CAP,
        Math.max(CONSENSUS.WEIGHT_FLOOR, s.repWeight)),
  }));
  const total = capped.reduce((a, s) => a + s.w, 0);
  const slot = (name: "who" | "action" | "whom") =>
    slotConsensus(
      capped.map((s) => ({ key: resolver.resolve(
        name === "action" ? "action" : name, s[name]), w: s.w })),
      total, n);
  const who = slot("who");
  const action = slot("action");
  const whom = slot("whom");
  return {
    who, action, whom,
    locked: !!(who.key && action.key && whom.key),
  };
}
