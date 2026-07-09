# 🎯 SIMPLE MIGRATION GUIDE - Phase 0 Security Only

**Your database already has the correct schema!** ✅

Tables exist: `cases`, `entities`, `actions`, `reputation`, `triple_submissions`, `user_cards`

**You only need to add security (RLS + rate limiting).**

---

## Step 1: Apply RLS Policies

Go to SQL Editor: https://supabase.com/dashboard/project/aslcrwmbdtvimjrexxzw/sql/new

Copy and run:
```
supabase/migrations/phase0_rls_simple.sql
```

**What it does:**
- Enables RLS on all 6 tables
- Creates `registry_reader` role for EBL
- Adds security policies (public read, service write)

**Expected:** ✅ Success

---

## Step 2: Apply Rate Limiting

Copy and run:
```
supabase/migrations/004_rate_limiting.sql
```

**What it does:**
- Creates `rate_limits` table
- Creates `increment_rate_limit()` function
- Enables RLS on rate_limits

**Expected:** ✅ Success

---

## Step 3: Schedule Cleanup Job

Run in SQL Editor:
```sql
SELECT cron.schedule(
  'cleanup-rate-limits',
  '*/5 * * * *',
  $$DELETE FROM rate_limits WHERE minute_bucket < NOW() - INTERVAL '5 minutes'$$
);
```

---

## Verification

Test that RLS is enabled:
```bash
curl -s -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzbGNyd21iZHR2aW1qcmV4eHp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNDA0NjgsImV4cCI6MjA5NjcxNjQ2OH0.XYG0LrgA_92h7dGjw0aamX53WIrwQaqPHNHQLe8p9ls" \
  "https://aslcrwmbdtvimjrexxzw.supabase.co/rest/v1/rate_limits?limit=0"

# Should return: [] (empty array)
```

---

## ✅ THAT'S IT!

**After these 3 steps:**
- ✅ All edge functions deployed
- ✅ RLS security enabled
- ✅ Rate limiting active
- ✅ Buffer API configured

**🎉 PHASE 0 COMPLETE! 🎉**

---

## What NOT to Run

❌ **DO NOT RUN:**
- `000_base_schema.sql` - Conflicts with existing schema
- `001_did_reputation.sql` - Old architecture
- `002_semantic_triples.sql` - Old architecture
- `003_rls_hardening.sql` - References tables that don't exist

✅ **ONLY RUN:**
- `phase0_rls_simple.sql` - Security for existing tables
- `004_rate_limiting.sql` - Rate limiting

---

**Next Steps:** See `TASKS.md` Phase U1 for timeline UI
