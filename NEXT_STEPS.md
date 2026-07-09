# 🚀 IMMEDIATE NEXT STEPS - USE CASE ARMS RACE

**Created:** 2026-07-08  
**Status:** Foundation complete, ready for Phase 0 implementation  
**Time to Complete Foundation:** ~3 hours  
**Next Phase:** Phase 0 Hardening (2-3 weeks)

---

## ✅ COMPLETED THIS SESSION

### 1. Comprehensive Evaluation & Gap Analysis
- ✅ Analyzed all 3 build plans (UCAR, EBL, Show Launch Runbook)
- ✅ Evaluated current codebase (2,328 lines HTML, 866 lines SQL, 5 edge functions)
- ✅ Identified **10-15% completion** vs production requirements
- ✅ Documented **30+ missing tables**, 6 broken/missing features
- ✅ Found **CRITICAL security gap**: No RLS policies on any table

### 2. Production Roadmap (TASKS.md)
- ✅ **100+ atomic tasks** across 7 phases
- ✅ Every task has: grep commands, file locations, acceptance criteria
- ✅ Clear dependencies: Phase 0 → U1 → U2 → U3 → EBL-1 → SHOW
- ✅ Timeline estimates: 6-9 months to production-ready
- ✅ Launch target: Q1 2027

### 3. Configuration Foundation
- ✅ **config/economy.ts**: 50+ tunable constants with helper functions
- ✅ **deno.json**: Test framework configuration
- ✅ **CONTENT_TODO.md**: 20+ placeholder tracking for OWNER review
- ✅ **BUILD_STATUS.md**: Executive summary and status tracking

### 4. Security Audit (db/POLICIES.md)
- ✅ Audited 11 existing tables: **0 RLS policies found**
- ✅ Documented required policies (4 tiers, ~200 lines SQL)
- ✅ Registry read-only role specification
- ✅ Rate limiting schema + logic requirements
- ✅ 5 acceptance tests defined

### 5. Git Pipeline
- ✅ 2 commits pushed to main branch
- ✅ All documentation in repository
- ✅ Branch strategy defined (phase-{n}-{slug})
- ✅ PR requirements documented

---

## 🎯 QUICK WINS (Do These First - 1-2 Hours Total)

### Quick Win #1: SVG Theme Fix (30 minutes) ⚡
**Problem:** 58 hardcoded `#EDE6D6` color values break dark mode theming

**Files to Fix:**
- `index.html` lines 608-736 (setPieces function)
- `index.html` lines 738-819 (propFor function)
- `index.html` lines 849, 897, 909-911, 941, 955-960, 991 (beat compositions)

**Pattern:**
```javascript
// Add at start of propFor():
const sc = getStrokeColor();

// Replace all:
stroke="#EDE6D6"  →  stroke="'+sc+'"
fill="#EDE6D6"    →  fill="'+sc+'"
```

**Search command:**
```bash
cd "/Users/I530341/Documents/Evil Brain Production/usecasearmsrace.com"
grep -n "#EDE6D6" index.html
```

**Test:** Toggle theme button, verify SVG illustrations update colors

---

### Quick Win #2: Admin Backdoor Audit (15 minutes) 🔍
**Problem:** Need to verify no email-based privilege escalation exists

**Search command:**
```bash
cd "/Users/I530341/Documents/Evil Brain Production/usecasearmsrace.com"
grep -rn "email.*brain\|@evilbrain\|includes.*brain" supabase/functions/
```

**If found:** Remove logic, document that admin must be set via `user_profiles.role = 'admin'`

---

### Quick Win #3: Test Directory Setup (30 minutes) 📁
**Create test structure:**
```bash
mkdir -p tests/{phase0,phase-u1,phase-u2,phase-u3,phase-ebl1,phase-show,fixtures}
touch tests/fixtures/cases.json
touch tests/fixtures/users.json
```

**Create sample test file:**
```typescript
// tests/phase0/rls.test.ts
import { assertEquals } from '@std/assert';
import { createClient } from '@supabase/supabase-js';

Deno.test('Unauthenticated user cannot mutate tables', async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')! // Not service role
  );
  
  // Attempt to insert without auth
  const { error } = await supabase
    .from('use_cases')
    .insert({ title: 'Test' });
  
  assertEquals(error?.code, 'PGRST301'); // Insufficient privileges
});
```

---

## 🔴 PHASE 0: HARDENING (START HERE - 2-3 Weeks)

