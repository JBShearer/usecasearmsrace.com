// UCAR 2.0 card derivation. Deterministic: same case state, same card.
// Valence (action node, -2..+2) finally gives ATK/DEF a data-grounded
// meaning: harmful actions hit harder, beneficial actions endure longer.

export interface CardInputs {
  impact: number;       // 1..5
  valence: number;      // -2..+2 from the canonical action (0 if unlocked)
  sourceTier: 1 | 2;
  faction: "heaven" | "hell" | "unaligned";
}

export function deriveCard(c: CardInputs) {
  const impact = Math.max(1, Math.min(5, c.impact));
  const v = Math.max(-2, Math.min(2, c.valence));
  const atk = impact * 2 + (v < 0 ? -v : 0);          // 2..12
  const def = impact + (v > 0 ? v : 0) + (c.sourceTier === 1 ? 1 : 0); // 1..8
  const rarity =
    impact >= 5 ? "legendary" :
    impact === 4 ? "rare" :
    impact === 3 ? "uncommon" : "common";
  return { atk, def, rarity };
}

// Faction from votes: floor 5, hysteresis 0.05, first assignment is not a
// flip. Mirrors migrations/0002 apply_vote_totals; tested here.
export function deriveFaction(
  current: "heaven" | "hell" | "unaligned",
  heaven: number,
  hell: number,
): "heaven" | "hell" | "unaligned" {
  const n = heaven + hell;
  if (n < 5) return current === "unaligned" ? "unaligned" : current;
  const ratio = heaven / n;
  if (current === "unaligned") return ratio >= 0.5 ? "heaven" : "hell";
  if (current === "hell" && ratio >= 0.55) return "heaven";
  if (current === "heaven" && ratio <= 0.45) return "hell";
  return current;
}

// Note rewards: tiered, capped, never coupled to the faction vote.
export function noteReward(chars: number): number {
  if (chars >= 200) return 25;
  if (chars >= 100) return 15;
  if (chars >= 50) return 10;
  if (chars >= 10) return 5;
  return 0;
}

// Rep changes. NO consensus-conformity bonus by design: rewarding agreement
// herds the crowd and poisons the dataset. Dissent that later proves out is
// rewarded at flip time by the nightly job, not here.
export function repDelta(opts: { submitted: boolean; noteChars: number;
  freeTextUsed: boolean }): number {
  let d = 0;
  if (opts.submitted) d += 3;
  d += Math.min(10, Math.floor(opts.noteChars / 50) * 2);
  if (opts.freeTextUsed) d += 2;   // novel signal beats menu-picking
  return d;
}
