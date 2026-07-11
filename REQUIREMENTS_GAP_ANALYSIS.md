# 📋 UCAR 4.2 - Requirements Checklist

**Based on:** REQUIREMENTS.md  
**Current State:** UCAR 4.0 (Supabase serving plane)  
**Analysis Date:** 2026-07-11

---

## ✅ IMPLEMENTED FEATURES

### 1. Core Concept ✅
- [x] Semantic triple model (WHO → ACTION → WHOM)
- [x] Real AI use case registry
- [x] User extractions and voting
- [x] Card collection (backend ready, needs minting)
- [x] Reputation system (table exists)

### 2. Semantic Triple Model ✅
- [x] WHO/ACTION/WHOM structure
- [x] Modifiers (WHO/ACTION/WHOM/CATEGORY chips implemented)
- [x] Entity resolution (entities table with aliases)
- [x] Action synonyms (actions table with synonyms)
- [x] Story arcs detection (partial - needs trigger mapping)

### 3. Data Model (Postgres) ✅
- [x] `entities` table (canonical_name, aliases, parent_id)
- [x] `actions` table (canonical_verb, synonyms)
- [x] `cases` table (title, summary, source_url, faction, votes)
- [x] `triple_submissions` table
- [x] `user_cards` table
- [x] `modifiers` table (for semantic expansion)

### 4. Semantic Graph Architecture 🟡 PARTIAL
- [x] Entity resolution with aliases
- [x] Entity hierarchy (parent_id references)
- [x] Action synonyms
- [x] Graph edges table (src_key, dst_key, weight)
- [x] Semantic expansion engine (term_expansions, search_signals)
- [ ] Vector embeddings (pgvector not fully enabled yet)
- [ ] Graph query endpoints

### 5. Search & Discovery ✅
- [x] Semantic search with expansion
- [x] Fuzzy matching (trigram indexes)
- [x] Web search integration (Tavily)
- [x] AI relevance filtering
- [x] Category filtering
- [x] "My Cases" personal feed

### 6. Case Filing ✅
- [x] Instant deterministic extraction
- [x] file-case edge function
- [x] URL import support
- [x] Error handling and CORS
- [x] Faction assignment

### 7. Extraction Pipeline 🟡 PARTIAL
- [x] extract-case edge function (835 lines)
- [x] Deterministic triple extraction
- [x] Instant feedback (no LLM wait)
- [ ] LLM-generated WHO/ACTION/WHOM choices (3 options per screen)
- [ ] Confidence scoring
- [ ] Suggested faction with reasoning

### 8. Security (Phase 0) ✅
- [x] RLS policies on all tables
- [x] Rate limiting system
- [x] registry_reader role isolation
- [x] Auto-cleanup via pg_cron

---

## ⬜ MISSING FEATURES (From REQUIREMENTS.md)

### User Flow Screens ❌ NOT IMPLEMENTED

#### 3.1 Discovery Screen
- [ ] Case-specific generated artwork (not emoji)
- [ ] NVN format title display
- [ ] Summary (2-3 sentences neutral)
- [ ] Source quality rating (Trustworthy/Suspicious)
- [ ] Nuance sliders:
  - [ ] Safety ↔ Surveillance
  - [ ] Privacy ↔ Data Brokering
  - [ ] Benefit ↔ Harm
- [ ] Comedy style auto-detection
- [ ] "Open the Case →" button

**Current State:** Cases display in feed, but no Discovery screen flow

#### 3.2 WHO Screen
- [ ] Generated scene artwork
- [ ] GI character reaction
- [ ] "Who is the primary actor?" prompt
- [ ] 3 LLM-generated choices
- [ ] Progress dots (1 of 3)
- [ ] Auto-advance on selection

**Current State:** Instant deterministic extraction (no guided flow)

#### 3.3 ACTION Screen
- [ ] Generated scene artwork
- [ ] Gary character reaction
- [ ] "[WHO] does what?" prompt
- [ ] 3 LLM-generated verb choices
- [ ] Progress dots (2 of 3)

**Current State:** Direct triple extraction, no character guidance

#### 3.4 WHOM Screen
- [ ] Generated scene artwork
- [ ] Supes character reaction
- [ ] "[WHO] [ACTION] whom?" prompt
- [ ] 3 LLM-generated target choices
- [ ] Progress dots (3 of 3)

**Current State:** No guided WHOM selection

#### 3.5 Verdict Screen
- [ ] Generated verdict artwork (scales/flames)
- [ ] Complete triple display
- [ ] All three characters react
- [ ] Story conclusion (de-escalated tone)
- [ ] 😇 HEAVEN / 😈 HELL buttons
- [ ] Post-verdict nuance sliders
- [ ] Collective stats display

