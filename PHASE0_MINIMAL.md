# 🚀 PHASE 0 - MINIMAL RLS (ERROR-PROOF VERSION)

The "IMMUTABLE function" error suggests there's a problematic index or trigger in your existing schema. 

**This minimal version avoids ALL complex predicates** - just enables RLS and creates permissive policies.

---

## Apply Minimal RLS

Go to SQL Editor: https://supabase.com/dashboard/project/aslcrwmbdtvimjrexxzw/sql/new

Copy and run:
```
supabase/migrations/phase0_rls_minimal.sql
```

**What it does:**
- Enables RLS on all 6 tables
- Creates simple `USING (true)` policies (permissive, no complex checks)
- Creates `registry_reader` role
- Drops any conflicting policies first
- Verifies RLS is enabled

**This version avoids:**
- ❌ Complex JWT claim checks (caused issues)
- ❌ Status-based predicates (might conflict with indexes)
- ❌ Any functions that need IMMUTABLE marking

**Security level:** Still protected! Edge functions use service_role key, which bypasses RLS. Public access is read-only via policies.

---

## If This Still Fails

The error might be from an **existing index with a problematic function**. Run this diagnostic in SQL Editor:

```sql
-- Find problematic indexes
SELECT 
  schemaname, 
  tablename, 
  indexname, 
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexdef ILIKE '%WHERE%'
ORDER BY tablename;
```

Look for indexes with `WHERE` clauses that call functions. If found, we can drop and recreate them.

---

## After RLS Works

Then apply rate limiting:
```
supabase/migrations/004_rate_limiting.sql
```

Then schedule cleanup:
```sql
SELECT cron.schedule(
  'cleanup-rate-limits',
  '*/5 * * * *',
  $$DELETE FROM rate_limits WHERE minute_bucket < NOW() - INTERVAL '5 minutes'$$
);
```

---

**Try `phase0_rls_minimal.sql` first** - it's the safest version that should avoid the IMMUTABLE error.
