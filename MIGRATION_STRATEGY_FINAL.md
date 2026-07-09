# 🚀 CORRECT MIGRATION STRATEGY (Final Answer)

**Discovery:** Your database already has the correct schema that matches your deployed edge functions!

## Existing Tables (Already in Database)
- ✅ `cases` - Main use case table
- ✅ `entities` - WHO/WHOM entities
- ✅ `actions` - ACTION verbs
- ✅ `reputation` - User reputation scores
- ✅ `triple_submissions` - User triple extractions
- ✅ `user_cards` - Minted cards

## What You Need to Add

Only 2 migrations are needed:

### 1. RLS Policies (Security - CRITICAL)

**File:** `supabase/migrations/003_rls_existing_schema.sql`

Apply via SQL Editor: https://supabase.com/dashboard/project/aslcrwmbdtvimjrexxzw/sql/new

**What this does:**
- Enables RLS on all 6 existing tables
- Creates `registry_reader` role for EBL isolation
- Adds 4-tier security policies:
  - Public can view live cases
  - Authenticated users can submit/vote
  - Service role has full access
  - Read-only role for game integration

**Expected:** ✅ Success - "All tables have RLS enabled"

---

### 2. Rate Limiting (Spam Protection - CRITICAL)

**File:** `supabase/migrations/004_rate_limiting.sql` (unchanged from before)

Apply via SQL Editor.

**What this does:**
- Creates `rate_limits` table
- Creates `increment_rate_limit()` RPC function
- RLS policy (service role only)
- Auto-cleanup index

**Expected:** ✅ Success

---

### 3. Set up pg_cron cleanup job

In SQL Editor, run:
```sql
SELECT cron.schedule(
  'cleanup-rate-limits',
  '*/5 * * * *',
  $$DELETE FROM rate_limits WHERE minute_bucket < NOW() - INTERVAL '5 minutes'$$
);
```

---

## Do NOT Apply These Migrations

❌ **000_base_schema.sql** - Creates conflicting `use_cases` table  
❌ **001_did_reputation.sql** - Old architecture, conflicts with existing schema  
❌ **002_semantic_triples.sql** - Old architecture, conflicts with existing schema  
❌ **003_rls_hardening.sql** - Old version, references wrong tables

## Why This Happened

Migrations 001 and 002 were created during an earlier iteration of the project. Your database was set up with a different schema (using `cases` instead of `use_cases`, etc.) and your edge functions were built against that schema.

The new migrations I created today (000-002) would have broken your existing setup!

---

## Verification

After applying 003 and 004:

```bash
# Check RLS enabled
curl -s -H "apikey: eyJh..." \
  "https://aslcrwmbdtvimjrexxzw.supabase.co/rest/v1/rate_limits?limit=0"

# Should return: [] (not "table not found")
```

In SQL Editor:
```sql
SELECT * FROM check_rls_enabled();

-- All should show rls_enabled = true
```

---

## After Migration

**Phase 0 Status:**
- ✅ Existing schema (cases, entities, actions, etc.)
- ✅ All 4 edge functions deployed
- ✅ Buffer API configured
- ⬜ RLS policies (run 003_rls_existing_schema.sql)
- ⬜ Rate limiting (run 004_rate_limiting.sql)
- ⬜ pg_cron cleanup job

**Once 003 and 004 are applied: PHASE 0 COMPLETE!** 🎉

---

## Next Steps

After Phase 0 complete, you're ready for Phase U1:
- Timeline UI in index.html
- Vote persistence (already works via submit-verdict!)
- Realtime updates
- OpenGraph unfurls

See `TASKS.md` for Phase U1 breakdown.
