# USE CASE ARMS RACE - PRODUCTION ROADMAP
## Atomic Implementation Tasks - Execute In Order

**Status:** 10-15% complete (demo functional, production systems missing)  
**Timeline:** 6-9 months to production-ready  
**Critical Path:** Phase 0 → U1 → U2 → U3 → EBL1 → Show Integration

---

## CURRENT STATE (as of 2026-07-08)

### ✅ What Works
- [x] Semantic triple extraction UI (game2.html) - WHO → ACTION → WHOM flow
- [x] Basic search (ILIKE fast path in search-cases function)
- [x] Reputation rank system (schema + triggers)
- [x] Deterministic card stats formulas (cardstats.ts)
- [x] Character-driven narrative (SVG figures + voices)
- [x] Case discovery flow (single-player demo mode)
- [x] Theme system (light/dark toggle, mostly complete)

### ❌ Critical Blockers
- [ ] **Database hardening** (RLS, rate limits, read isolation) - **PRODUCTION BLOCKER**
- [ ] **Semantic search disabled** (embedding dependencies broken)
- [ ] **Feed/Timeline system** (votes table, realtime, tabs)
- [ ] **Content verification pipeline** (autoverify, steward moderation)
- [ ] **Complaint system** (flagging, review, legal safety)
- [ ] **Card persistence** (cards/instances tables, storage pipeline)
- [ ] **Battle system** (all of Phases 3-4)
- [ ] **Daily show integration** (episodes table, automation)

---

## PHASE 0: HARDENING (PREREQUISITE - NO FLAG)
**Goal:** Database safe to attach economy. Must complete before any other phase.  
**Timeline:** 2-3 weeks  
**Acceptance:** All 5 checkboxes must pass

### Task 0.1: Audit and Document Current RLS State
**File:** `db/POLICIES.md` (create new)
- Grep: `grep -n "enable row level security" supabase/migrations/*.sql`
- Document current RLS status on all 11 tables
- Identify which tables allow anonymous reads vs writes
- Write policy requirements for each table per UCAR_REGISTRY_BUILD_PLAN invariant 1

### Task 0.2: Create Registry Read-Only Role
**File:** `supabase/migrations/003_rls_hardening.sql` (create new)
- Create Postgres role `registry_reader` with SELECT-only on `use_cases`, `semantic_modifiers`
- Update edge function connection to use `registry_reader` when querying registry tables
- Add constraint test: attempt INSERT from EBL function, assert failure
- Document in `db/POLICIES.md`

### Task 0.3: Implement Rate Limiting Table + Logic
**Files:** 
- `supabase/migrations/004_rate_limiting.sql` (create new)
- `supabase/shared/rateLimit.ts` (create new)

Schema:
```sql
CREATE TABLE rate_limits (
  user_id UUID NOT NULL,
  function_name TEXT NOT NULL,
  minute_bucket TIMESTAMPTZ NOT NULL,
  call_count INT NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, function_name, minute_bucket)
);
CREATE INDEX ON rate_limits(minute_bucket) WHERE minute_bucket > NOW() - INTERVAL '5 minutes';
```

Logic in `rateLimit.ts`:
```typescript
export async function checkRateLimit(userId: string, fnName: string, limit = 30): Promise<boolean> {
  // UPSERT into rate_limits, return false if call_count > limit
}
```

Update all mutating edge functions (submit-verdict, update-case) to call `checkRateLimit()` first, return HTTP 429 on breach.

### Task 0.4: Remove Admin Backdoor (if exists)
**File:** `supabase/functions/*/index.ts` (search all)
- Grep: `grep -rn "email.*brain\|@evilbrain" supabase/functions/`
- Remove any logic granting privileges based on email pattern matching
- Admin must be set via `user_profiles.role = 'admin'` column only
- Document admin creation process in `db/POLICIES.md`

### Task 0.5: Implement Email Magic Link Auth
**Files:**
- `supabase/migrations/005_auth_upgrade.sql` (if needed)
- `index.html` (update auth UI)
- `supabase/functions/auth-callback/index.ts` (create new for post-auth flow)

Requirements:
- Enable Supabase Auth magic links (email OTP)
- Anonymous `x-anon-id` remains for browsing only
- Claiming, voting, battles require authenticated user
- Update RLS policies to check `auth.uid()` for mutations
- Keep current anonymous demo mode for slot machine

### Task 0.6: Write RLS Policies for All Tables
**File:** `supabase/migrations/006_rls_policies.sql` (create new)

For each table in 001_did_reputation.sql and 002_semantic_triples.sql:
```sql
ALTER TABLE use_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read approved cases" ON use_cases FOR SELECT USING (status = 'machine_verified');
CREATE POLICY "Autoverify service can insert" ON use_cases FOR INSERT TO service_role WITH CHECK (true);
-- ... repeat for all 11 tables
```

Document every policy in `db/POLICIES.md` with rationale.

### Task 0.7: Acceptance Tests for Phase 0
**File:** `tests/phase0/hardening.test.ts` (create new)

Checklist:
- [ ] No code path grants privileges based on email content (test: search codebase, assert none)
- [ ] Unauthenticated user cannot mutate any table via any endpoint (test: call submit-verdict without auth, expect 401)
- [ ] Test proving EBL functions cannot write registry tables passes (test: attempt INSERT as registry_reader role, expect permission denied)
- [ ] RLS enabled on 100% of tables; `db/POLICIES.md` exists and complete (test: query pg_tables, assert all have rls = true)
- [ ] Rate limit returns HTTP 429 on 31st call in a minute (test: loop 31 POST requests to submit-verdict, assert 429)

