/**
 * USE CASE ARMS RACE - ECONOMY & TUNABLE CONSTANTS
 *
 * All magic numbers extracted here for easy tuning by OWNER.
 * Sources cited from build plans.
 */

// ============================================================================
// EBL GAME ECONOMY (from EBL_BATTLER_BUILD_PLAN.md section 11)
// ============================================================================

export const EBL_ECONOMY = {
  // Phase 2: Portfolio (section 5.2)
  STARTING_BALANCE: 100,              // BC starting balance
  CLAIM_BASE: 50,                      // First seat cost in BC
  CLAIM_GROWTH: 1.6,                   // Exponential growth per seat
  SEAT_CAP: 6,                         // Max portfolio seats
  MINE_PER_IMPACT_HOUR: 1,            // Base mining: impact * 1 BC/hour
  PORTFOLIO_EFFICIENCY_STEP: 0.05,     // Efficiency loss: 1 - 0.05*(seats-1)

  // Phase 3: Battles (section 6.4)
  SIPHON_RATE: 0.25,                  // Fraction siphoned on raid win
  SIPHON_HOURS: 12,                    // Duration of siphon effect
  RAID_MARKS_FOR_TAKEOVER: 3,          // Marks to trigger takeover battle
  MARK_WINDOW_HOURS: 72,               // Window for mark accumulation
  RAID_COST_PER_IMPACT: 3,            // Raid declaration cost: impact * 3 BC
  RAID_COOLDOWN_HOURS: 6,              // Cooldown between raids on same product
  DEFENDER_BOUNTY_PER_IMPACT: 5,       // Defender win reward: impact * 5 BC

  // Phase 3: Combat (section 6.4)
  JOIN_WINDOW_SECONDS: 60,             // Battle join window
  TURN_SECONDS: 15,                    // Turn commit window
  TURNS: 5,                            // Total turns per battle
  COUNTER_BONUS: 2,                    // Category counter modifier
  WEAKNESS_PENALTY: -1,                // Category weakness modifier
  MONO_FACTION_BONUS: 1,              // All cards same faction bonus
  LIVE_DEFENSE_BONUS: 1,              // Owner present bonus

  // Phase 4: Realtime (section 7)
  SENTIMENT_BONUS: 1,                  // Spectator vote modifier (final turn, one lane)
  MERCENARY_DEFENDER_SIPHON_SHARE: 0.10, // Merc defender siphon prevention reward

  // Phase 5: Quests (section 8.2)
  SCRATCH_WEEKLY_CAP: 10,              // Max tickets per user per ISO week
  SCRATCH_ODDS: {
    coins: 0.60,      // 60% coins (15-40 BC)
    common: 0.30,     // 30% common/uncommon instance
    rare: 0.09,       // 9% rare instance
    legendary: 0.01,  // 1% legendary holo instance
  },

  // Phase 2: Slot Machine (section 5.3)
  SLOT_WEIGHT_EXPONENT: 2,             // Weight = impact^2
};

// ============================================================================
// UCAR REGISTRY TUNABLE VALUES (from UCAR_REGISTRY_BUILD_PLAN.md)
// ============================================================================

export const UCAR_CONFIG = {
  // Phase U2: AutoVerify (section 3.1)
  AUTOVERIFY_SLA_HOURS: 48,            // needs_human queue target response time
  DUPLICATE_SIMILARITY_THRESHOLD: 0.92, // Embedding cosine similarity for dedupe flag

  // Phase U2: AutoVerify stages (section 3.1)
  AUTOVERIFY_TIMEOUT_MS: 120000,       // p95 target: 2 minutes

  // Phase U3: Complaints (section 4.1)
  MAX_OPEN_COMPLAINTS_PER_USER: 3,     // Rate limit on filing complaints
  REVIEW_SLA_DAYS: 7,                  // Human review target time
  REVIEW_ESCALATION_DAYS: 5,           // Auto-escalate reminder
  RETRACTION_REFUND_RATE: 0.50,        // EBL seat refund on retraction (50%)

  // Phase U1: Feed scoring (section 2.3)
  TOP_SCORE_HALF_LIFE_HOURS: 72,       // Recency decay for Top tab

  // Phase 0: Rate Limiting (section 5.3)
  RATE_LIMIT_DEFAULT: 30,              // Calls per minute per function
  RATE_LIMIT_WINDOW_MINUTES: 1,        // Bucket size

  // Phase U3: Complaint triage (section 4.2)
  TRIAGE_TIMEOUT_P95_MINUTES: 5,       // Steward triage response target

  // Phase U1: Feed tabs (section 2.3)
  FLIPS_LOOKBACK_DAYS: 30,             // Flips tab shows last N days

  // Phase EBL-1: Faction flip hysteresis (EBL_BATTLER_BUILD_PLAN section 4.3)
  FACTION_FLIP_HYSTERESIS: 0.05,       // Must be 0.05 past 0.5 threshold to flip
};

// ============================================================================
// SHOW CONFIGURATION (from SHOW_LAUNCH_RUNBOOK.md)
// ============================================================================

export const SHOW_CONFIG = {
  // Section 3: Daily Pipeline
  STEWARD_BRIEF_TIME_UTC: '05:30',     // Steward compiles morning brief
  CARD_OF_DAY_DURATION_HOURS: 24,      // Free-to-play window
  EPISODE_CADENCE_DAYS: [1,2,3,4,5,6], // Six days per week (day 7 is dark day)

  // Section 1: Format Lock
  TARGET_RUNTIME_MINUTES: 5,           // Target episode length (OWNER tunable)
  TICKER_ITEMS_MIN: 2,                 // Min items in The Ticker segment
  TICKER_ITEMS_MAX: 4,                 // Max items in The Ticker segment

  // Section 4: Launch Checklist
  CASE_BUFFER_COUNT: 6,                // Pre-shortlisted Case of Day candidates
};