**Goal:** Make database production-safe  
**Status:** Ready to begin  
**Blocker:** Nothing - can start immediately

### Week 1: RLS Policies

**Task 0.1: Create Migration 003_rls_hardening.sql** (4-6 hours)
```bash
cd "/Users/I530341/Documents/Evil Brain Production/usecasearmsrace.com"
cd supabase
supabase migration new rls_hardening
```

**Contents:** (see db/POLICIES.md for full spec)
- Enable RLS on 11 tables
- Create `registry_reader` role
- Define policies for each tier
- ~200 lines of SQL

**Reference:** `db/POLICIES.md` sections for each table

---

**Task 0.2: Create Migration 004_rate_limiting.sql** (1-2 hours)
```bash
supabase migration new rate_limiting
```

**Contents:**
```sql
CREATE TABLE rate_limits (
  user_id UUID NOT NULL,
  function_name TEXT NOT NULL,
  minute_bucket TIMESTAMPTZ NOT NULL,
  call_count INT NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, function_name, minute_bucket)
);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON rate_limits
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX idx_rate_limits_recent ON rate_limits(minute_bucket)
  WHERE minute_bucket > NOW() - INTERVAL '5 minutes';
```

---

**Task 0.3: Create supabase/shared/rateLimit.ts** (2-3 hours)
```typescript
import { createClient } from '@supabase/supabase-js';

export async function checkRateLimit(
  userId: string,
  functionName: string,
  limit: number = 30
): Promise<boolean> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  
  const bucket = new Date();
  bucket.setSeconds(0, 0); // Round to minute
  
  // UPSERT with increment
  const { data, error } = await supabase.rpc('increment_rate_limit', {
    p_user_id: userId,
    p_function_name: functionName,
    p_bucket: bucket.toISOString()
  });
  
  return !error && (data?.call_count || 0) <= limit;
}
```

**Also create RPC function in migration:**
```sql
CREATE OR REPLACE FUNCTION increment_rate_limit(
  p_user_id UUID,
  p_function_name TEXT,
  p_bucket TIMESTAMPTZ
) RETURNS TABLE(call_count INT) AS $$
  INSERT INTO rate_limits (user_id, function_name, minute_bucket, call_count)
  VALUES (p_user_id, p_function_name, p_bucket, 1)
  ON CONFLICT (user_id, function_name, minute_bucket)
  DO UPDATE SET call_count = rate_limits.call_count + 1
  RETURNING rate_limits.call_count;
$$ LANGUAGE sql SECURITY DEFINER;
```

---

### Week 2: Auth & Testing

**Task 0.4: Update Edge Functions with Auth Checks** (4-6 hours)
```typescript
// Pattern for all mutating functions:
import { checkRateLimit } from '../shared/rateLimit.ts';

const auth = req.headers.get('Authorization');
if (!auth) {
  return new Response('Unauthorized', { status: 401 });
}

const userId = /* extract from JWT */ || req.headers.get('x-anon-id');
if (!await checkRateLimit(userId, 'submit-verdict')) {
  return new Response('Too many requests', { status: 429 });
}
```

**Files to update:**
- `supabase/functions/submit-verdict/index.ts`
- `supabase/functions/update-case/index.ts`
- (Future: vote-on-case, file-complaint, mint-card)

---

**Task 0.5: Enable Supabase Auth** (1 hour)
```bash
# Via Supabase Dashboard:
# Authentication > Providers > Email
# Enable: Email auth with Magic Links
# Disable: Email + Password (use magic links only)
```

**Update index.html with auth UI:**
```javascript
// Add login modal
async function showAuthModal() {
  const email = prompt('Enter email for magic link:');
  const { error } = await supabase.auth.signInWithOtp({ email });
  if (error) alert('Error: ' + error.message);
  else alert('Check your email for login link!');
}
```

---

**Task 0.6: Write Phase 0 Tests** (6-8 hours)
Create tests for all 5 acceptance criteria:
1. No email-based privileges (grep test)
2. Unauthenticated mutations blocked (API test)
3. Registry read-only enforcement (DB test)
4. RLS enabled on all tables (SQL query test)
5. Rate limiting works (load test)

**File:** `tests/phase0/hardening.test.ts`

**Run:**
```bash
deno task test:phase0
```

---

