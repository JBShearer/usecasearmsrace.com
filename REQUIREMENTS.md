# USE CASE ARMS RACE - Requirements Document
## A Satirical Card Game Teaching AI Ethics Through Semantic Triples

---

## 1. CORE CONCEPT

**Tagline:** "Document AI before it documents you"

**What it is:** A card collection game where players analyze real AI use cases, extract semantic triples `[WHO] → [ACTION] → [WHOM]`, vote Heaven/Hell, and earn cards + reputation.

**The Loop:**
1. Player sees a real AI use case (news article, research paper, etc.)
2. Player extracts the semantic triple through guided story flow
3. Player votes: Is this use of AI Good (Heaven) or Evil (Hell)?
4. Player earns a collectible card based on their extraction
5. Collective intelligence builds a semantic graph of AI ethics

---

## 2. SEMANTIC TRIPLE MODEL

### The Core Data Structure

Every AI use case reduces to: **`[WHO] → [ACTION] → [WHOM]`**

```
WHO (Subject):     The actor deploying AI
ACTION (Verb):     What the AI does  
WHOM (Object):     Who/what is affected
```

### Examples

| Raw Case Title | WHO | ACTION | WHOM |
|----------------|-----|--------|------|
| "Commercial LPR (via HIDTA partners)" | ATF + Flock Safety | catalogs location data of | drivers nationwide |
| "School AI Flags Student" | School District | surveils and flags | students |
| "Bank Denies Loan via Algorithm" | Major Bank | automatically denies loans to | applicants |

### Modifiers (Context Enrichment)

Each triple element can have modifiers:

- **WHO modifiers:** Entity type (government, commercial), specific org (ATF, Flock), jurisdiction (federal, state)
- **ACTION modifiers:** Manner (secretly, automatically, systematically), completeness (partially, fully)
- **WHOM modifiers:** Vulnerability (minors, patients), program context (HIDTA, HIPAA)

### Story Arcs (Auto-detected from ACTION)

| Arc Name | Trigger Verbs | Theme |
|----------|---------------|-------|
| Panopticon | surveil, monitor, track, watch | Surveillance overreach |
| Computer Says No | deny, reject, flag, block | Algorithmic denial |
| Rise of Machines | automate, replace, eliminate | Job displacement |
| Minority Report | predict, profile, score, assess | Pre-crime / profiling |
| Data Harvest | collect, harvest, scrape, mine | Privacy violation |
| Black Box | decide, determine, judge | Unexplainable AI |

---

## 3. USER FLOW

### 3.1 Discovery Screen
**Purpose:** Present the case, get first impressions

**Elements:**
- Case-specific generated artwork (not emoji)
- Case title (semantic NVN format, not raw headline)
- Summary (2-3 sentences, "just the facts")
- Source link + source quality rating (Trustworthy/Suspicious)
- Nuance sliders (first impressions):
  - Safety ↔ Surveillance
  - Privacy ↔ Data Brokering
  - Benefit ↔ Harm
- Comedy style auto-detected (not user-selected)
- Button: "Open the Case →"

### 3.2 WHO Screen
**Purpose:** Identify the primary actor

**Elements:**
- Generated scene artwork reflecting the actor type
- Character reaction (GI - military analyst voice)
- Prompt: "Who is the primary actor?"
- 3 LLM-generated choices based on case content
- Progress dots (1 of 3 active)
- Auto-advance on selection

### 3.3 ACTION Screen  
**Purpose:** Identify what the AI does

**Elements:**
- Generated scene artwork reflecting the action
- Character reaction (Gary - tech analyst voice)
- Prompt: "[WHO] does what?"
- 3 LLM-generated verb choices
- Progress dots (2 of 3 active)
- Auto-advance on selection

### 3.4 WHOM Screen
**Purpose:** Identify who is affected

**Elements:**
- Generated scene artwork reflecting the affected parties
- Character reaction (Supes - ethics analyst voice)
- Prompt: "[WHO] [ACTION] whom?"
- 3 LLM-generated target choices
- Progress dots (3 of 3 active)
- Auto-advance on selection

