# 🚀 APPLY MIGRATIONS IN ORDER

**Issue:** Migration 003 failed because `use_cases` table doesn't exist yet.

**Solution:** Apply migrations 001 → 002 → 003 → 004 in order.

---

## Step-by-Step Instructions

Go to SQL Editor: https://supabase.com/dashboard/project/aslcrwmbdtvimjrexxzw/sql/new

### 1. Apply Migration 001 (User Profiles & Reputation)

Copy entire contents of:
```
supabase/migrations/001_did_reputation.sql
```

Paste into SQL Editor and click **Run**.

**What this creates:**
- `user_profiles` table (wallet_id, did, reputation, rank, stats)
- `update_user_rank()` trigger function
- Indexes on wallet_id and did

**Expected:** ✅ Success (creates 1 table, 1 function, 2 indexes)

---

### 2. Apply Migration 002 (Use Cases & Semantic Triples)

Copy entire contents of:
```
supabase/migrations/002_semantic_triples.sql
```

Paste into SQL Editor and click **Run**.

**What this creates:**
- `use_cases` table (title, summary, source, votes, status)
- `semantic_modifiers` table (WHO → ACTION → WHOM triples)
- `submissions` table (user triple extractions)
- Helper functions for consensus extraction

**Expected:** ✅ Success (creates 3 tables, several functions)

---

### 3. Apply Migration 003 (RLS Policies) - **CRITICAL SECURITY**

Copy entire contents of:
```
supabase/migrations/003_rls_hardening.sql
```

Paste into SQL Editor and click **Run**.

**What this creates:**
- Enables RLS on all 11 tables
- Creates 4-tier security policy system
- Creates `registry_reader` role for EBL isolation
- Adds `check_rls_enabled()` verification function

**Expected:** ✅ Success (enables RLS, creates policies and role)

---

### 4. Apply Migration 004 (Rate Limiting) - **CRITICAL SECURITY**

Copy entire contents of:
```
supabase/migrations/004_rate_limiting.sql
```

Paste into SQL Editor and click **Run**.

**What this creates:**
- `rate_limits` table
- `increment_rate_limit()` RPC function
- RLS policy (service role only)
- Auto-cleanup index

**Expected:** ✅ Success (creates 1 table, 1 function)

---

### 5. Set up pg_cron cleanup job

In SQL Editor, run:
```sql
SELECT cron.schedule(
  'cleanup-rate-limits',
  '*/5 * * * *',
  $$DELETE FROM rate_limits WHERE minute_bucket < NOW() - INTERVAL '5 minutes'$$
);
```

**Expected:** ✅ Returns a cron job ID

---

## Verification

After applying all 4 migrations, verify:

### Check Tables Exist
```bash
# Test use_cases table
curl -s -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzbGNyd21iZHR2aW1qcmV4eHp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNDA0NjgsImV4cCI6MjA5NjcxNjQ2OH0.XYG0LrgA_92h7dGjw0aamX53WIrwQaqPHNHQLe8p9ls" \
  "https://aslcrwmbdtvimjrexxzw.supabase.co/rest/v1/use_cases?limit=0"

# Should return: [] (not "table not found")

# Test rate_limits table
curl -s -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzbGNyd21iZHR2aW1qcmV4eHp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNDA0NjgsImV4cCI6MjA5NjcxNjQ2OH0.XYG0LrgA_92h7dGjw0aamX53WIrwQaqPHNHQLe8p9ls" \
  "https://aslcrwmbdtvimjrexxzw.supabase.co/rest/v1/rate_limits?limit=0"

# Should return: [] (not "table not found")
```

### Check RLS Enabled
Run in SQL Editor:
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
```

All tables should show `rowsecurity = true`.

### Check registry_reader Role
Run in SQL Editor:
```sql
SELECT rolname FROM pg_roles WHERE rolname = 'registry_reader';
```

Should return 1 row: `registry_reader`.

---

## Troubleshooting

### "relation already exists"
**Cause:** Table from a previous migration attempt exists.

**Solutions:**
- **Option A (Safe):** Skip that CREATE TABLE statement, continue with rest
- **Option B (Clean slate):** Drop the table first: `DROP TABLE IF EXISTS tablename CASCADE;`

### "function already exists"
**Solution:** Add `OR REPLACE` to function definition, or drop first:
```sql
DROP FUNCTION IF EXISTS function_name CASCADE;
```

### "permission denied"
**Cause:** Using anon key instead of service role.

**Solution:** SQL Editor uses service role by default ✅ (you're fine)

### Still getting "use_cases does not exist" on 003
**Cause:** Migration 002 didn't fully complete.

**Solution:** Run this in SQL Editor to check:
```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
```

You should see: `use_cases`, `semantic_modifiers`, `submissions`, `user_profiles`

---

## After All Migrations Applied

**Phase 0 Status:**
- ✅ Migration 001: User profiles ✅
- ✅ Migration 002: Use cases & semantic triples ✅
- ✅ Migration 003: RLS policies ✅
- ✅ Migration 004: Rate limiting ✅
- ✅ All 4 edge functions deployed ✅
- ✅ Buffer API configured ✅

**🎉 PHASE 0 COMPLETE! 🎉**

You're ready to start Phase U1 (Timeline UI with voting)!

---

## What About Old Tables?

You currently have `user_cards` and `entities` from an older schema. You can:

**Option A: Keep both schemas** (safest for now)
- Old tables: `user_cards`, `entities` (leave as-is)
- New tables: `use_cases`, `user_profiles`, etc. (from migrations)
- Edge functions use new schema
- Frontend can be updated gradually

**Option B: Drop old tables** (clean slate)
```sql
DROP TABLE IF EXISTS user_cards CASCADE;
DROP TABLE IF EXISTS entities CASCADE;
-- Only do this if you're sure old data isn't needed
```

**Recommended:** Keep both for now, drop old tables later after verifying new system works.

---

**Next Steps:** See `TASKS.md` Phase U1 for timeline UI implementation.