// ============================================================================
// CARD DERIVATION FORMULAS (from EBL_BATTLER_BUILD_PLAN section 4.3)
// ============================================================================

export const CARD_DERIVATION = {
  POWER_MULTIPLIER: 2,                 // power = impact * 2
  FACTION_THRESHOLD: 0.5,              // Heaven if alignment_ratio >= 0.5

  // Rarity mapping (impact → rarity)
  RARITY_MAP: {
    5: 'legendary',
    4: 'rare',
    3: 'uncommon',
    2: 'common',
    1: 'common',
  } as const,
};

// ============================================================================
// REPUTATION SYSTEM (from REQUIREMENTS.md section 11)
// ============================================================================

export const REPUTATION = {
  RANKS: {
    newcomer: 0,
    verified: 50,
    analyst: 200,
    expert: 500,
    council: 1000,
  },

  // Earning rates
  CASE_APPROVED: 10,
  TRIPLE_VOTED_BEST: 25,
  VOTE_WITH_CONSENSUS: 2,
  NOTES_QUALITY_BONUS_MIN: 5,
  NOTES_QUALITY_BONUS_MAX: 25,
  CATCH_DUPLICATE: 20,

  // Notes rewards (from REQUIREMENTS.md section 3.6)
  NOTE_TIERS: [
    { minChars: 10, reward: 5 },
    { minChars: 50, reward: 10 },
    { minChars: 100, reward: 15 },
    { minChars: 200, reward: 25 },
  ],
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate claim cost for seat N (1-indexed)
 * Formula: CLAIM_BASE * CLAIM_GROWTH^(N-1)
 */
export function claimCost(seatNumber: number): number {
  if (seatNumber < 1 || seatNumber > EBL_ECONOMY.SEAT_CAP) {
    throw new Error(`Invalid seat number: ${seatNumber}`);
  }
  return Math.floor(
    EBL_ECONOMY.CLAIM_BASE * Math.pow(EBL_ECONOMY.CLAIM_GROWTH, seatNumber - 1)
  );
}

/**
 * Calculate portfolio efficiency for N seats
 * Formula: 1 - 0.05 * (N - 1)
 */
export function portfolioEfficiency(seatCount: number): number {
  if (seatCount < 1 || seatCount > EBL_ECONOMY.SEAT_CAP) {
    throw new Error(`Invalid seat count: ${seatCount}`);
  }
  return 1 - EBL_ECONOMY.PORTFOLIO_EFFICIENCY_STEP * (seatCount - 1);
}

/**
 * Calculate Top tab score for a case
 * Formula: votes_total * ln(1 + votes_total) * exp(-age_hours / half_life)
 */
export function topScore(votesTotal: number, ageHours: number): number {
  const recencyDecay = Math.exp(-ageHours / UCAR_CONFIG.TOP_SCORE_HALF_LIFE_HOURS);
  return votesTotal * Math.log(1 + votesTotal) * recencyDecay;
}

/**
 * Derive card power from impact
 * Formula: impact * 2
 */
export function cardPower(impact: number): number {
  if (impact < 1 || impact > 5) {
    throw new Error(`Invalid impact: ${impact}`);
  }
  return impact * CARD_DERIVATION.POWER_MULTIPLIER;
}

/**
 * Derive card faction from alignment ratio
 * Heaven if ratio >= 0.5, else Hell
 */
export function cardFaction(alignmentRatio: number): 'heaven' | 'hell' {
  return alignmentRatio >= CARD_DERIVATION.FACTION_THRESHOLD ? 'heaven' : 'hell';
}

/**
 * Derive card rarity from impact
 */
export function cardRarity(impact: number): 'common' | 'uncommon' | 'rare' | 'legendary' {
  if (impact < 1 || impact > 5) {
    throw new Error(`Invalid impact: ${impact}`);
  }
  return CARD_DERIVATION.RARITY_MAP[impact as keyof typeof CARD_DERIVATION.RARITY_MAP];
}

/**
 * Calculate note reward from character count
 */
export function noteReward(charCount: number): number {
  for (let i = REPUTATION.NOTE_TIERS.length - 1; i >= 0; i--) {
    if (charCount >= REPUTATION.NOTE_TIERS[i].minChars) {
      return REPUTATION.NOTE_TIERS[i].reward;
    }
  }
  return 0; // No reward if under minimum
}

/**
 * Check if alignment ratio change should trigger faction flip
 * Must cross threshold AND exceed hysteresis
 */
export function shouldFlipFaction(
  oldRatio: number,
  newRatio: number
): boolean {
  const threshold = CARD_DERIVATION.FACTION_THRESHOLD;
  const hysteresis = UCAR_CONFIG.FACTION_FLIP_HYSTERESIS;

  // Old faction was Heaven, new would be Hell
  if (oldRatio >= threshold && newRatio < threshold) {
    return newRatio <= (threshold - hysteresis);
  }

  // Old faction was Hell, new would be Heaven
  if (oldRatio < threshold && newRatio >= threshold) {
    return newRatio >= (threshold + hysteresis);
  }

  return false;
}