### 3.5 Verdict Screen
**Purpose:** Heaven or Hell vote + story conclusion

**Elements:**
- Generated verdict artwork (scales of justice / flames)
- Complete triple displayed: `[WHO] → [ACTION] → [WHOM]`
- All three characters react to the complete triple
- Story conclusion (de-escalated, cartoon tone)
- Verdict buttons: 😇 HEAVEN / 😈 HELL
- Post-verdict nuance sliders (opinion shift tracking)
- Collective stats: "73% voted Hell on this case"

### 3.6 Notes Screen
**Purpose:** Capture user's case notes (the gold for AI training)

**Elements:**
- Prompt: "What did you notice about this case?"
- Text area with character counter
- Tiered rewards:
  - 10+ chars: 5 coins
  - 50+ chars: 10 coins
  - 100+ chars: 15 coins
  - 200+ chars: 25 coins
- Skip option (no reward)

### 3.7 Mint Screen
**Purpose:** Card reveal + collection

**Elements:**
- "CASE CLOSED" header
- Complete triple display
- Card preview with:
  - Name (NVN format)
  - Faction (Heaven/Hell with visual treatment)
  - ATK/DEF stats
  - Rarity (Common/Uncommon/Rare/Legendary)
  - Flavor quote
  - Special ability (for rare+)
- Scratch-to-reveal OR keep mystery option
- Reward display (+coins, +card)
- "Next Case →" button

---

## 4. SEMANTIC GRAPH ARCHITECTURE

### 4.1 Entity Resolution

Same real-world entity → same graph node:
- "ATF" = "Bureau of Alcohol, Tobacco, Firearms" = "the ATF"
- "Flock Safety" = "Flock" = "Flock LPR"

### 4.2 Graph Schema

```
NODES:
├── Entity (WHO)
│   ├── id, canonical_name, aliases[], entity_type
│   └── Examples: "ATF", "Google", "School District"
├── Action (VERB)  
│   ├── id, canonical_verb, synonyms[], arc_type
│   └── Examples: "surveils", "denies", "predicts"
├── Target (WHOM)
│   ├── id, canonical_name, aliases[], vulnerability_level
│   └── Examples: "citizens", "job applicants", "students"
└── Case
    ├── id, title, summary, source_url, faction
    └── Links to: who_id, action_id, whom_id

EDGES:
├── CASE_TRIPLE: Case → (WHO, ACTION, WHOM)
├── ENTITY_ALIAS: Entity ↔ Entity (same real-world thing)
├── ENTITY_HIERARCHY: Entity → Parent Entity (ATF → Government)
├── ACTION_SIMILARITY: Action ↔ Action (semantic similarity)
└── USER_SUBMISSION: User → Case → Triple (with vote)
```

### 4.3 Graph Queries

```sql
-- Find all cases where Government → surveils → Citizens
SELECT * FROM cases 
WHERE who_id IN (SELECT id FROM entities WHERE parent = 'Government')
AND action_id IN (SELECT id FROM actions WHERE canonical = 'surveils')
AND whom_id IN (SELECT id FROM targets WHERE canonical = 'citizens');

-- Find entities that most often appear in HELL cases
SELECT e.canonical_name, COUNT(*) as hell_count
FROM cases c JOIN entities e ON c.who_id = e.id
WHERE c.faction = 'hell'
GROUP BY e.id ORDER BY hell_count DESC;

-- Semantic similarity search
SELECT * FROM cases 
ORDER BY embedding <-> query_embedding 
LIMIT 10;
```

---

## 5. LLM INFERENCE PIPELINE

### 5.1 Extract Triple (on case load)