**Task 0.7: Deploy to Staging & Verify** (2-3 hours)
```bash
# Push migrations
supabase db push --db-url "YOUR_STAGING_URL"

# Deploy edge functions
supabase functions deploy --project-ref YOUR_STAGING_REF

# Run tests against staging
SUPABASE_URL=staging SUPABASE_ANON_KEY=xxx deno task test:phase0

# Verify all 5 checkboxes pass
```

**When all pass:** Create PR with checklist, merge to main

---

## 📋 PHASE 0 ACCEPTANCE CHECKLIST

Copy this into PR description:

```markdown
## Phase 0: Hardening - Acceptance Criteria

- [ ] No code path grants privileges based on email content
  - Verified via: `grep -r "email.*brain" supabase/`
  - Result: No matches found

- [ ] Unauthenticated user cannot mutate any table
  - Test: `tests/phase0/rls.test.ts::test_unauth_mutations`
  - Result: All mutations return 401 or 403

- [ ] EBL functions cannot write registry tables
  - Test: `tests/phase0/rls.test.ts::test_registry_readonly`
  - Result: INSERT as registry_reader returns permission denied

- [ ] RLS enabled on 100% of tables
  - Test: SQL query `SELECT * FROM pg_tables WHERE schemaname='public' AND rowsecurity=false`
  - Result: 0 rows (all tables have RLS)

- [ ] Rate limit enforces 30 calls/min
  - Test: `tests/phase0/rls.test.ts::test_rate_limiting`
  - Result: 31st call returns HTTP 429

**All tests passing:** ✅ / ❌
**db/POLICIES.md updated:** ✅ / ❌
**Staging verified:** ✅ / ❌
```

---

## 🔄 AFTER PHASE 0: NEXT PHASES

### Phase U1: Feed (2-3 weeks)
**First tasks:**
1. Create `votes`, `watches`, `case_status_log` tables
2. Build timeline UI (replace search-first layout)
3. Implement vote-on-case function
4. Add Realtime subscriptions

**See:** `TASKS.md` Phase U1, Task U1.1 onwards

---

### Phase U2: AutoVerify (3-4 weeks)
**First tasks:**
1. Fix embedding dependencies in search-cases
2. Create `verifications`, `model_actions` tables
3. Implement deterministic checks (schema, source fetch, dedupe)

**See:** `TASKS.md` Phase U2, Task U2.1 onwards

---

## 📚 REFERENCE DOCUMENTS

**In Repository:**
- `TASKS.md` - Complete implementation guide (100+ tasks)
- `BUILD_STATUS.md` - Executive summary & timeline
- `db/POLICIES.md` - RLS policy specifications
- `config/economy.ts` - All tunable constants
- `CONTENT_TODO.md` - Placeholder tracking
- `deno.json` - Test framework config

**External (in /Downloads/UCAR/):**
- `UCAR_REGISTRY_BUILD_PLAN.md` - Registry phases U1-U3
- `EBL_BATTLER_BUILD_PLAN.md` - Game phases 0-6
- `SHOW_LAUNCH_RUNBOOK.md` - Daily show automation
- `MODEL_STEWARD_SPEC.md` - (not yet found - need to locate)

---

## 🎬 DAILY SHOW REQUIREMENTS (Phase SHOW)

**What's Needed for Show Launch:**
1. Episodes table (number, air_date, featured_case_id, video_url)
2. Steward brief (automated at 05:30 UTC)
3. Card of the Day flag (24h free-to-play)
4. Feed pin system
5. Episode carousel on homepage
6. YouTube Shorts / TikTok / LinkedIn links
7. Standards page (legal disclosure)
8. Battle export (for Battle Report segment)

**Dependencies:** Phase U1, U2, EBL-1 must complete first  
**Timeline:** 1-2 weeks after dependencies  
**See:** `TASKS.md` Phase SHOW

---

## 🎮 GAMIFICATION REQUIREMENTS (EBL Phases 2-6)

**Portfolio Economy (Phase 2):**
- Claim cases (6-seat portfolio, exponential cost)
- Passive mining (impact * 1 BC/hour)
- Wallet system

**Battle System (Phase 3-4):**
- Turn-based combat (5 turns, 3 lanes)
- Defense loadouts
- Raids & takeovers
- Realtime multiplayer (60s join window)

**Rewards (Phase 5):**
- Quests (daily, story chapters)
- Scratch-off tickets
- Card instance drops

**Note:** EBL phases NOT required for UCAR show launch (separate 13-20 weeks)

---

