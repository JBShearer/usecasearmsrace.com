# 🎉 PHASE 0 - FINAL STEP

## ✅ Completed So Far

- ✅ **Step 1:** RLS policies on all 6 tables
- ✅ **Step 2:** Rate limiting table + function
- ⬜ **Step 3:** Schedule cleanup job (LAST STEP!)

---

## 🚀 Final Command - Schedule Cleanup Job

Go to SQL Editor: https://supabase.com/dashboard/project/aslcrwmbdtvimjrexxzw/sql/new

Run this command:

```sql
SELECT cron.schedule(
  'cleanup-rate-limits',
  '*/5 * * * *',
  $$DELETE FROM rate_limits WHERE minute_bucket < NOW() - INTERVAL '5 minutes'$$
);
```

**What it does:**
- Runs every 5 minutes
- Deletes rate limit records older than 5 minutes
- Keeps database clean (prevents bloat)

**Expected result:** Returns a cron job ID (number)

---

## 🎉 After This Command

**PHASE 0 IS COMPLETE!** ✅

You'll have:
- ✅ All 4 edge functions deployed (mint-card, feed-query, steward-brief, submit-verdict)
- ✅ RLS security on all tables
- ✅ Rate limiting active (30 calls/min default)
- ✅ Auto-cleanup running
- ✅ registry_reader role for EBL
- ✅ Buffer API configured

**Ready for Phase U1:** Timeline UI with voting! 🚀

---

**Just run that one SQL command and you're done with Phase 0!**
