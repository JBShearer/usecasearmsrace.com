# DATABASE POLICIES & ROW LEVEL SECURITY (RLS) AUDIT

**Last Updated:** 2026-07-08  
**Migration Status:** 2 migrations applied, 0 RLS policies defined  
**Security Level:** ⚠️ **INSECURE - PRODUCTION BLOCKER**

---

## EXECUTIVE SUMMARY

**Status:** ❌ **NO ROW LEVEL SECURITY ENABLED**

All 11+ tables in the database have **NO RLS policies**. This means:
- Any authenticated user can read/write ALL tables directly
- Edge functions use `SERVICE_ROLE_KEY` with full database access
- No isolation between UCAR registry (read-only) and EBL game (write access)
- Anonymous users may have uncontrolled access depending on Supabase defaults

**Risk Level:** CRITICAL - Must resolve before production launch

---

## CURRENT SCHEMA INVENTORY

### Migration 001_did_reputation.sql (555 lines)
Tables created:
1. `user_profiles` - User identity, reputation, rank, credentials
2. `triple_extractions` - Semantic triple submissions with voting
3. `triple_votes` - Vote tracking on triples  
4. `reputation_events` - Audit log of reputation changes
5. `credential_grants` - Issuer-based credentials (researcher, journalist, etc.)
6. `user_cards` - Collected cards (mint time, faction, stats, powers)
7. `user_decks` - Card deck building
8. `triple_submissions` - Raw submissions (with embedding column - pgvector disabled)
9. `idea_clusters` - Semantic clustering of submissions

**RLS Status:** ❌ None - `grep -i "rls\|row level" 001_*.sql` returned NO MATCHES

### Migration 002_semantic_triples.sql (311 lines)
Tables modified:
- `use_cases` - Added semantic fields (subject, verb, object, summary, modifiers, story_arc, source_quality)

Tables created:
- `semantic_modifiers` - Hierarchical modifier vocabulary

**RLS Status:** ❌ None - `grep -i "rls\|row level" 002_*.sql` returned NO MATCHES

### Registry Tables (assumed to exist, not visible in migrations)
- `use_cases` - Core registry table (referenced via ALTER TABLE)

**RLS Status:** ❌ Unknown (table creation not in provided migrations)

---

## REQUIRED RLS POLICIES (Per UCAR_REGISTRY_BUILD_PLAN.md Invariant 1)

### TIER 1: Public Read, Service Write Only
**Tables:** `use_cases`, `semantic_modifiers`

**Policies Required:**
```sql
ALTER TABLE use_cases ENABLE ROW LEVEL SECURITY;

-- Public read for approved cases only
CREATE POLICY "Public read approved cases" ON use_cases
  FOR SELECT
  USING (status = 'machine_verified' OR status IS NULL);

-- Service role can insert/update (autoverify, admin)
CREATE POLICY "Service role can insert" ON use_cases
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update" ON use_cases
  FOR UPDATE
  TO service_role
  USING (true);

-- No deletes (append-only audit log)
-- (Implicit: no DELETE policy = no one can delete)
```

**Rationale:**
- Registry is "instrument of record" (UCAR_REGISTRY_BUILD_PLAN invariant 1)
- Cases under review (`status != 'machine_verified'`) hidden from public
- Only service role (edge functions) can write
- Deletes never allowed (preserves audit trail)

---

### TIER 2: Authenticated Read/Write, User Scoped
**Tables:** `user_profiles`, `triple_extractions`, `triple_votes`, `user_cards`, `user_decks`, `triple_submissions`

**Policies Required (example for `user_profiles`):**
```sql
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users read own profile" ON user_profiles
  FOR SELECT
  USING (auth.uid() = id OR wallet_id = current_setting('app.anon_id', true));

-- Users can update their own profile (limited fields)
CREATE POLICY "Users update own profile" ON user_profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND (OLD.reputation = NEW.reputation) -- Cannot self-grant reputation
    AND (OLD.rank = NEW.rank)             -- Cannot self-promote
  );

-- Service role can manage all profiles
CREATE POLICY "Service role full access" ON user_profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Public can read public data (leaderboards)
CREATE POLICY "Public read leaderboard data" ON user_profiles
  FOR SELECT
  USING (true); -- Allow reads, but sensitive fields masked by VIEW
```