**Do not proceed to Phase U1 until all 5 tests pass.**

---

## PHASE U1: FEED (FLAG_FEED)
**Goal:** Twitter-style timeline with voting, realtime updates, share meta  
**Timeline:** 2-3 weeks  
**Prerequisites:** Phase 0 complete

### Task U1.1: Create Missing Schema (votes, watches, status_log)
**File:** `supabase/migrations/007_feed_tables.sql` (create new)

From UCAR_REGISTRY_BUILD_PLAN.md section 2.5:
```sql
CREATE TABLE votes (
  user_id UUID NOT NULL,
  case_id UUID NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('good','evil')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, case_id)
);

CREATE TABLE watches (
  user_id UUID NOT NULL,
  case_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, case_id)
);

CREATE TABLE case_status_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  case_id UUID NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Add RLS policies for each table in same migration.

### Task U1.2: Update use_cases Table with Cached Vote Counters
**File:** `supabase/migrations/008_vote_counters.sql` (create new)

```sql
ALTER TABLE use_cases ADD COLUMN good_votes INT NOT NULL DEFAULT 0;
ALTER TABLE use_cases ADD COLUMN evil_votes INT NOT NULL DEFAULT 0;
ALTER TABLE use_cases ADD COLUMN votes_total INT GENERATED ALWAYS AS (good_votes + evil_votes) STORED;
```

### Task U1.3: Create vote-on-case Edge Function
**File:** `supabase/functions/vote-on-case/index.ts` (create new)

Logic:
1. Check auth (require user_id)
2. Check rate limit (30/min)
3. UPSERT into votes table (user can change vote)
4. Recompute good_votes/evil_votes counters on use_cases
5. Publish delta to Supabase Realtime channel `feed`
6. Return updated vote counts

### Task U1.4: Build Timeline Feed UI (Replace Search-First UI)
**File:** `index.html` (major refactor of main screen)

New structure:
- Tabs: Latest | Top | Under Fire | Flips
- Infinite scroll with cursor pagination
- Each case renders as "card-as-post" (UCAR_REGISTRY_BUILD_PLAN section 2.1)
- Action row per case: Vote Good | Vote Evil | Share | Complain | Watch
- Vote bars update live via Realtime

Remove or minimize search prominence (search becomes modal or secondary).

### Task U1.5: Server-Side Rendering (SSR) for First Paint
**Options:**
1. **Static snapshot:** Generate HTML with top 20 cards via cron, commit to repo
2. **Edge function HTML:** Serve initial HTML from Supabase edge function
3. **GitHub Actions build:** Pre-render on deploy

Choose option 1 (simplest for static hosting):
- **File:** `scripts/snapshot-feed.ts` (create new)
- Query top 20 cases (Latest tab)
- Render full HTML with inlined cards
- Write to `index.html` (or `index-snapshot.html` included via template)
- Run daily via GitHub Actions

### Task U1.6: Add OpenGraph and Twitter Card Meta Tags
**File:** `index.html` (update `<head>`)

Per UCAR_REGISTRY_BUILD_PLAN section 2.2:
```html
<meta property="og:title" content="[Case Title] | USE CASE ARMS RACE">
<meta property="og:description" content="[Vote Ratio] | [Summary]">
<meta property="og:image" content="[Card PNG URL from storage]">
<meta name="twitter:card" content="summary_large_image">
```

For individual case pages (need routing or query param):
- `/case?id=abc123` renders case-specific meta
- Share button copies `usecasearmsrace.com/case?id=...`

### Task U1.7: Implement Realtime Subscriptions
**File:** `index.html` (add to existing script)

```javascript
const channel = supabase.channel('feed')
  .on('broadcast', { event: 'vote_delta' }, (payload) => {
    // Update vote bar for case_id in DOM
  })
  .on('broadcast', { event: 'new_case' }, (payload) => {
    // Prepend case to Latest tab
  })
  .subscribe();
