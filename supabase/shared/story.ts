// UCAR 2.0 story engine + minigame mining. Pure, tested.
//
// THE RE-ENACTMENT MODEL: a case is not questioned, it is PERFORMED.
// The Brain's minions act it out in de-escalated cartoon form; the player's
// choices are stage directions that branch the narration. Structure:
//
//   setting     one paragraph: the theater, the props, the costumes
//   cold_open   the incident performed, de-escalated, before any choice
//   who_reveals[3]     narration for each WHO choice stepping forward
//   action_demos[3]    the chosen {WHO} performs each candidate action
//   whom_reveals[3]    the affected parties, costumed minions, {WHO}/{ACTION}
//   endings.heaven / endings.hell   the finale the player's verdict writes
//   deescalations[]    the real->cartoon substitutions used (shown as
//                      "COURT RECORD vs THEATER PROGRAM" for transparency)
//
// Branching without exponential cost: fragments compose. 3+3+3+2 fragments
// cover a 3x3x3x2 = 54-path tree because later beats template earlier
// choices in via {WHO} {ACTION} {WHOM}. One LLM call per case, ever.

export interface Reenactment {
  milieu?: string;        // The specific setting (hospital, transit depot, etc.)
  setting: string;
  cold_open: string;
  who_reveals: string[];    // parallel to who_choices
  action_demos: string[];   // parallel to action_choices, may use {WHO}
  whom_reveals: string[];   // parallel to whom_choices, may use {WHO} {ACTION}
  endings: { heaven: string; hell: string }; // may use all three slots
  deescalations: { real: string; cartoon: string }[];
}

// The canonical de-escalation table (comedy bible section 7). The steward
// prompt embeds these as exemplars; OWNER extends the table, not the code.
export const DEESCALATION_TABLE: Record<string, string> = {
  "arrested": "sent to the principal's office",
  "surveilled": "watched by the Brain's minions through comically large binoculars",
  "denied": "put on the waitlist",
  "fired": "reassigned to the mailroom",
  "sued": "sent a strongly worded letter",
  "detained": "asked to wait in the beanbag room",
  "tracked": "followed by a minion with a squeaky cart",
  "flagged": "given a sticky note",
  "scraped": "photocopied by the world's slowest intern",
  "deported": "walked to a different classroom",
};

export function fill(template: string, ctx: {
  WHO?: string; ACTION?: string; WHOM?: string;
}): string {
  return template
    .replaceAll("{WHO}", ctx.WHO ?? "the actor")
    .replaceAll("{ACTION}", ctx.ACTION ?? "does the thing to")
    .replaceAll("{WHOM}", ctx.WHOM ?? "everyone");
}

export function validateReenactment(raw: unknown): Reenactment {
  const o = raw as Record<string, unknown>;
  const str = (v: unknown, name: string, max = 700): string => {
    if (typeof v !== "string" || v.trim().length < 10 || v.length > max) {
      throw new Error(`reenactment: invalid ${name}`);
    }
    return v.trim();
  };
  const arr3 = (v: unknown, name: string): string[] => {
    if (!Array.isArray(v) || v.length !== 3) {
      throw new Error(`reenactment: ${name} must have exactly 3 fragments`);
    }
    return v.map((x, i) => str(x, `${name}[${i}]`, 500));
  };
  const endings = o["endings"] as Record<string, unknown>;
  if (!endings) throw new Error("reenactment: missing endings");
  const de = o["deescalations"];
  if (!Array.isArray(de) || de.length < 1) {
    throw new Error("reenactment: at least one de-escalation required");
  }
  // Judgment firewall applies to the theater too: endings must not tell
  // the player which verdict is correct. Both endings must exist; neither
  // may contain verdict-steering words about the OTHER faction.
  const heaven = str(endings["heaven"], "endings.heaven");
  const hell = str(endings["hell"], "endings.hell");
  // Milieu is optional for backwards compatibility with old extractions
  const milieu = typeof o["milieu"] === "string" && o["milieu"].length > 5
    ? o["milieu"].slice(0, 300) : undefined;
  return {
    milieu,
    setting: str(o["setting"], "setting"),
    cold_open: str(o["cold_open"], "cold_open"),
    who_reveals: arr3(o["who_reveals"], "who_reveals"),
    action_demos: arr3(o["action_demos"], "action_demos"),
    whom_reveals: arr3(o["whom_reveals"], "whom_reveals"),
    endings: { heaven, hell },
    deescalations: de.map((d) => ({
      real: str((d as Record<string, unknown>)["real"], "deescalation.real", 120),
      cartoon: str((d as Record<string, unknown>)["cartoon"], "deescalation.cartoon", 200),
    })),
  };
}

