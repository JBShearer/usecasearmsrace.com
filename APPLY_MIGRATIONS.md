# 🚀 APPLY MIGRATIONS VIA SQL EDITOR

Since `supabase db push` is having conflicts, the easiest approach is to apply migrations 003 and 004 directly via the Supabase SQL Editor.

---

## Step-by-Step Instructions

### 1. Open SQL Editor
Go to: https://supabase.com/dashboard/project/aslcrwmbdtvimjrexxzw/sql/new

### 2. Apply Migration 003 (RLS Policies) - **CRITICAL**

Copy the entire contents of:
```
supabase/migrations/003_rls_hardening.sql
```

Paste into SQL Editor and click **Run**.

**What this does:**
- Enables RLS on all 11 tables
- Creates 4-tier security policy system
- Creates `registry_reader` role for EBL isolation
- Adds `check_rls_enabled()` verification function

**Expected result:** ✅ Success (creates policies and role)

---

### 3. Apply Migration 004 (Rate Limiting) - **CRITICAL**

Copy the entire contents of:
```
supabase/migrations/004_rate_limiting.sql
```

Paste into SQL Editor and click **Run**.

**What this does:**
- Creates `rate_limits` table
- Creates `increment_rate_limit()` RPC function
- Enables RLS on rate_limits table
- Sets up auto-cleanup index

**Expected result:** ✅ Success (creates table and function)

---

### 4. Set up pg_cron cleanup job

In SQL Editor, run:
```sql
SELECT cron.schedule(
  'cleanup-rate-limits',
  '*/5 * * * *',
  $$DELETE FROM rate_limits WHERE minute_bucket < NOW() - INTERVAL '5 minutes'$$
);
```

**What this does:** Cleans up old rate limit entries every 5 minutes

---

### 5. Verify Deployment

Test that tables exist:
```bash
# Check rate_limits table
curl -s -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzbGNyd21iZHR2aW1qcmV4eHp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNDA0NjgsImV4cCI6MjA5NjcxNjQ2OH0.XYG0LrgA_92h7dGjw0aamX53WIrwQaqPHNHQLe8p9ls" \
  "https://aslcrwmbdtvimjrexxzw.supabase.co/rest/v1/rate_limits?limit=0"

# Should return: [] (empty array, not "table not found" error)
```

Check RLS is enabled:
```sql
-- Run in SQL Editor
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- All tables should show rowsecurity = true
```

---

## Why Not db push?

The `supabase db push` command detected existing remote migrations that don't match your local migration files. This happens when:
1. Migrations were applied manually in the past
2. Migration files were renamed/reorganized
3. Database was created before migration files existed

**Using SQL Editor bypasses this** - you're just running SQL directly, which always works.

---

## What About Migrations 001 and 002?

Based on the tables that exist (`user_cards`, `entities`), it looks like earlier versions of the schema are already applied. 

**You have two options:**

**Option A: Keep existing schema** (if it works)
- Only apply 003 + 004 (security critical)
- Keep `user_cards` table as-is
- May need to adjust edge functions if they expect `use_cases`

**Option B: Fresh schema** (clean slate)
- Drop all existing tables (⚠️ destructive!)
- Apply 001 → 002 → 003 → 004 in order
- Edge functions will work as designed

**Recommended:** Option A for now (just add security), then plan migration to new schema later if needed.

---

## After Applying 003 + 004

**Phase 0 Status:**
- ✅ Migration 003: RLS policies applied
- ✅ Migration 004: Rate limiting applied
- ✅ All 4 edge functions deployed
- ✅ Buffer API configured
- ⬜ Run acceptance tests
- ⬜ Update frontend to use new endpoints

**You'll be ready for Phase U1!** 🚀

---

## Troubleshooting

**Error: "relation already exists"**
- Some tables from 003/004 might already exist
- Check what's there: `\dt` in SQL editor
- Skip conflicting CREATE TABLE statements

**Error: "permission denied"**
- Make sure you're using service role, not anon key
- SQL Editor uses service role by default ✅

**Error: "syntax error"**
- Check you copied the entire file
- Make sure no stray characters at start/end

---

**Next file:** `DEPLOYMENT_PROGRESS.md` - Update status after applying