```

Update vote-on-case and submit-verdict functions to publish broadcasts.

### Task U1.8: Implement Tab Queries (Latest, Top, Under Fire, Flips)
**File:** `supabase/functions/feed-query/index.ts` (create new)

Query logic per UCAR_REGISTRY_BUILD_PLAN section 2.3:
- **Latest:** `ORDER BY created_at DESC LIMIT 20 OFFSET cursor`
- **Top:** Score = `votes_total * ln(1 + votes_total) * exp(-age_hours / 72)` (TUNABLE)
- **Under Fire:** `WHERE status = 'under_review' OR case_id IN (SELECT product_id FROM battles WHERE state != 'resolved')`
- **Flips:** `WHERE faction_flipped_at > NOW() - INTERVAL '30 days' ORDER BY faction_flipped_at DESC`

Return cursor for pagination.

### Task U1.9: Acceptance Tests for Phase U1
**File:** `tests/phase-u1/feed.test.ts` (create new)

Checklist:
- [ ] First paint contains 20 cards with no client fetch (test: view-source, grep for case titles in HTML)
- [ ] One vote per user, changeable, counters reconcile (test: vote, change vote, query votes table and use_cases counters, assert match)
- [ ] Shared case unfurls with card PNG on X card validator (manual test: share URL, check validator.twitter.com)
- [ ] Feed delta arrives via Realtime within 2s of a vote (test: vote in one client, assert broadcast received in spectator client)

---

## PHASE U2: AUTOVERIFY (FLAG_AUTOVERIFY)
**Goal:** Content moderation pipeline (7-stage verification)  
**Timeline:** 3-4 weeks  
**Prerequisites:** Phase U1 complete

### Task U2.1: Fix Embedding Dependencies
**File:** `supabase/functions/search-cases/index.ts` (fix existing)

Current blocker (line 2):
```typescript
// Deep/semantic search is disabled until embed() dependencies are fixed.
```

Action:
- Grep: `grep -n "embed" supabase/functions/*/index.ts`
- Identify missing import or API (likely `@supabase/supabase-js` or Anthropic embeddings)
- Install dependency in `supabase/functions/deno.json` (create if missing)
- Implement `embed(text: string): Promise<number[]>` using Claude or OpenAI embeddings
- Re-enable semantic search with pgvector cosine similarity

### Task U2.2: Create Verification Tables
**File:** `supabase/migrations/009_verification_tables.sql` (create new)

From UCAR_REGISTRY_BUILD_PLAN section 3.3:
```sql
CREATE TABLE verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL,
  stage TEXT NOT NULL,
  outcome TEXT NOT NULL,
  rationale TEXT NOT NULL,
  model_action_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE model_actions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  case_id UUID NOT NULL,
  role TEXT NOT NULL, -- 'verifier' | 'classifier' | 'triage'
  stage TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  output JSONB NOT NULL,
  confidence NUMERIC,
  model_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Task U2.3: Implement Stage 1-3 (Deterministic Checks)
**File:** `supabase/functions/autoverify/index.ts` (create new)

Stages:
1. **Schema gate:** Required fields present, category valid, impact 1-5
2. **Source fetch:** HTTP GET source_url, check status 200, has content
3. **Dedupe:** Exact URL match → merge; else embed + cosine >= 0.92 → flag as duplicate

No model calls yet. Return verdict: `pass | needs_human | rejected` with reason.

### Task U2.4: Implement Stage 4-6 (Model Checks)
**File:** `supabase/functions/autoverify/index.ts` (extend)

Stages (use Claude Sonnet via Anthropic API):
4. **Prohibited screen:** Prompt: "Does this case contain spam, doxxing, or direct harm content? Yes/No/Unsure + reason"
5. **Claim-source consistency:** Prompt: "Does the source URL actually document this use case by this organization? Supported/Partially/Unsupported + rationale"
6. **Classification:** Prompt: "Confirm or correct: category = {X}, impact = {Y}. Output: category, impact, rationale"

Log all model calls to `model_actions` table with input hash and confidence.

### Task U2.5: Integrate Autoverify into Submission Flow
**File:** `supabase/functions/submit-verdict/index.ts` (update existing)

After case submission:
1. Set status = 'pending'
2. Call autoverify function (can be async/queued)
3. If pass: status = 'machine_verified', trigger card mint
4. If needs_human: status = 'needs_human', add to admin queue
5. If rejected: status = 'rejected', log reason, notify submitter

### Task U2.6: Build Admin Queue UI for needs_human
**File:** `admin.html` (major update)

Features:
- List all cases with status = 'needs_human', oldest first
- Show: case details, all verifications with stage outcomes, steward rationales
- Actions: Approve → machine_verified | Reject → rejected | Edit & Approve
- SLA timer: show hours since submission, highlight if > 48h

### Task U2.7: Write Reconciliation Job (Nightly Counter Check)
**File:** `supabase/functions/reconcile-votes/index.ts` (create new)

Per UCAR_REGISTRY_BUILD_PLAN section 2.5:
- Recompute good_votes/evil_votes from votes table
- Compare to cached counters on use_cases
- If mismatch: log error, repair from votes (truth)
- Run via pg_cron: `SELECT cron.schedule('reconcile-votes', '0 3 * * *', 'SELECT net.http_post(...)')`

### Task U2.8: Acceptance Tests for Phase U2
**File:** `tests/phase-u2/autoverify.test.ts` (create new)

Checklist:
- [ ] Dead source routes to needs_human, never rejected (test: submit case with 404 URL, assert status = needs_human)
- [ ] Duplicate URL merges; 0.92 similarity flags (test: submit identical case, assert merge; submit near-duplicate, assert flagged)
- [ ] Unsupported claim-source routes to needs_human (test: mock model response with 'unsupported', assert needs_human)
- [ ] Every stage produces verifications row and model_actions row (test: count rows after autoverify, assert 7 verifications + 3 model_actions)
- [ ] p95 pipeline latency under 2 minutes on staging (test: 100 cases, measure time, assert p95 < 120s)

---

## PHASE U3: COMPLAINTS (FLAG_COMPLAINTS)
**Goal:** Complaint filing, triage, review, EBL propagation  
**Timeline:** 1-2 weeks  
**Prerequisites:** Phase U2 complete

### Task U3.1: Create Complaints Schema
**File:** `supabase/migrations/010_complaints.sql` (create new)

From UCAR_REGISTRY_BUILD_PLAN section 4.5:
```sql
CREATE TABLE complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL,
  filed_by UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('factual_error','wrong_attribution','framing','duplicate','dead_source','legal_request')),
  detail TEXT NOT NULL CHECK (char_length(detail) >= 100),
  evidence_url TEXT,
  relationship TEXT NOT NULL DEFAULT 'none' CHECK (relationship IN ('none','employee_of_named_org','counsel_for_named_org','submitter')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','merged','dismissed','upheld','appealed')),
  triage_memo TEXT,
  resolved_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE review_queue (
  case_id UUID PRIMARY KEY,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  escalated_at TIMESTAMPTZ,
  complaint_ids UUID[] NOT NULL
);
```

Add rate limit: max 3 open complaints per user (TUNABLE).

### Task U3.2: Build Complaint Filing UI
**File:** `index.html` (add modal or page)

Form fields:
- Complaint type (dropdown)
- Detail (textarea, min 100 chars, required)
- Evidence URL (optional)
- Relationship (radio: none | employee | counsel | submitter)
- Notice: "False named-party claims are bannable" (if employee/counsel selected)

Submit → POST to `supabase/functions/file-complaint/index.ts`

### Task U3.3: Implement file-complaint Edge Function
**File:** `supabase/functions/file-complaint/index.ts` (create new)

Logic:
1. Check auth, rate limit (3 open max)
2. Insert into complaints table
3. Set `use_cases.contested = true` for case_id
4. Trigger triage job (call triage function or enqueue)
5. If relationship = employee/counsel OR type = legal_request: send admin email page (use Supabase email or SendGrid)

### Task U3.4: Implement Triage Function (Steward Model)
**File:** `supabase/functions/triage-complaint/index.ts` (create new)

Per UCAR_REGISTRY_BUILD_PLAN section 4.2:
- Prompt steward model: "Should this complaint suspend the case? Suspend/Dismiss + memo"
- Named-party complaints: always suspend (skip model)
- Legal_request: always suspend (skip model)
- Outcome A (suspend): status → under_review, insert into review_queue, log to case_status_log
- Outcome B (dismiss): contested → false, complaint.status → dismissed, log reason

Target p95: under 5 minutes.

### Task U3.5: Update Admin Queue to Show Review Cases
**File:** `admin.html` (extend)

New section: "Cases Under Review"
- List all cases in review_queue, oldest first
- Show: case details, all merged complaints, steward triage memo, source snapshots
- Actions:
  - Reinstate (status → machine_verified, public reason required)
  - Correct & Reinstate (edit fields, re-mint card if needed, log diff)
  - Retract (terminal status, EBL card becomes unplayable)
- SLA: 7 days, escalate reminder at 5 days

### Task U3.6: Add EBL Propagation Hooks (Case Status → Card Status)
**File:** (depends on EBL codebase location)

Per UCAR_REGISTRY_BUILD_PLAN section 4.4:
- EBL claim-product: reject if case.status != 'machine_verified'
- EBL battle-referee: reject decks with instances of under_review/retracted cards
- EBL settle-mining: products of under_review cases mine at 0
- EBL retraction: dissolve product, refund seat at 50% cost

**Note:** This task requires access to EBL codebase (evilbrainlabs.com). If separate repo, coordinate integration.

### Task U3.7: Add Status Log UI to Case Pages
**File:** `index.html` (add to case detail view)

Display `case_status_log` table for each case:
- Table: Date | From Status | To Status | Actor | Reason
- Show all transitions including dismissed complaints
- Public transparency requirement (UCAR_REGISTRY_BUILD_PLAN invariant 5)

### Task U3.8: Implement Under Fire and Flips Tabs
**File:** `supabase/functions/feed-query/index.ts` (extend from U1.8)

Queries:
- **Under Fire:** Cases with status = under_review OR active battles (join to EBL battles table if accessible)
- **Flips:** Cases where faction changed in last 30 days (use faction_flipped_at timestamp)

### Task U3.9: Acceptance Tests for Phase U3
**File:** `tests/phase-u3/complaints.test.ts` (create new)

Checklist:
- [ ] Filing sets contested instantly; triage resolves within 5 min p95 (test: file complaint, poll contested flag, then wait for triage, measure time)
- [ ] Named-party complaint suspends regardless of triage (test: file with relationship=employee_of_named_org, assert status → under_review without model call)
- [ ] Suspended card rejected from EBL claim and battle (test: attempt claim via EBL function, expect rejection)
- [ ] Under_review product mines 0; reinstatement resumes; retraction dissolves with 50% refund (test: check mining_ledger, assert 0 during review, positive after reinstate)
- [ ] Ten complaints from brigade collapse to one review (test: file 10 complaints on same case from different users, assert 1 review_queue row)
- [ ] Status log renders publicly including dismissals (test: query case page HTML, assert status_log table visible)

---

## PHASE EBL-1: CARD MINTING & ART PIPELINE (FLAG_MINT_V2)
**Goal:** Cards persist to storage with deterministic art  
**Timeline:** 1-2 weeks  
**Prerequisites:** Phase U1 complete (can run parallel to U2-U3)

### Task EBL1.1: Create Card Schema
**File:** `supabase/migrations/011_cards.sql` (create new)

From EBL_BATTLER_BUILD_PLAN section 4.1:
```sql
CREATE TABLE cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  impact INT NOT NULL CHECK (impact BETWEEN 1 AND 5),
  power INT NOT NULL,
  rarity TEXT NOT NULL CHECK (rarity IN ('common','uncommon','rare','legendary')),
  faction TEXT NOT NULL CHECK (faction IN ('heaven','hell')),
  alignment_ratio NUMERIC NOT NULL,
  art_url TEXT NOT NULL,
  art_seed TEXT NOT NULL,
  source_url TEXT NOT NULL,
  minted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  faction_flipped_at TIMESTAMPTZ
);

CREATE TABLE card_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES cards(id),
  owner_id UUID,
  serial INT NOT NULL,
  foil TEXT NOT NULL DEFAULT 'none' CHECK (foil IN ('none','holo','crayon')),
  source TEXT NOT NULL CHECK (source IN ('claim','scratch','quest','takeover','admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (card_id, serial)
);

CREATE TABLE backgrounds (
  id SERIAL PRIMARY KEY,
  storage_path TEXT NOT NULL,
  weight INT NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT TRUE
);
```

### Task EBL1.2: Implement Mint Function
**File:** `supabase/functions/mint-card/index.ts` (create new)

Logic (from EBL_BATTLER_BUILD_PLAN section 4.3):
1. Input: case_id
2. Query use_cases for impact, good_votes, evil_votes
3. Derive:
   - power = impact * 2
   - alignment_ratio = good / max(good + evil, 1)
   - faction = 'heaven' if alignment_ratio >= 0.5 else 'hell'
   - rarity: legendary (5), rare (4), uncommon (3), common (1-2)
4. art_seed = sha256(case_id)
5. Select background: `bg_index = parseInt(art_seed.slice(0,8), 16) % total_active_weight`
6. Render SVG (reuse existing SVG renderer from index.html, extract to shared function)
7. Rasterize SVG → PNG (1024px wide) using Deno canvas or external service
8. Upload to Supabase Storage: `storage://cards/{card_id}.png` and `.svg`
9. Insert into cards table with art_url
10. Return card object

Idempotent: check if card exists for case_id, skip if already minted.

### Task EBL1.3: Seed Backgrounds Library
**File:** `supabase/storage/backgrounds/` (upload via Supabase dashboard or script)

Actions:
- Create storage bucket `backgrounds` (public read)
- Upload 3 solid-color fallback backgrounds (cream, brain-pink, neutral gray)
- Insert rows into backgrounds table with storage paths
- [OWNER decision pending]: Jason to provide final art assets

### Task EBL1.4: Extract SVG Renderer to Shared Module
**File:** `supabase/shared/renderCard.ts` (create new)

Refactor from index.html lines 400-1000 (approximate):
- Extract `buildScene()` or equivalent SVG generator
- Input: card name, category, impact, power, faction, background_url, case_id, source_url
- Output: SVG string
- Use existing color palette logic (getStrokeColor, getPalettes)
- Ensure deterministic: same inputs → same SVG

### Task EBL1.5: Implement SVG → PNG Rasterization
**Options:**
1. **Deno canvas:** Use `deno-canvas` or `skia-canvas` (requires native module)
2. **External service:** Call imgix, Cloudinary, or Puppeteer microservice
3. **GitHub Actions:** Pre-render on commit (slow, not scalable)

Recommend option 2 (external service) for reliability:
- **File:** `supabase/shared/rasterize.ts`
- POST SVG to rasterization endpoint
- Return PNG buffer
- Upload to storage

### Task EBL1.6: Trigger Minting on Case Approval
**File:** `supabase/functions/autoverify/index.ts` (extend)

After status → machine_verified:
1. Call mint-card function (can be async/queued)
2. If mint fails: log error, DO NOT roll back case approval (minting must never block registry)
3. Retry mint on next attempt (idempotent check prevents duplicates)

### Task EBL1.7: Write Backfill Script for Existing Cases
**File:** `scripts/backfill-mint.ts` (create new)

Logic:
- Query all cases with status = 'machine_verified' AND NOT EXISTS (SELECT 1 FROM cards WHERE case_id = use_cases.id)
- For each: call mint-card function
- Idempotent: safe to re-run
- Run via: `deno run --allow-net --allow-env scripts/backfill-mint.ts`

### Task EBL1.8: Implement Nightly Alignment Sync (Faction Flips)
**File:** `supabase/functions/sync-alignment/index.ts` (create new)

Per EBL_BATTLER_BUILD_PLAN section 4.3:
1. Query all cards
2. Recompute alignment_ratio from current use_cases votes
3. New faction = 'heaven' if ratio >= 0.5 else 'hell'
4. If faction changed AND ratio is at least 0.05 past 0.5 (hysteresis):
   - Update cards.faction, set faction_flipped_at = NOW()
   - Insert into card_events: `{type: 'faction_flip', card_id, old_faction, new_faction}`
5. Schedule via pg_cron: `0 2 * * *` (2am daily)

### Task EBL1.9: Create card_events Table
**File:** `supabase/migrations/012_card_events.sql` (create new)

```sql
CREATE TABLE card_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  card_id UUID NOT NULL REFERENCES cards(id),
  type TEXT NOT NULL, -- 'faction_flip', 'corrected', etc.
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Task EBL1.10: Update Card Display to Use Storage URLs
**File:** `index.html` and `game2.html` (update)

Replace inline SVG generation with:
- Query cards table for art_url
- Render `<img src="{art_url}" alt="{card.name}">`
- Fallback: if art_url missing, render SVG client-side (backward compat)

### Task EBL1.11: Acceptance Tests for Phase EBL-1
**File:** `tests/phase-ebl1/minting.test.ts` (create new)

Checklist:
- [ ] Submitting test case creates exactly one card with correct derived stats per 4.3 (test: insert case with fixed votes, mint, assert power = impact * 2)
- [ ] Re-running mint on same case is no-op (test: call mint twice, assert 1 row in cards)
- [ ] Two mints of same case in parallel do not create duplicates (test: spawn 2 mint calls simultaneously, assert UNIQUE constraint holds)
- [ ] Same case always selects same background (test: mint case A twice, assert art_seed and background match)
- [ ] PNG and SVG exist in storage after mint (test: query art_url, fetch URL, assert 200)
- [ ] Backfill script mints all existing approved cases without error (test: run script, count cards, assert = count of machine_verified cases)
- [ ] Nightly alignment sync flips test card when votes cross 0.55, does not flip at 0.52 (test: update votes, run sync, assert faction changes only at 0.55)

---

## PHASE SHOW: DAILY SHOW INTEGRATION (FLAG_SHOW)
**Goal:** Episodes table, steward brief, Card of the Day, export pipeline  
**Timeline:** 1-2 weeks  
**Prerequisites:** Phase U1, U2, EBL-1 complete

### Task SHOW.1: Create Episodes Schema
**File:** `supabase/migrations/013_episodes.sql` (create new)

From SHOW_LAUNCH_RUNBOOK section 2:
```sql
CREATE TABLE episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number INT UNIQUE NOT NULL,
  air_date DATE NOT NULL,
  featured_case_id UUID NOT NULL,
  ticker_case_ids UUID[] NOT NULL DEFAULT '{}',
  battle_replay_id UUID,
  video_url TEXT,
  published_at TIMESTAMPTZ
);
```

### Task SHOW.2: Implement Steward Brief Function
**File:** `supabase/functions/steward-brief/index.ts` (create new)

Per SHOW_LAUNCH_RUNBOOK section 3:
- Query: top new cases (created in last 24h, by votes_total)
- Query: overnight flips (faction_flipped_at in last 24h)
- Query: battle results (from EBL battles table, if accessible)
- Query: review outcomes (case_status_log for yesterday)
- Query: anomalies (e.g., high complaint volume, dead sources)
- Format: neutral prose, case IDs cited, no jokes (steward voice)
- Deliver: insert into admin inbox or send email
- Schedule: pg_cron at 05:30 UTC (`30 5 * * *`)

### Task SHOW.3: Build Episode Creation UI in Admin
**File:** `admin.html` (extend)

New section: "Episode Editor"
- Input: episode number, air date, featured_case_id (dropdown of verified cases)
- Input: ticker_case_ids (multi-select)
- Input: battle_replay_id (dropdown of battles, if EBL accessible)
- Input: video_url (after recording)
- Pre-publish checklist (SHOW_LAUNCH_RUNBOOK section 3):
  - [ ] Featured case is machine_verified
  - [ ] Source URL live (re-check button)
  - [ ] Card art current (show art_url preview)
  - [ ] No [COPY] placeholders in case (scan case fields)
  - [ ] Episode row created before video upload
- Save as draft (published_at = NULL)
- Publish button: set published_at = NOW(), trigger Card of the Day

### Task SHOW.4: Implement Card of the Day Logic
**File:** `supabase/functions/publish-episode/index.ts` (create new)

On episode publish (published_at set):
1. Update featured_case: add flag `is_card_of_day = true`, set `card_of_day_until = NOW() + INTERVAL '24 hours'`
2. Pin case in feed: insert into feed_pins table (create if needed) or use case_status_log event
3. Send notifications: to users watching the case (from watches table)
4. EBL propagation: set EBL card as "free to play for 24h, win-with-it-keep-it" (coordinate with EBL codebase)
5. Return episode object

### Task SHOW.5: Update Index.html with Episode Carousel
**File:** `index.html` (update home screen)

Design per user request:
- Top section: Featured video embed (latest episode)
- Below: horizontal scrollable carousel of previous episodes (most recent 10)
- Each episode card: thumbnail, episode number, air date, Case of the Day title
- Click → expand episode details modal or navigate to episode page

Query: `SELECT * FROM episodes WHERE published_at IS NOT NULL ORDER BY air_date DESC LIMIT 10`

### Task SHOW.6: Add YouTube Shorts / TikTok / LinkedIn Links
**File:** `index.html` (add social icons to episode cards)

Per user request: "pointing out to Youtube shorts, Tiktok, and LinkedIn"

Structure:
- Store social URLs in episodes table: `youtube_shorts_url`, `tiktok_url`, `linkedin_url` (nullable)
- Admin editor adds these after cross-posting
- Episode card renders icons: 📺 YouTube | 🎵 TikTok | 💼 LinkedIn
- Click → open in new tab

### Task SHOW.7: Create Standards Page
**File:** `standards.html` (create new)

Content per SHOW_LAUNCH_RUNBOOK section 5:
1. What the registry is
2. What MACHINE VERIFIED means
3. Who judges Good/Evil (community votes, flippable)
4. How to complain (form, SLA, named-party fast lane)
5. Corrections log (public status history)
6. AI disclosure (steward model, what it does/doesn't do)
7. Satire notice (EBL is satirical, no endorsement)

Link from footer of every page: "Standards & Complaints"

### Task SHOW.8: Create Steward's Own Registry Entry
**File:** Manual data entry or script

Per SHOW_LAUNCH_RUNBOOK section 4 (T-7 checklist):
- Submit case: "The Steward (model) → verifies documentation of → AI use cases submitted to UCAR"
- Source URL: link to MODEL_STEWARD_SPEC.md (host on GitHub or site)
- Category: TBD (likely "Content Moderation" or new category)
- Impact: OWNER decision
- Vote: community votes on the steward itself (meta!)

### Task SHOW.9: Implement Battle Export Function (Depends on EBL Phase 6)
**File:** `supabase/functions/export-replay/index.ts` (create new, OR in EBL repo)

Per EBL_BATTLER_BUILD_PLAN section 9:
- Input: battle_id
- Query: all battle_events for battle
- Output: JSON bundle with events, final state, card art URLs, combatant names
- Auth: admin role only (check user_profiles.role)
- Return: download link or inline JSON

Use for show's Battle Report segment.

### Task SHOW.10: Acceptance Tests for Show Phase
**File:** `tests/phase-show/episodes.test.ts` (create new)

Checklist:
- [ ] Episode creation enforces pre-publish checklist (test: attempt publish with unverified case, expect rejection)
- [ ] Publishing episode sets Card of the Day flag for 24h (test: publish, check featured_case.is_card_of_day = true and card_of_day_until timestamp)
- [ ] Steward brief runs at 05:30 UTC and delivers (test: manually trigger function, assert output contains case IDs and neutral prose)
- [ ] Episode carousel displays 10 most recent episodes (test: query episodes table, assert index.html renders 10 cards)
- [ ] Social links render when present (test: episode with youtube_shorts_url → assert icon visible)

---

## CONFIG & TESTING INFRASTRUCTURE

### Task CONFIG.1: Create config/economy.ts
**File:** `config/economy.ts` (create new)

From EBL_BATTLER_BUILD_PLAN section 11:
```typescript
export const ECONOMY = {
  STARTING_BALANCE: 100,
  CLAIM_BASE: 50,
  CLAIM_GROWTH: 1.6,
  SEAT_CAP: 6,
  MINE_PER_IMPACT_HOUR: 1,
  PORTFOLIO_EFFICIENCY_STEP: 0.05,
  SIPHON_RATE: 0.25,
  SIPHON_HOURS: 12,
  RAID_MARKS_FOR_TAKEOVER: 3,
  MARK_WINDOW_HOURS: 72,
  RAID_COST_PER_IMPACT: 3,
  RAID_COOLDOWN_HOURS: 6,
  DEFENDER_BOUNTY_PER_IMPACT: 5,
  JOIN_WINDOW_SECONDS: 60,
  TURN_SECONDS: 15,
  TURNS: 5,
  COUNTER_BONUS: 2,
  WEAKNESS_PENALTY: -1,
  MONO_FACTION_BONUS: 1,
  LIVE_DEFENSE_BONUS: 1,
  SENTIMENT_BONUS: 1,
  SCRATCH_WEEKLY_CAP: 10,
  SCRATCH_ODDS: { coins: 0.6, common: 0.3, rare: 0.09, legendary: 0.01 },
  SLOT_WEIGHT_EXPONENT: 2,
  // UCAR-specific
  DUPLICATE_SIMILARITY_THRESHOLD: 0.92,
  AUTOVERIFY_SLA_HOURS: 48,
  REVIEW_SLA_DAYS: 7,
  RATE_LIMIT_DEFAULT: 30,
  TOP_SCORE_HALF_LIFE_HOURS: 72,
};
```

Reference in all edge functions instead of hardcoded values.

### Task CONFIG.2: Create Feature Flags System
**File:** `config/flags.ts` (create new)

```typescript
// Environment-driven, checked server-side AND client-side
export const FLAGS = {
  FLAG_FEED: Deno.env.get('FLAG_FEED') === 'true',
  FLAG_AUTOVERIFY: Deno.env.get('FLAG_AUTOVERIFY') === 'true',
  FLAG_COMPLAINTS: Deno.env.get('FLAG_COMPLAINTS') === 'true',
  FLAG_MINT_V2: Deno.env.get('FLAG_MINT_V2') === 'true',
  FLAG_PORTFOLIO: Deno.env.get('FLAG_PORTFOLIO') === 'true',
  FLAG_BATTLES: Deno.env.get('FLAG_BATTLES') === 'true',
  FLAG_REALTIME: Deno.env.get('FLAG_REALTIME') === 'true',
  FLAG_QUESTS: Deno.env.get('FLAG_QUESTS') === 'true',
  FLAG_SCRATCH: Deno.env.get('FLAG_SCRATCH') === 'true',
  FLAG_REPLAYS: Deno.env.get('FLAG_REPLAYS') === 'true',
  FLAG_SHOW: Deno.env.get('FLAG_SHOW') === 'true',
};
```

Check in functions: `if (!FLAGS.FLAG_FEED) return { error: 'Feed disabled' };`

### Task CONFIG.3: Set Up Test Framework
**File:** `deno.json` (create new)

```json
{
  "tasks": {
    "test": "deno test --allow-net --allow-env --allow-read tests/",
    "test:phase0": "deno test tests/phase0/",
    "test:u1": "deno test tests/phase-u1/",
    "test:all": "deno test tests/**/*.test.ts"
  },
  "imports": {
    "@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@2",
    "@std/assert": "https://deno.land/std@0.224.0/assert/mod.ts"
  }
}
```

### Task CONFIG.4: Write Test Fixtures
**File:** `tests/fixtures/cases.json` (create new)

Sample test data:
- 10 use cases with known triples, votes, embeddings
- 5 complaints (various types)
- 3 cards (heaven, hell, legendary)
- 2 episodes

Used across all acceptance tests.

### Task CONFIG.5: Set Up CI/CD with GitHub Actions
**File:** `.github/workflows/test.yml` (create new)

```yaml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: denoland/setup-deno@v1
      - run: deno task test:all