**Input:** Case title, description, source URL
**Output:** 
```json
{
  "who_choices": [
    {"value": "ATF", "confidence": 0.95},
    {"value": "Federal Law Enforcement", "confidence": 0.8},
    {"value": "Government Agency", "confidence": 0.6}
  ],
  "action_choices": [
    {"value": "catalogs location data of", "confidence": 0.9},
    {"value": "tracks movements of", "confidence": 0.7},
    {"value": "surveils", "confidence": 0.5}
  ],
  "whom_choices": [
    {"value": "drivers nationwide", "confidence": 0.9},
    {"value": "vehicle owners", "confidence": 0.7},
    {"value": "the public", "confidence": 0.5}
  ],
  "suggested_faction": "hell",
  "faction_reasoning": "Mass surveillance without consent"
}
```

### 5.2 Generate Story (after triple complete)

**Input:** Complete triple, case context, faction
**Output:** Character dialogue for each screen, de-escalated quotes

### 5.3 Generate Card (at mint)

**Input:** Triple, faction, user notes
**Output:** NVN title, flavor quotes, art prompt, stats

---

## 6. CHARACTER VOICES (Comedy Bible)

### Evil Brain (Host)
- Pompous, dramatic, thinks it's terrifying but is endearingly incompetent
- "EXCELLENT! Another case for the archives!"
- "MINIONS! Observe humanity's hubris!"

### GI (General Intelligence)  
- Military analyst, deadpan tactical assessments
- "Tactical assessment: this is either genius or disaster. History suggests disaster."
- "Probability of humans listening: 3%."

### Gary (AGI)
- Tech bro optimism meets harsh reality
- "The algorithm is working exactly as designed. The design is the problem."
- "We trained it on the internet. We are shocked it learned from the internet."

### Supes (Super Intelligence)
- Empathetic ethics analyst
- "Someone should ask the affected humans. Nobody will, but someone should."
- "The stakeholders were the last to know. As usual."

---

## 7. HUMOR FORMULAS

### De-escalation (Real → Cartoon)
| Real World | Cartoon Version |
|------------|-----------------|
| arrested | sent to the principal's office |
| surveilled | watched by Brain's minions |
| denied | put on the waitlist |
| fired | reassigned to the mailroom |
| lawsuit | strongly worded letter |

### Comedy Patterns
1. **Semantic Dual Meaning:** "AI agents" (software vs secret agents)
2. **Corporate Translator:** "improve user experience" → "collect more data"
3. **Scale Absurdity:** Reasonable thing → extrapolate to dystopia
4. **Reasonable Person Test:** "Explain this to your grandma..."

---

## 8. DATA MODEL (Postgres + pgvector)

### Core Tables

```sql
-- Entities (WHO/WHOM nodes)
CREATE TABLE entities (
  id UUID PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  aliases TEXT[],
  entity_type TEXT, -- government, commercial, individual
  parent_id UUID REFERENCES entities(id),
  embedding VECTOR(1536)
);

-- Actions (VERB nodes)  
CREATE TABLE actions (
  id UUID PRIMARY KEY,
  canonical_verb TEXT NOT NULL,
  synonyms TEXT[],
  arc_type TEXT, -- panopticon, computer_says_no, etc.
  valence INTEGER -- -2 to +2 (harmful to beneficial)
);

-- Cases
CREATE TABLE cases (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL, -- NVN format
  summary TEXT,
  description TEXT,
  source_url TEXT,
  source_quality TEXT, -- trustworthy, suspicious, unknown
  
  -- Semantic triple (foreign keys)
  who_id UUID REFERENCES entities(id),
  action_id UUID REFERENCES actions(id),
  whom_id UUID REFERENCES entities(id),
  
  -- Modifiers (JSONB for flexibility)
  modifiers JSONB DEFAULT '{"who":[],"action":[],"whom":[]}',
  
  -- Classification
  faction TEXT, -- heaven, hell
  story_arc TEXT,
  
  -- Voting
  heaven_votes INTEGER DEFAULT 0,
  hell_votes INTEGER DEFAULT 0,
  
  -- Embeddings
  embedding VECTOR(1536),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User submissions
CREATE TABLE triple_submissions (
  id UUID PRIMARY KEY,
  case_id UUID REFERENCES cases(id),
  user_id UUID,
  session_id TEXT,
  
  -- What they picked
  who_choice TEXT,
  action_choice TEXT,
  whom_choice TEXT,
  faction TEXT,
  
  -- Their notes (the gold)
  notes TEXT,
  
  -- Nuance ratings
  nuance_before JSONB,
  nuance_after JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User cards
CREATE TABLE user_cards (
  id UUID PRIMARY KEY,
  user_id UUID,
  case_id UUID REFERENCES cases(id),
  
  card_name TEXT,
  faction TEXT,
  attack INTEGER,
  defense INTEGER,
  rarity TEXT,
  flavor_text TEXT,
  ability JSONB,
  
  -- The triple they extracted
  triple_who TEXT,
  triple_action TEXT,
  triple_whom TEXT,
  
  revealed BOOLEAN DEFAULT FALSE,
  minted_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 9. API ENDPOINTS

### Edge Functions (Supabase)

```
POST /functions/v1/extract-triple
  Input: { case_id, title, description }
  Output: { who_choices, action_choices, whom_choices, suggested_faction }