**Current State:** Voting exists but no character-driven verdict screen

#### 3.6 Notes Screen
- [ ] "What did you notice?" prompt
- [ ] Text area with character counter
- [ ] Tiered rewards:
  - [ ] 10+ chars: 5 coins
  - [ ] 50+ chars: 10 coins
  - [ ] 100+ chars: 15 coins
  - [ ] 200+ chars: 25 coins
- [ ] Skip option

**Current State:** No notes collection interface

#### 3.7 Mint Screen
- [ ] "CASE CLOSED" header
- [ ] Complete triple display
- [ ] Card preview with:
  - [ ] NVN format name
  - [ ] Faction visual treatment
  - [ ] ATK/DEF stats
  - [ ] Rarity display
  - [ ] Flavor quote
  - [ ] Special ability (rare+)
- [ ] Scratch-to-reveal animation
- [ ] Keep mystery option
- [ ] Reward display (+coins, +card)
- [ ] "Next Case →" button

**Current State:** mint-card function exists but no reveal UI

---

### Character Voices ❌ NOT IMPLEMENTED

- [ ] Evil Brain (pompous host)
- [ ] GI (military analyst)
- [ ] Gary (tech bro realist)
- [ ] Supes (empathetic ethicist)
- [ ] Character dialogue generation
- [ ] De-escalated quotes

**Current State:** No character system implemented

---

### LLM Inference Pipeline ⬜ PARTIAL

#### 5.1 Extract Triple
- [x] Basic extraction (deterministic)
- [ ] 3 choices per element with confidence scores
- [ ] Suggested faction with reasoning
- [ ] Edge function: extract-triple

**Current State:** extract-case function exists but needs choice generation

#### 5.2 Generate Story
- [ ] Character dialogue for each screen
- [ ] De-escalated quotes
- [ ] Story arc detection
- [ ] Edge function: generate-story

**Current State:** NOT IMPLEMENTED

#### 5.3 Generate Card
- [ ] NVN title generation
- [ ] Flavor quotes
- [ ] Art prompt generation
- [ ] Stats derivation from triple
- [ ] Edge function: generate-card (or part of mint-card)

**Current State:** mint-card has basic stats, needs flavor/art

---

### Humor & De-escalation ❌ NOT IMPLEMENTED

- [ ] De-escalation mapping (Real → Cartoon)
- [ ] Comedy patterns:
  - [ ] Semantic dual meaning
  - [ ] Corporate translator
  - [ ] Scale absurdity
  - [ ] Reasonable person test
- [ ] Story arc themes

**Current State:** No humor system

---

### Minigames ❌ NOT IMPLEMENTED

- [ ] Ink Blot Test
- [ ] Word Runner (Atari-style)
- [ ] Describe the Perp
- [ ] Sticky Notes
- [ ] Classic Trivia
- [ ] Minigame results → semantic graph edges

**Current State:** Loading screen with flashing quotes (minimal)

---

### Reputation System 🟡 PARTIAL

- [x] reputation table exists
- [ ] Rank tiers (Newcomer → Council)
- [ ] Perks per rank
- [ ] Earning reputation triggers:
  - [ ] Case approved: +10
  - [ ] Triple voted best: +25
  - [ ] Vote with consensus: +2
  - [ ] Notes quality bonus: +5-25
  - [ ] Catch duplicate: +20
- [ ] Reputation display in UI

**Current State:** Table exists, logic not implemented

---

### Vector Search ⬜ NOT ENABLED

- [ ] pgvector extension enabled
- [ ] Embedding generation for cases
- [ ] Embedding generation for entities/actions
- [ ] Semantic similarity search
- [ ] ORDER BY embedding <-> query_embedding

**Current State:** Uses trigram fuzzy search instead

---

### Graph Query Endpoints ❌ NOT IMPLEMENTED

```
GET /functions/v1/graph-query
  Input: { query_type, params }
  Output: { nodes[], edges[], stats }
```

**Needed queries:**
- [ ] Find all cases where Government → surveils → Citizens
- [ ] Find entities most often in HELL cases
- [ ] Entity relationship graphs
- [ ] Action co-occurrence patterns

**Current State:** No graph query API

---

### Art Generation ❌ NOT IMPLEMENTED

- [ ] Case-specific artwork (not emoji)
- [ ] Scene artwork per screen (WHO/ACTION/WHOM)
- [ ] Verdict artwork (scales of justice / flames)
- [ ] Card artwork
- [ ] Art prompt generation
- [ ] Integration with art generation service

**Current State:** Uses emoji, no proper art

---

### UBI Vision ❌ FUTURE SCOPE

- [ ] Coin earning system
- [ ] Real micropayments (QR/blockchain)
- [ ] Endorsement funnels
- [ ] Universal Basic Income mechanics