```

### Task CONFIG.6: Create CONTENT_TODO.md
**File:** `CONTENT_TODO.md` (create new)

Template:
```markdown
# Content Placeholders for OWNER Review

All [COPY: *] placeholders in code → logged here for Jason to finalize.

## Character Dialogue
- [COPY: Evil Brain cold open line] → function: buildScene(), file: index.html line 450
- [COPY: GI tactical assessment] → function: generateStory(), file: supabase/functions/generate-content/

## UI Copy
- [COPY: under review banner] → file: index.html, line 800
- [COPY: verification badge tooltip] → file: index.html, line 1200

## Satire Disclaimers
- [COPY: final satire notice wording] → file: standards.html, section 7
```

---

## EBL PHASES 2-6 (FUTURE WORK - NOT IN SCOPE FOR UCAR PRODUCTION)

These phases are for the evilbrainlabs.com game and are NOT blockers for usecasearmsrace.com launch:

- **Phase 2:** Portfolio economy (products, mining, wallets) - 4-6 weeks
- **Phase 3:** Battle core (turn reducer, defense loadouts, bots) - 4-6 weeks  
- **Phase 4:** Realtime multiplayer (60s join window, spectators) - 2-3 weeks
- **Phase 5:** Quests and scratch-offs (faucet, rewards) - 2-3 weeks
- **Phase 6:** Replays and export (deterministic replay viewer) - 1-2 weeks

**Total EBL time:** 13-20 weeks (3-5 months)

See EBL_BATTLER_BUILD_PLAN.md for full specs. Coordinate with EBL codebase separately.

---

## QUICK FIX: SVG THEME COLORS (30 minutes)

**File:** `index.html` (lines 608-991)

From HANDOFF_COMPLETE.txt / THEME_HANDOFF.md:
- Replace ~58 hardcoded `#EDE6D6` with `'+getStrokeColor()+'`
- Functions: setPieces() (lines 608-736), propFor() (lines 738-819)
- Add `const sc = getStrokeColor();` to propFor() function start
- Lines to fix: 849, 897, 909-911, 941, 955-960, 991