POST /functions/v1/generate-story  
  Input: { case_id, triple, faction }
  Output: { scenes, character_dialogue, de_escalated_quotes }

POST /functions/v1/submit-verdict
  Input: { case_id, user_id, triple, faction, notes, nuance }
  Output: { card, rewards, collective_stats }

POST /functions/v1/search-cases
  Input: { query, who?, action?, whom? }
  Output: { cases[], web_results[] }

GET /functions/v1/graph-query
  Input: { query_type, params }
  Output: { nodes[], edges[], stats }
```

---

## 10. MINIGAMES (Loading Entertainment)

While LLM inference runs, player can earn bonus coins:

1. **Ink Blot Test:** Word association from abstract shape
2. **Word Runner:** Atari-style obstacle course, collect words
3. **Describe the Perp:** Describe a generated face
4. **Sticky Notes:** Arrange concept cards
5. **Classic Trivia:** AI ethics quiz

Minigame results feed back into semantic graph as edges.

---

## 11. REPUTATION SYSTEM

| Rank | Rep Required | Perks |
|------|--------------|-------|
| Newcomer | 0 | Basic access |
| Verified | 50 | See collective stats |
| Analyst | 200 | Access restricted cases |
| Expert | 500 | Grant credentials |
| Council | 1000 | Full access, governance |

### Earning Reputation
- Case approved: +10
- Triple voted best: +25
- Vote with consensus: +2
- Notes quality bonus: +5-25
- Catch duplicate: +20

---

## 12. TECH STACK

- **Frontend:** Single HTML file (current), or React/Vue/Svelte
- **Backend:** Supabase (Postgres + Edge Functions)
- **LLM:** Claude via Anthropic API or Hyperspace proxy
- **Vector Search:** pgvector extension
- **Hosting:** GitHub Pages (static) + Supabase (API)
- **Auth:** Anonymous sessions → optional wallet/DID

---

## 13. FUTURE: The UBI Vision

"Pay to play, except you're getting paid."

1. Users earn coins by quality contributions
2. Coins redeemable for real micropayments (QR/blockchain)
3. Quality analysts get endorsement funnels
4. Eventually: Universal Basic Income for AI trainers
5. "Mining brains to improve AI" - ethical data labeling at scale

---

## 14. IMMEDIATE PRIORITIES

1. ✅ Define semantic triple model
2. ✅ Design user flow (Discovery → WHO → ACTION → WHOM → Verdict → Notes → Mint)
3. ✅ Write character voices and humor guide
4. ⬜ Build graph schema in Postgres
5. ⬜ Enable pgvector for semantic search
6. ⬜ Wire LLM inference for triple extraction
7. ⬜ Generate proper artwork (not emojis)
8. ⬜ Deploy edge functions
9. ⬜ Seed database with properly formatted cases
10. ⬜ Test full flow end-to-end

---

*"One spin might end the world. Or save it."*