**Current State:** Not started (Phase 3+)

---

## 📊 COMPLETION ANALYSIS

### By Major System

| System | Implemented | Partial | Missing | % Complete |
|--------|-------------|---------|---------|------------|
| **Data Model** | ✅ | - | - | 95% |
| **Security** | ✅ | - | - | 100% |
| **Search** | ✅ | - | - | 90% |
| **Extraction** | - | 🟡 | - | 40% |
| **User Flow Screens** | - | - | ❌ | 0% |
| **Characters** | - | - | ❌ | 0% |
| **Story Generation** | - | - | ❌ | 0% |
| **Card Minting** | - | 🟡 | - | 50% |
| **Reputation** | - | 🟡 | - | 20% |
| **Vector Search** | - | - | ❌ | 0% |
| **Art Generation** | - | - | ❌ | 0% |
| **Minigames** | - | - | ❌ | 0% |
| **Graph Queries** | - | - | ❌ | 0% |

### Overall Completion

**UCAR 4.2 Requirements:** ~30% complete

**Breakdown:**
- ✅ **Infrastructure:** 95% (data model, security, search)
- 🟡 **Extraction:** 40% (deterministic works, needs LLM choices)
- 🟡 **Card System:** 50% (backend ready, needs UI)
- ❌ **User Experience:** 5% (no character-driven flow)
- ❌ **Content Generation:** 0% (no story/humor/art)

---

## 🎯 CRITICAL PATH TO REQUIREMENTS COMPLIANCE

### Phase 1: LLM Integration (2-3 weeks)

**Goal:** Character-driven extraction with LLM choices

1. **Generate WHO choices** (extract-triple function)
   ```typescript
   POST /functions/v1/extract-triple
   Input: { case_id, title, description }
   Output: { 
     who_choices: [
       { value: "ATF", confidence: 0.95 },
       { value: "Federal Law Enforcement", confidence: 0.8 },
       { value: "Government Agency", confidence: 0.6 }
     ],
     action_choices: [...],
     whom_choices: [...]
   }
   ```

2. **Character system** (characters table + voices)
   - GI, Gary, Supes, Evil Brain
   - Voice patterns per character
   - Reaction generation function

3. **Story generation** (generate-story function)
   - Input: complete triple
   - Output: character dialogue for each screen
   - De-escalation logic

### Phase 2: User Flow Rebuild (2-3 weeks)

**Goal:** Guided WHO → ACTION → WHOM → Verdict flow

4. **Discovery Screen**
   - Case presentation
   - Nuance sliders (3 axes)
   - "Open the Case →" button

5. **Triple Extraction Screens** (3 screens)
   - WHO screen with GI
   - ACTION screen with Gary
   - WHOM screen with Supes
   - Progress dots (1/3, 2/3, 3/3)

6. **Verdict Screen**
   - All characters react
   - Story conclusion
   - Heaven/Hell vote
   - Post-verdict nuance sliders
   - Collective stats

7. **Notes Screen**
   - Tiered rewards (10/50/100/200 chars)
   - Character counter
   - Skip option

8. **Mint Screen**
   - Card reveal animation
   - Scratch-to-reveal
   - Reward display

### Phase 3: Content Systems (3-4 weeks)

**Goal:** Humor, art, and polish

9. **Humor System**
   - De-escalation dictionary (Real → Cartoon)
   - Comedy pattern templates
   - Story arc detection (Panopticon, Computer Says No, etc.)

10. **Art Generation**
    - Case artwork
    - Scene artwork (per screen)
    - Card artwork
    - Verdict artwork

11. **Minigames**
    - Pick 2-3 to implement
    - Loading screen integration
    - Bonus coin rewards

12. **Reputation Display**
    - Rank badges
    - Progress bars
    - Perk unlocks

### Phase 4: Advanced Features (2-3 weeks)

**Goal:** Graph queries and vector search

13. **Enable pgvector**
    ```sql
    CREATE EXTENSION vector;
    ALTER TABLE cases ADD COLUMN embedding vector(1536);
    ```

14. **Embedding generation**
    - Generate embeddings for cases
    - Generate embeddings for entities/actions
    - Update on case creation

15. **Graph query API**
    - Find patterns (WHO → ACTION → WHOM)
    - Entity frequency analysis
    - Action co-occurrence
    - Semantic similarity search

---

## ⚠️ ARCHITECTURAL MISMATCHES

### 1. **Deterministic vs LLM-driven**

**REQUIREMENTS.MD:** LLM generates 3 choices per screen, user picks one

**CURRENT UCAR 4.0:** Deterministic instant extraction (no user choices)

**Decision needed:** 
- Keep instant extraction? (faster, cheaper)
- Add LLM choices? (more engaging, follows requirements)
- Hybrid? (instant extraction, then LLM refinement)