Grep: `grep -n "#EDE6D6" index.html`

---

## DEPLOYMENT CHECKLIST (Before Production Launch)

### T-14 Days
- [ ] Phases 0, U1, U2, U3, EBL-1 complete with acceptance tests passing
- [ ] Backfill minted: every approved case has card art
- [ ] Standards page live with legal review (OWNER comfort level)
- [ ] Steward prompts frozen at v1; hostile-input fixtures passing
- [ ] config/economy.ts complete with all tunables

### T-7 Days
- [ ] Phase SHOW complete: episodes table, steward brief, Card of the Day
- [ ] 6 episodes of Case of the Day candidates shortlisted (buffer)
- [ ] 2 dress-rehearsal episodes produced (one with staged battle replay, if EBL accessible)
- [ ] OG/Twitter card unfurl verified on x.com validator
- [ ] Steward's own registry entry filed and machine_verified

### T-1 Day
- [ ] Episode 1 recorded, gated (pre-publish checklist passed), scheduled
- [ ] Admin paging tested (named-party complaint fires email)
- [ ] Rollback rehearsed: FLAG_COMPLAINTS=false leaves feed intact

### Launch Day
- [ ] Publish episode 1; confirm Card of the Day, feed pin, notifications
- [ ] Watch review queue and rate limits for first 6 hours
- [ ] Post-launch: log any [COPY] gaps to CONTENT_TODO.md

