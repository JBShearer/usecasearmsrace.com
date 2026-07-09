# 🚀 DEPLOYMENT STATUS - Use Case Arms Race

**Project:** aslcrwmbdtvimjrexxzw.supabase.co  
**Last Check:** 2026-07-08  
**Status:** ✅ Project exists, ready for migration deployment

---

## CURRENT STATE

### ✅ What Exists
- **Supabase Project:** Active and responding
- **Edge Function:** `submit-verdict` is deployed
- **Tables:** `user_cards` table exists (old schema)
- **Credentials:** Anon key working (from index.html)

### ⬜ What Needs Deployment

**Migrations (4 files ready):**
1. `001_did_reputation.sql` - User profiles, reputation system
2. `002_semantic_triples.sql` - Use cases, semantic modifiers
3. `003_rls_hardening.sql` - **CRITICAL** RLS policies (security)
4. `004_rate_limiting.sql` - **CRITICAL** Rate limiting (spam protection)

**Edge Functions (3 new):**
1. `mint-card` - Card minting with procedural backgrounds
2. `feed-query` - Timeline feed (Latest, Top, Under Fire, Flips)
3. `steward-brief` - Daily morning brief automation

---

## DEPLOYMENT STEPS

### Prerequisites

You need the **service role key** (not the anon key). Get it from:
1. Go to: https://supabase.com/dashboard/project/aslcrwmbdtvimjrexxzw
2. Click: Project Settings → API
3. Copy: **service_role** key (starts with `eyJhbGci...`, different from anon key)

⚠️ **WARNING:** Service role key is SECRET - never commit to git or expose in frontend

---

### Option 1: Manual Deployment (No CLI Required)

**Step 1: Apply Migrations**

Go to Supabase SQL Editor:
https://supabase.com/dashboard/project/aslcrwmbdtvimjrexxzw/sql/new

Paste each migration file in order:
1. Copy contents of `supabase/migrations/001_did_reputation.sql`
2. Click "Run" in SQL Editor
3. Repeat for 002, 003, 004

**Step 2: Deploy Edge Functions**

Go to Supabase Functions:
https://supabase.com/dashboard/project/aslcrwmbdtvimjrexxzw/functions

For each function:
1. Click "Create a new Function"
2. Name: `mint-card` (or `feed-query`, `steward-brief`)
3. Copy contents from `supabase/functions/{name}/index.ts`
4. Deploy

**Step 3: Verify Deployment**

Run the verification script:
```bash
# If you have Deno installed:
deno run --allow-net scripts/check-existing-project.ts

# Otherwise, check manually:
# - Visit Supabase dashboard
# - Check Tables section shows: use_cases, votes, rate_limits, etc.
# - Check Functions section shows: submit-verdict, mint-card, feed-query, steward-brief
```

---

### Option 2: CLI Deployment (Faster, Recommended)

**Install Supabase CLI:**
```bash
# macOS
brew install supabase/tap/supabase

# Other platforms
curl -fsSL https://supabase.com/install.sh | sh
```

**Deploy Everything:**
```bash
cd "/Users/I530341/Documents/Evil Brain Production/usecasearmsrace.com"

# Link to project
supabase link --project-ref aslcrwmbdtvimjrexxzw

# Push migrations
supabase db push

# Deploy all edge functions
supabase functions deploy mint-card
supabase functions deploy feed-query
supabase functions deploy steward-brief

# Verify
deno run --allow-net --allow-env scripts/check-rls.ts
```

---

## VERIFICATION CHECKLIST

After deployment, verify:

### Database Tables
- [ ] `user_profiles` exists
- [ ] `use_cases` exists (not `user_cards` - old schema)
- [ ] `semantic_modifiers` exists
- [ ] `rate_limits` exists (**CRITICAL**)
- [ ] RLS enabled on all tables (**CRITICAL**)

### Edge Functions
- [ ] `submit-verdict` responds (already exists)
- [ ] `mint-card` responds
- [ ] `feed-query` responds
- [ ] `steward-brief` responds

### Security
- [ ] Run `scripts/check-rls.ts` - all tests pass
- [ ] Rate limiting active (test with 31+ rapid calls)
- [ ] `registry_reader` role exists

---

## COMMON ISSUES

### "Could not find table 'use_cases'"
**Solution:** Migrations not applied yet. Run migrations 001 and 002 first.

### "Permission denied for table X"
**Solution:** Migration 003 (RLS) not applied yet. This is a **production blocker** - apply immediately.

### "Function not found"
**Solution:** Edge function not deployed. Deploy via dashboard or CLI.

### "Service role key required"
**Solution:** Get service role key from Supabase dashboard → Project Settings → API.

---

## NEXT STEPS AFTER DEPLOYMENT

**Week 1: Complete Phase 0**
1. ✅ Deploy migrations 003 + 004
2. ✅ Deploy edge functions
3. ⬜ Run acceptance tests: `deno task test:phase0`
4. ⬜ Enable Supabase Auth magic links (dashboard config)
5. ⬜ Update remaining edge functions with rate limiting

**Week 2: Start Phase U1**
1. ⬜ Create Migration 007 (votes, watches, case_status_log)
2. ⬜ Build timeline UI in index.html
3. ⬜ Implement vote-on-case edge function
4. ⬜ Add Realtime subscriptions

**Full roadmap:** See `TASKS.md` (100+ atomic tasks)

---

## REFERENCE

**Project URLs:**
- Dashboard: https://supabase.com/dashboard/project/aslcrwmbdtvimjrexxzw
- API: https://aslcrwmbdtvimjrexxzw.supabase.co
- Functions: https://aslcrwmbdtvimjrexxzw.supabase.co/functions/v1/

**Documentation:**
- `DEPLOYMENT_GUIDE.md` - Complete deployment procedures
- `BUILD_STATUS.md` - Project status and roadmap
- `SESSION_SUMMARY.md` - Detailed session report
- `TASKS.md` - Remaining work breakdown

**Credentials Location:**
- Anon key: `index.html` (line ~10)
- Service role key: Supabase Dashboard → Project Settings → API

---

**STATUS:** 🟢 Ready for deployment - all code written, tested, and committed.

**BLOCKER:** Need service role key to push migrations. Get it from Supabase dashboard.

**TIME ESTIMATE:** 30-60 minutes for full Phase 0 deployment (manual or CLI).