### 2. **Character-driven vs Direct**

**REQUIREMENTS.MD:** GI/Gary/Supes guide through screens with reactions

**CURRENT UCAR 4.0:** Direct case filing, no character interaction

**Gap:** No character system implemented at all

### 3. **Guided Flow vs Search-first**

**REQUIREMENTS.MD:** Discovery → WHO → ACTION → WHOM → Verdict → Notes → Mint (7 screens)

**CURRENT UCAR 4.0:** Search → File → Done (2 steps)

**Gap:** Entire guided flow missing

### 4. **Art vs Emoji**

**REQUIREMENTS.MD:** Case-specific generated artwork, scene artwork, card artwork

**CURRENT UCAR 4.0:** Emoji placeholders, procedural SVG backgrounds

**Gap:** No art generation pipeline

### 5. **Story vs Data**

**REQUIREMENTS.MD:** De-escalated cartoon story, humor patterns, character reactions

**CURRENT UCAR 4.0:** Raw data display, no narrative layer

**Gap:** No story generation system

---

## 💡 RECOMMENDATIONS

### Option A: **Incremental Enhancement** (Recommended)

Keep current UCAR 4.0 as foundation, add requirements incrementally:

**Week 1-2:** LLM Integration
- Add extract-triple with 3 choices
- Add character voices
- Add generate-story function

**Week 3-4:** User Flow
- Build guided screens (WHO → ACTION → WHOM)
- Add Discovery and Verdict screens
- Add Notes and Mint screens

**Week 5-6:** Content Polish
- Humor system
- Art generation placeholders
- Reputation display

**Week 7-8:** Advanced Features
- pgvector
- Graph queries
- Minigames (optional)

### Option B: **Full Rebuild**

Start fresh with requirements as spec:

**Pros:**
- Clean architecture matching requirements
- Character-driven from start
- No legacy code debt

**Cons:**
- Lose 31 commits of progress
- Lose semantic expansion engine
- Lose My Cases, web search, etc.

### Option C: **Hybrid Approach**

Use UCAR 4.0 as API layer, build new frontend:

**Backend (keep):**
- Semantic expansion
- Web search integration
- Deterministic extraction
- Security hardening

**Frontend (rebuild):**
- Character-driven UI
- Guided flow screens
- Story generation
- Art integration

---

## 🎯 IMMEDIATE ACTION ITEMS

To align with REQUIREMENTS.MD:

1. **Define character system**
   ```sql
   CREATE TABLE characters (
     id UUID PRIMARY KEY,
     name TEXT, -- 'GI', 'Gary', 'Supes', 'Evil Brain'
     voice_pattern JSONB,
     role TEXT
   );
   ```

2. **Add extract-triple function**
   ```typescript
   // Generate 3 LLM choices per element
   // Return confidence scores
   // Suggest faction with reasoning
   ```

3. **Build Discovery screen**
   - Replace current feed with Discovery screen
   - Add nuance sliders
   - Add "Open the Case →" CTA

4. **Prototype WHO screen**
   - Test character-driven UI
   - Test 3-choice selection
   - Test progress dots

5. **Document architecture decision**
   - Write ADR: "Deterministic vs LLM extraction"
   - Write ADR: "Character system architecture"
   - Write ADR: "Art generation strategy"

---

## 📋 CHECKLIST SUMMARY

**Infrastructure:** ✅ 95% complete  
**Core extraction:** 🟡 40% complete  
**User flow screens:** ❌ 0% complete  
**Character system:** ❌ 0% complete  
**Story generation:** ❌ 0% complete  
**Art generation:** ❌ 0% complete  
**Humor system:** ❌ 0% complete  
**Minigames:** ❌ 0% complete  
**Reputation display:** ❌ 20% complete  
**Graph queries:** ❌ 0% complete  
**Vector search:** ❌ 0% complete  

**Overall:** ~30% of REQUIREMENTS.MD implemented

---

## 🚀 NEXT STEPS

**You have two paths:**

1. **Continue feature velocity** (current direction)
   - Build timeline UI
   - Add voting
   - Deploy card minting
   - Ship fast, iterate

2. **Align with requirements** (original vision)
   - Add character system
   - Build guided flow
   - Add LLM choices
   - Match original spec

**My recommendation:** Continue velocity, add requirements incrementally. You've built solid infrastructure. Layer the UX enhancements on top rather than rebuilding.

---

**What do you want to prioritize?**
- 🎭 Character system + guided flow (match requirements)
- 🚀 Timeline UI + voting (continue current direction)
- 🔬 LLM integration + 3 choices (hybrid approach)
- 🎨 Art generation pipeline (visual polish)