### Week 1 Metrics (Baseline)
- [ ] Episode completion rate
- [ ] Cases submitted per day
- [ ] Vote actions per visitor
- [ ] Share-outs to X
- [ ] Complaint volume and dismissal rate
- [ ] Card of the Day claim count (if EBL live)

---

## NEVER-DO LIST (From Build Plans)

Per EBL_BATTLER_BUILD_PLAN invariant violations:
1. ❌ NEVER write to registry tables from EBL functions
2. ❌ NEVER compute game outcomes client-side (always server-authoritative)
3. ❌ NEVER randomize card stats (must be deterministic from case_id)
4. ❌ NEVER hardcode faction assignments (always community-derived)
5. ❌ NEVER include logos/trademarks in card art (plain text only)
6. ❌ NEVER edit applied migrations (new change = new migration)
7. ❌ NEVER write satire/jokes yourself (use [COPY: description] placeholder)
8. ❌ NEVER bundle phases in one PR (one phase = one branch = one PR)
9. ❌ NEVER skip RLS (every table must have explicit policies)
10. ❌ NEVER allow coin-purchasable battle influence (spectator sentiment is free only)

Per UCAR_REGISTRY_BUILD_PLAN:
11. ❌ NEVER hide a case in response to complaint (freeze use, keep visible)
12. ❌ NEVER let model retract (retraction is human-only decision)
13. ❌ NEVER invent facts to fill gaps (missing evidence → needs_human)

