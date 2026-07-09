# 🚀 DEPLOYMENT PROGRESS - 2026-07-08

## Edge Functions Status

### ✅ Deployed Successfully
- **mint-card** - Card minting with procedural backgrounds
- **steward-brief** - Daily morning brief automation
- **submit-verdict** - (already existed, has rate limiting)

### ⬜ Ready to Deploy
- **feed-query** - Timeline feed (import fixed, ready to redeploy)

**Command:**
```bash
supabase functions deploy feed-query
```

---

## Migrations Status

### ⬜ Need to Apply
1. **001_did_reputation.sql** - User profiles and reputation
2. **002_semantic_triples.sql** - Use cases and semantic modifiers
3. **003_rls_hardening.sql** - **CRITICAL** RLS policies
4. **004_rate_limiting.sql** - **CRITICAL** Rate limiting

**Option 1: Supabase CLI**
```bash
supabase db push
```

**Option 2: SQL Editor**
1. Go to: https://supabase.com/dashboard/project/aslcrwmbdtvimjrexxzw/sql/new
2. Copy/paste each migration file in order (001 → 002 → 003 → 004)
3. Click "Run" for each

---

## Credentials Status

### ✅ Have
- Supabase URL: `aslcrwmbdtvimjrexxzw.supabase.co`
- Supabase Anon Key: (in index.html and .env.local)
- Buffer API Token: `e3KFD...` (in .env.local)

### ⚠️ Need
- **Supabase Service Role Key** - Required to push migrations
  - Get from: https://supabase.com/dashboard/project/aslcrwmbdtvimjrexxzw/settings/api
  - Look for: "service_role" secret key (different from anon key)
  - Add to: `.env.local` file

---

## Buffer Profile Setup

### Next Steps for Phase SHOW
1. Go to: https://buffer.com/app
2. Connect profiles: YouTube, TikTok, LinkedIn
3. Get profile IDs:
   ```bash
   curl "https://api.bufferapp.com/1/profiles.json?access_token=e3KFDhRjeyXA8xf3yEHQCiNWxYgtin8oC4_D55aURTK"
   ```
4. Add profile IDs to `.env.local`

---

## What to Do Next

### Immediate (5 minutes)
1. ✅ Fix feed-query import - **DONE**
2. ⬜ Redeploy feed-query: `supabase functions deploy feed-query`
3. ⬜ Get service role key from Supabase dashboard
4. ⬜ Add service role key to `.env.local`

### This Session (30 minutes)
5. ⬜ Push migrations: `supabase db push`
6. ⬜ Verify tables exist (use SQL editor or scripts/check-existing-project.ts)
7. ⬜ Test edge functions work with new schema

### Next Session
8. ⬜ Create Migration 007 (votes, watches, case_status_log)
9. ⬜ Build timeline UI in index.html
10. ⬜ Connect Buffer profiles and test publish-episode

---

## Known Issues

### Fixed This Session ✅
- ❌ `@supabase/supabase-js` import → ✅ `npm:@supabase/supabase-js@2`
- ❌ .env.local not in gitignore → ✅ Added to .gitignore

### Current Blockers
- ⚠️ Migrations not applied (need service role key)
- ⚠️ Buffer profiles not connected (Phase SHOW)

---

## Testing Plan

### After Migrations Applied
```bash
# Test connection
curl "https://aslcrwmbdtvimjrexxzw.supabase.co/rest/v1/use_cases?limit=1" \
  -H "apikey: eyJhbGci..."

# Should return: empty array [] (not "table not found")

# Test rate limiting
# (Run scripts/check-rls.ts if you have Deno)

# Test edge functions
curl -X POST "https://aslcrwmbdtvimjrexxzw.supabase.co/functions/v1/mint-card" \
  -H "apikey: eyJhbGci..." \
  -H "Content-Type: application/json" \
  -d '{"case_id": "test-123"}'
```

---

**Current Status:** 🟡 3/4 edge functions deployed, migrations ready, waiting on service role key

**Time Estimate:** 30-60 minutes to complete Phase 0 deployment once you have service role key

**Next Command:** `supabase functions deploy feed-query` (import issue fixed)