// ---------------------------------------------------------------------
// MINIGAMES AS MINING INSTRUMENTS. Each game emits a typed signal; this
// pure function turns signals into graph edges. Nightly job persists them.
// The games are sensors: association, salience, description, taxonomy,
// calibration. Five instruments, one graph.
// ---------------------------------------------------------------------

export type MinigameSignal =
  | { game: "inkblot"; blob_seed: string; words: string[] }
  | { game: "wordrun"; case_category: string;
      collected: string[]; avoided: string[] }
  | { game: "perp"; face_seed: string; description: string }
  | { game: "sticky"; placements: { concept: string; bucket: string }[] }
  | { game: "trivia"; question_id: string; correct: boolean;
      confidence: number };

export interface GraphEdge {
  src_type: string; src_key: string;
  dst_type: string; dst_key: string;
  kind: string; weight: number;
}

const tokenize = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
    .filter((w) => w.length > 3);

export function deriveEdges(sig: MinigameSignal): GraphEdge[] {
  const edges: GraphEdge[] = [];
  switch (sig.game) {
    case "inkblot": {
      const words = sig.words.map((w) => w.toLowerCase().trim())
        .filter((w) => w.length > 1).slice(0, 5);
      for (const w of words) {
        edges.push({ src_type: "blob", src_key: sig.blob_seed,
          dst_type: "word", dst_key: w, kind: "evokes", weight: 1 });
      }
      for (let i = 0; i < words.length; i++) {
        for (let j = i + 1; j < words.length; j++) {
          const [a, b] = [words[i], words[j]].sort();
          edges.push({ src_type: "word", src_key: a, dst_type: "word",
            dst_key: b, kind: "associated", weight: 1 });
        }
      }
      break;
    }
    case "wordrun": {
      for (const w of sig.collected.slice(0, 20)) {
        edges.push({ src_type: "category", src_key: sig.case_category,
          dst_type: "word", dst_key: w.toLowerCase(),
          kind: "salient", weight: 1 });
      }
      for (const w of sig.avoided.slice(0, 20)) {
        edges.push({ src_type: "category", src_key: sig.case_category,
          dst_type: "word", dst_key: w.toLowerCase(),
          kind: "rejected", weight: 1 });
      }
      break;
    }
    case "perp": {
      for (const t of tokenize(sig.description).slice(0, 12)) {
        edges.push({ src_type: "face", src_key: sig.face_seed,
          dst_type: "word", dst_key: t, kind: "described_as", weight: 1 });
      }
      break;
    }
    case "sticky": {
      for (const p of sig.placements.slice(0, 12)) {
        edges.push({ src_type: "concept", src_key: p.concept.toLowerCase(),
          dst_type: "bucket", dst_key: p.bucket.toLowerCase(),
          kind: "classified", weight: 1 });
      }
      break;
    }
    case "trivia": {
      // Calibration is a user-quality signal, not a graph edge: it feeds
      // rep weighting eventually. Represented as a self-edge for storage.
      edges.push({ src_type: "question", src_key: sig.question_id,
        dst_type: "outcome", dst_key: sig.correct ? "correct" : "wrong",
        kind: "calibration",
        weight: Math.max(0, Math.min(1, sig.confidence)) });
      break;
    }
  }
  return edges;
}

// Coin reward per completed minigame round: flat, small, and NEVER a
// function of what the player answered. Paying for specific answers would
// contaminate every sensor. Paying for participation is fine.
export function minigameReward(_sig: MinigameSignal): number {
  return 3;
}