---

## EXECUTION NOTES FOR AI AGENT

1. **Work order:** Phase 0 → U1 → U2 → U3 → EBL-1 → SHOW, strictly. Do not start a phase until prior acceptance checklist passes.
2. **Branch naming:** `phase-{n}-{slug}` (e.g., `phase-0-hardening`, `phase-u1-feed`)
3. **One PR per phase.** PR description must paste acceptance checklist with all boxes checked + link to test run.
4. **Migrations:** `supabase migration new {name}`, never edit applied migrations.
5. **Tests first:** Write test for acceptance criteria, then implement feature.
6. **Grep before Read:** Use `Grep` or `Glob` to find exact locations, then `Read` with offset/limit.
7. **All tunable values:** Extract to `config/economy.ts` with comment citing source doc section.
8. **All flavor text:** Use `[COPY: description]` placeholder, append to `CONTENT_TODO.md`.
9. **Deploy each phase to staging behind flag,** verify checklist, then enable in production only when OWNER approves.
10. **If this doc conflicts with existing code:** INVARIANTS win, then this doc, then repo. Note conflicts in PR.

---

## CURRENT SESSION ACTIONS (2026-07-08)

### Immediate Next Steps:
1. ✅ Create this TASKS.md
2. ⬜ Fix SVG theme colors (30 min quick win)
3. ⬜ Create `config/economy.ts`
4. ⬜ Create `db/POLICIES.md` (audit current RLS)
5. ⬜ Create `CONTENT_TODO.md`
6. ⬜ Set up `deno.json` and test framework
7. ⬜ Begin Phase 0, Task 0.1 (RLS audit)

---

**END OF TASKS.md**

*Last updated: 2026-07-08*  
*Total phases: 7 (0, U1-U3, EBL-1, SHOW)*  
*Estimated completion: Q1 2027 (all phases)*  
*Next milestone: Phase 0 complete by 2026-07-22*