## 🔍 SEMANTIC SEARCH REQUIREMENTS (Phase U2)

**Current Issue:** Embedding dependencies broken (search-cases line 2)

**Fix Steps:**
1. Install embedding provider (Anthropic or OpenAI)
2. Implement `embed(text: string): Promise<number[]>`
3. Re-enable semantic similarity search (pgvector)
4. Test duplicate detection (0.92 threshold)

**See:** `TASKS.md` Phase U2, Task U2.1

---

## ⚡ COMMAND CHEATSHEET

```bash
# Navigate to project
cd "/Users/I530341/Documents/Evil Brain Production/usecasearmsrace.com"

# Run tests
deno task test:all                 # All tests
deno task test:phase0              # Phase 0 only

# Supabase migrations
supabase migration new {name}      # Create new migration
supabase db push                   # Push to staging
supabase db reset                  # Reset local DB

# Git workflow
git checkout -b phase-0-hardening  # Create phase branch
git add -A && git commit -m "..."  # Commit
git push origin phase-0-hardening  # Push
# (Create PR on GitHub)

# Search helpers
grep -n "#EDE6D6" index.html       # Find hardcoded colors
grep -rn "email.*brain" supabase/  # Find admin backdoors
grep -i "rls\|row level" supabase/migrations/*.sql  # Check RLS
```

---

## 🎯 SUCCESS METRICS (Post-Launch)

**Week 1 baseline targets:**
- Episode completion rate (% who finish video)
- Cases submitted per day (organic submissions)
- Vote actions per visitor (Good/Evil engagement)
- Share-outs to X (Twitter card unfurls)
- Complaint volume (filing rate)
- Complaint dismissal rate (steward accuracy)
- Card of the Day claim count (EBL engagement)

**See:** `BUILD_STATUS.md` section on metrics

---

## 🚨 KNOWN ISSUES & BLOCKERS

**CRITICAL (Phase 0):**
- ❌ No RLS policies (11 tables exposed)
- ❌ No rate limiting (spam/DOS vectors)
- ❌ Anonymous-only auth (no email magic links)

**HIGH (Phase U1-U2):**
- ❌ Embedding search disabled
- ❌ No feed/timeline UI
- ❌ No persistent voting
- ❌ No content moderation pipeline

**MEDIUM (Phase U3, EBL-1):**
- ❌ No complaint system
- ❌ Card formulas exist but no persistence
- ❌ No show automation

**LOW (Post-launch):**
- ⚠️ SVG theme incomplete (58 hardcoded colors - quick win)
- ⚠️ No tests (framework now ready)
- ⚠️ Missing 30+ tables (future phases)

---

## 🤝 TEAM ROLES

**OWNER (Jason Shearer):**
- All design decisions
- Satire copy, character voices
- Episode picks, Case of the Day selections
- Launch approval
- Tunable value adjustments (config/economy.ts)

**AI Agent (Claude):**
- Implementation per build plans
- No design authority
- Use `[COPY: description]` for all placeholders
- Update CONTENT_TODO.md with pending decisions

**Legal Counsel:**
- Review satire notice (standards.html section 7)
- Before launch only

**K'Dee Production:**
- Video production workflow (OWNER specified)

---

## 📞 WHEN YOU'RE BACK

**Recommended next actions:**

1. **Quick wins (1-2 hours):**
   - Fix SVG theme colors
   - Run admin backdoor audit
   - Set up test directories

2. **Phase 0 Week 1 (start immediately):**
   - Write Migration 003 (RLS policies)
   - Write Migration 004 (rate limiting)
   - Create rateLimit.ts shared module

3. **Phase 0 Week 2:**
   - Update edge functions with auth checks
   - Write acceptance tests
   - Deploy to staging & verify

4. **After Phase 0:**
   - Phase U1: Feed system
   - Phase U2: AutoVerify pipeline
   - Continue per TASKS.md

**Questions for OWNER:**
- Confirm tunable values in config/economy.ts
- Provide background art assets for card minting
- Legal review of satire notice
- Clarify K'Dee video production workflow

---

**Everything is documented, committed to git, and ready for implementation. The critical path is clear, and all tasks are atomic with acceptance criteria. You can pick up exactly where this left off. 🚀**

**Repository:** https://github.com/JBShearer/usecasearmsrace.com  
**Last commit:** `1c22371` (Database security audit)  
**Branch:** `main` (ready for `phase-0-hardening` branch)
