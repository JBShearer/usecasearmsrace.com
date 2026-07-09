# 🚀 CORRECT MIGRATION ORDER (FIXED)

**Issue:** Migrations 001 and 002 both try to ALTER TABLE `use_cases`, but neither creates it!

**Solution:** Apply new migration 000 first to CREATE the use_cases table.

---

## Complete Migration Order

Go to SQL Editor: https://supabase.com/dashboard/project/aslcrwmbdtvimjrexxzw/sql/new

### 0. Apply Migration 000 (Base Schema) - **NEW, REQUIRED FIRST**

Copy entire contents of:
```
supabase/migrations/000_base_schema.sql
```

Paste into SQL Editor and click **Run**.

**What this creates:**
- `use_cases` table (title, source, votes, status, faction)
- Indexes for performance
- Triggers for auto-updating timestamps and faction
- Hysteresis logic (prevents flip-flopping at 50/50 votes)

**Expected:** ✅ Success (creates 1 table, 2 triggers, 4 indexes)

---

### 1. Apply Migration 001 (User Profiles & Reputation)

Copy entire contents of:
```
supabase/migrations/001_did_reputation.sql
```

Paste into SQL Editor and click **Run**.

**What this does:**
- Creates `user_profiles` table
- **Alters `use_cases`** to add DID columns (now works because 000 created the table!)
- Creates reputation tracking tables

**Expected:** ✅ Success

---

### 2. Apply Migration 002 (Semantic Triples)

Copy entire contents of:
```
supabase/migrations/002_semantic_triples.sql
```

Paste into SQL Editor and click **Run**.

**What this does:**
- **Alters `use_cases`** to add semantic triple columns (subject, verb, object)
- Creates `semantic_modifiers` table
- Seeds initial modifier vocabulary

**Expected:** ✅ Success

---

### 3. Apply Migration 003 (RLS Policies) - **CRITICAL SECURITY**

Copy entire contents of:
```
supabase/migrations/003_rls_hardening.sql
```

Paste into SQL Editor and click **Run**.

**What this does:**
- Enables RLS on all tables (now they all exist!)
- Creates 4-tier security policy system
- Creates `registry_reader` role

**Expected:** ✅ Success

---

### 4. Apply Migration 004 (Rate Limiting) - **CRITICAL SECURITY**

Copy entire contents of:
```
supabase/migrations/004_rate_limiting.sql
```

Paste into SQL Editor and click **Run**.

**What this does:**
- Creates `rate_limits` table
- Creates `increment_rate_limit()` RPC
- RLS policy (service role only)

**Expected:** ✅ Success

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

---

## Verification

Test that use_cases exists:
```bash
curl -s -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzbGNyd21iZHR2aW1qcmV4eHp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNDA0NjgsImV4cCI6MjA5NjcxNjQ2OH0.XYG0LrgA_92h7dGjw0aamX53WIrwQaqPHNHQLe8p9ls" \
  "https://aslcrwmbdtvimjrexxzw.supabase.co/rest/v1/use_cases?limit=0"

# Should return: []
```

Check all tables in SQL Editor:
```sql
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
```

Should see: `use_cases`, `user_profiles`, `semantic_modifiers`, `rate_limits`, and more.

---

## What Happened?

The original migration files assumed `use_cases` already existed (probably from manual SQL commands during development). When applying to a fresh database, they failed because the base table was missing.

**Migration 000 fixes this** by creating the foundational `use_cases` table first.

---

## After All 5 Migrations Applied

**Phase 0 Status:**
- ✅ Migration 000: Base schema ✅
- ✅ Migration 001: User profiles ✅
- ✅ Migration 002: Semantic triples ✅
- ✅ Migration 003: RLS policies ✅
- ✅ Migration 004: Rate limiting ✅
- ✅ All 4 edge functions deployed ✅
- ✅ Buffer API configured ✅

**🎉 PHASE 0 COMPLETE! 🎉**

---

**Next:** See `TASKS.md` Phase U1 for timeline UI implementation.
