# ✅ PHASE 0 DEPLOYMENT STATUS

## Step 1: RLS Policies ✅ COMPLETE

**Applied:** `phase0_rls_minimal.sql`

**Verified:** Cases table accessible with RLS enabled

---

## Step 2: Apply Rate Limiting ⬜ NEXT

Go to SQL Editor: https://supabase.com/dashboard/project/aslcrwmbdtvimjrexxzw/sql/new

Copy and run:
```
supabase/migrations/004_rate_limiting.sql
```

**What it creates:**
- `rate_limits` table (user_id, function_name, minute_bucket, call_count)
- `increment_rate_limit()` RPC function (atomic UPSERT)
- RLS policy (service role only)
- Index for auto-cleanup

---

## Step 3: Schedule Cleanup Job ⬜ AFTER STEP 2

After step 2 succeeds, run this in SQL Editor:

```sql
SELECT cron.schedule(
  'cleanup-rate-limits',
  '*/5 * * * *',
  $$DELETE FROM rate_limits WHERE minute_bucket < NOW() - INTERVAL '5 minutes'$$
);
```

---

## ✅ After All 3 Steps Complete

**Phase 0 Status:**
- ✅ RLS enabled on all tables
- ✅ Rate limiting active
- ✅ registry_reader role created
- ✅ All 4 edge functions deployed
- ✅ Buffer API configured

**🎉 PHASE 0 COMPLETE! 🎉**

Ready to start Phase U1 (Timeline UI with voting).

---

**Current:** Step 1 done ✅, now do Step 2