**Rationale:**
- Users own their data (DID/wallet_id)
- Cannot self-grant reputation or rank (triggers handle this)
- Service role (edge functions) orchestrates state changes
- Public leaderboards require SELECT access (filter via view)

---

### TIER 3: Authenticated Write, Public Read
**Tables:** `reputation_events`, `credential_grants`, `idea_clusters`

**Policies Required (example for `reputation_events`):**
```sql
ALTER TABLE reputation_events ENABLE ROW LEVEL SECURITY;

-- Anyone can read events (public audit log)
CREATE POLICY "Public read events" ON reputation_events
  FOR SELECT
  USING (true);

-- Only service role can insert events
CREATE POLICY "Service role insert only" ON reputation_events
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- No updates or deletes (append-only)
```

**Rationale:**
- Append-only audit logs (EBL_BATTLER_BUILD_PLAN invariant 6)
- Public transparency (UCAR_REGISTRY_BUILD_PLAN invariant 5)
- Only service role writes (no client tampering)

---

### TIER 4: Registry Read-Only Access (EBL Functions)
**Special Role:** `registry_reader`

**Implementation:**
```sql
-- Create read-only role
CREATE ROLE registry_reader;
GRANT SELECT ON use_cases, semantic_modifiers TO registry_reader;
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM registry_reader;

-- EBL edge functions connect with registry_reader credentials
-- Test: attempt INSERT as registry_reader → expect permission denied
```

**Rationale:**
- UCAR_REGISTRY_BUILD_PLAN invariant 1: "EBL is read-only from UCAR"
- EBL functions NEVER write to registry tables (no exceptions)
- Prevents accidental corruption of "instrument of record"

---

## MISSING TABLES (Phase U1-U3, EBL Phases)

### Phase U1: Feed Tables (Not Yet Created)
- `votes` - User votes on cases (Good/Evil)
- `watches` - Case watch subscriptions
- `case_status_log` - Public status history

**RLS Policies Needed (when created):**
- `votes`: User can UPSERT own votes (one per case), anyone can SELECT
- `watches`: User can manage own watches, no public read
- `case_status_log`: Public read, service role write only

---

### Phase U3: Complaints Tables (Not Yet Created)
- `complaints` - Complaint filing
- `review_queue` - Admin review queue

**RLS Policies Needed (when created):**
- `complaints`: User can read own complaints, service/admin can read all
- `review_queue`: Admin role only

---

### Phase EBL-1: Card Tables (Not Yet Created)
- `cards` - Base card definitions
- `card_instances` - Owned card instances
- `backgrounds` - Art assets

**RLS Policies Needed (when created):**
- `cards`: Public read, service role write
- `card_instances`: User can read own instances, service role writes
- `backgrounds`: Public read, admin write

---

## ANONYMOUS ACCESS (Current x-anon-id System)

**Current Implementation:**
- `supabase/functions/submit-verdict/index.ts` uses `x-anon-id` header for device identity
- No Supabase Auth session required for demo mode

**RLS Implication:**
- Anonymous users bypass `auth.uid()` checks
- Need alternative: `current_setting('app.anon_id', true)` for session tracking
- Risk: Anonymous users can spam without rate limiting

**Recommendation:**
- Keep anonymous browsing for slot machine demo
- Require auth for mutations (vote, claim, battle)
- RLS policies check: `auth.uid() IS NOT NULL` for writes

---

## RATE LIMITING (Missing Infrastructure)

**Current State:** ❌ No rate limiting table or logic

**Required Schema (Phase 0, Task 0.3):**
```sql
CREATE TABLE rate_limits (
  user_id UUID NOT NULL,           -- OR anon_id for anonymous
  function_name TEXT NOT NULL,
  minute_bucket TIMESTAMPTZ NOT NULL,
  call_count INT NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, function_name, minute_bucket)
);

CREATE INDEX idx_rate_limits_recent ON rate_limits(minute_bucket)
  WHERE minute_bucket > NOW() - INTERVAL '5 minutes';
```

**RLS Policy:**
```sql
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Service role only (edge functions manage this)
CREATE POLICY "Service role only" ON rate_limits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

**Logic:**
```typescript
// In every mutating edge function
import { checkRateLimit } from '../shared/rateLimit.ts';

const userId = auth.user?.id || headers.get('x-anon-id');
if (!await checkRateLimit(userId, 'submit-verdict', 30)) {
  return new Response('Too many requests', { status: 429 });
}
```

---

## ADMIN BACKDOOR AUDIT

**Task:** Search for email-based privilege escalation

```bash
grep -rn "email.*brain\|@evilbrain\|includes.*brain" supabase/functions/
```

**Result:** TBD (need to run)

**Action if found:** Remove logic, use `user_profiles.role = 'admin'` column only

---

## PHASE 0 ACCEPTANCE CRITERIA

From TASKS.md Phase 0, Task 0.7:

- [ ] **No code path grants privileges based on email content**
  - Test: `grep -r "email.*brain" supabase/`, assert no matches
- [ ] **Unauthenticated user cannot mutate any table via any endpoint**
  - Test: Call `submit-verdict` without auth, expect 401 or 403
- [ ] **Test proving EBL functions cannot write registry tables passes**
  - Test: Connect as `registry_reader`, attempt INSERT, expect permission denied
- [ ] **RLS enabled on 100% of tables; db/POLICIES.md exists and complete**
  - Test: Query `pg_tables WHERE schemaname='public' AND rowsecurity=false`, expect 0 rows
- [ ] **Rate limit returns HTTP 429 on 31st call in a minute**
  - Test: Loop 31 POST requests, assert 429 on last one

**Current Status:** ❌ 0 of 5 criteria met

---

## MIGRATION PLAN (Phase 0 Tasks)

### Migration 003_rls_hardening.sql
**Actions:**
1. Enable RLS on all existing tables (11 tables)
2. Create `registry_reader` role with SELECT-only grants
3. Create policies for each table per tier classification above
4. Add documentation comments for each policy

**Estimated Lines:** ~200 lines

---

### Migration 004_rate_limiting.sql
**Actions:**
1. Create `rate_limits` table
2. Enable RLS (service role only)
3. Create index on `minute_bucket`

**Estimated Lines:** ~20 lines

---

### Migration 005_auth_upgrade.sql (if needed)
**Actions:**
1. Enable Supabase Auth magic links (via dashboard, not SQL)
2. Document auth flow in comments
3. No schema changes needed (Supabase Auth uses separate schema)

**Estimated Lines:** ~10 lines (comments only)

---

### Migration 006_rls_policies.sql
**Actions:**
1. Additional policies discovered during testing
2. Refinements based on edge function needs

**Estimated Lines:** TBD

---

## NEXT STEPS (Immediate)

1. ✅ Create this db/POLICIES.md document
2. ⬜ Run admin backdoor audit: `grep -rn "email.*brain" supabase/functions/`
3. ⬜ Write Migration 003: RLS policies for 11 existing tables
4. ⬜ Write Migration 004: Rate limiting table
5. ⬜ Write `supabase/shared/rateLimit.ts` logic
6. ⬜ Update all edge functions to check `auth.uid()` and rate limits
7. ⬜ Write Phase 0 acceptance tests
8. ⬜ Deploy to staging, run tests, verify all 5 criteria pass

**Blocker Resolved When:** All Phase 0 acceptance tests pass in staging

---

## REFERENCES

- **UCAR_REGISTRY_BUILD_PLAN.md Section 1:** Invariants (especially #1, #5)
- **EBL_BATTLER_BUILD_PLAN.md Section 1:** Invariants (especially #1, #6)
- **TASKS.md Phase 0:** Task 0.1 through 0.7

---

**CRITICAL:** Do not deploy to production until RLS is enabled and tested.  
**Estimated Effort:** Phase 0 = 2-3 weeks (80% RLS setup, 20% testing)
