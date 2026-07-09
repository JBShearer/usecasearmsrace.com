# 🚀 DEPLOYMENT GUIDE - USE CASE ARMS RACE

**Version:** 1.0  
**Last Updated:** 2026-07-08  
**Target Audience:** DevOps, Site Reliability Engineers, OWNER

---

## OVERVIEW

This guide covers deploying the Use Case Arms Race project from local development to production. The project uses:
- **Frontend:** Static HTML/CSS/JS (GitHub Pages)
- **Backend:** Supabase (Postgres + Edge Functions)
- **CI/CD:** GitHub Actions (optional)
- **Feature Flags:** Environment variables

---

## PREREQUISITES

### Required Software
```bash
# Deno (for edge functions and tests)
curl -fsSL https://deno.land/install.sh | sh

# Supabase CLI
brew install supabase/tap/supabase
# OR
npm install -g supabase

# Git
git --version  # Should be installed

# PostgreSQL client (for manual queries)
brew install postgresql
# OR
apt-get install postgresql-client
```

### Required Accounts
- [x] Supabase project (staging + production)
- [x] GitHub account (with repo access)
- [x] Buffer account (for show distribution, Phase SHOW)
- [ ] Domain registrar (for custom domain, optional)

---

## ENVIRONMENT SETUP

### 1. Supabase Projects

**Create two projects:**
1. **Staging:** `usecasearmsrace-staging`
2. **Production:** `usecasearmsrace-prod`

**For each project, note:**
- Project URL: `https://[project-ref].supabase.co`
- Anon/Public Key: `[anon-key]`
- Service Role Key: `[service-role-key]` (KEEP SECRET)

### 2. Local Environment Variables

Create `.env.local` (DO NOT COMMIT):
```bash
# Staging
SUPABASE_URL_STAGING=https://your-staging-ref.supabase.co
SUPABASE_ANON_KEY_STAGING=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY_STAGING=eyJhbG...

# Production
SUPABASE_URL_PROD=https://your-prod-ref.supabase.co
SUPABASE_ANON_KEY_PROD=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY_PROD=eyJhbG...

# Buffer API (Phase SHOW)
BUFFER_ACCESS_TOKEN=your-buffer-token

# Feature Flags (default OFF)
FLAG_FEED=false
FLAG_AUTOVERIFY=false
FLAG_COMPLAINTS=false
FLAG_MINT_V2=false
FLAG_SHOW=false
```

### 3. Supabase CLI Configuration

Link projects:
```bash
# Link staging
supabase link --project-ref your-staging-ref

# Or manually in .supabase/config.toml:
[project]
id = "your-staging-ref"
```

---

## PHASE-BY-PHASE DEPLOYMENT

### PHASE 0: HARDENING (CRITICAL - MUST DEPLOY FIRST)

**Status:** ✅ Implementation complete (75%), deployment pending

#### Step 1: Deploy Migrations to Staging
```bash
cd "/Users/I530341/Documents/Evil Brain Production/usecasearmsrace.com"

# Set environment
export SUPABASE_URL=$SUPABASE_URL_STAGING
export SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY_STAGING

# Push migrations (003 & 004)
supabase db push --project-ref your-staging-ref

# Verify RLS enabled
psql "$DATABASE_URL_STAGING" -c "SELECT * FROM check_rls_enabled() WHERE rls_enabled = false;"
# Output should be empty (0 rows)

# Verify registry_reader role
psql "$DATABASE_URL_STAGING" -c "\\du registry_reader"
```

#### Step 2: Test RLS Policies
```bash
# Test anonymous read (should succeed)
psql "$DATABASE_URL_STAGING" -c "SET ROLE anon; SELECT count(*) FROM use_cases WHERE status = 'machine_verified';"

# Test anonymous write (should fail with RLS error)
psql "$DATABASE_URL_STAGING" -c "SET ROLE anon; INSERT INTO use_cases (title) VALUES ('Test');" 2>&1 | grep "policy"
```

#### Step 3: Enable pg_cron Cleanup Job
Via Supabase SQL Editor (Dashboard → SQL Editor):
```sql
SELECT cron.schedule(
  'cleanup-rate-limits',
  '* * * * *',  -- Every minute
  $$DELETE FROM rate_limits WHERE minute_bucket < NOW() - INTERVAL '5 minutes'$$
);
```

#### Step 4: Deploy Edge Functions
```bash
# Deploy submit-verdict (with rate limiting)
supabase functions deploy submit-verdict --project-ref your-staging-ref

# Deploy new functions
supabase functions deploy mint-card --project-ref your-staging-ref
supabase functions deploy feed-query --project-ref your-staging-ref
supabase functions deploy steward-brief --project-ref your-staging-ref
```

#### Step 5: Run Acceptance Tests
```bash
# Set test environment
export SUPABASE_URL=$SUPABASE_URL_STAGING
export SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY_STAGING
export SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY_STAGING

# Run Phase 0 tests
deno task test:phase0

# Verify all 5 tests pass:
# ✅ Test 1: No email-based privileges
# ✅ Test 2: Unauthenticated mutations blocked
# ✅ Test 3: Registry read-only enforcement
# ✅ Test 4: RLS enabled on all tables
# ⬜ Test 5: Rate limiting (may fail until edge functions deployed)
```

#### Step 6: Enable Supabase Auth
Via Supabase Dashboard → Authentication → Providers:
- [x] Enable Email provider
- [x] Enable Magic Links
- [x] Disable Email + Password (use magic links only)
- [x] Set Site URL: `https://usecasearmsrace.com` (or staging URL)

#### Step 7: Deploy to Production
**ONLY after staging tests pass:**
```bash
# Push migrations to production
supabase db push --project-ref your-prod-ref

# Deploy functions to production
supabase functions deploy submit-verdict --project-ref your-prod-ref
supabase functions deploy mint-card --project-ref your-prod-ref
supabase functions deploy feed-query --project-ref your-prod-ref
supabase functions deploy steward-brief --project-ref your-prod-ref

# Enable pg_cron cleanup job (same SQL as staging)

# Verify production tests
export SUPABASE_URL=$SUPABASE_URL_PROD
deno task test:phase0
```

#### Step 8: Feature Flag Rollout
In Supabase Dashboard → Edge Functions → Secrets:
```
# Phase 0 complete, keep OFF until Phase U1:
FLAG_FEED=false
FLAG_AUTOVERIFY=false
FLAG_COMPLAINTS=false
FLAG_MINT_V2=true  # ✅ Enable after mint-card deployed
```

---

### PHASE U1: FEED (AFTER PHASE 0 COMPLETE)

**Status:** ⬜ Not started (migration pending)

#### Step 1: Deploy Migration 007 (Votes, Watches, Status Log)
```bash
# Create migration (when ready)
supabase migration new feed_tables

# Add content from TASKS.md Phase U1, Task U1.1
# Deploy to staging first
supabase db push --project-ref your-staging-ref
```

#### Step 2: Deploy vote-on-case Function
```bash
supabase functions deploy vote-on-case --project-ref your-staging-ref
```

#### Step 3: Update index.html with Timeline UI
```bash
# Replace search-first layout with feed timeline
# Add tabs: Latest, Top, Under Fire, Flips
# Test locally: open index.html in browser
```

#### Step 4: Enable Realtime
In Supabase Dashboard → Database → Replication:
- [x] Enable realtime for `use_cases` table
- [x] Enable realtime for `votes` table

Update index.html:
```javascript
const channel = supabase.channel('feed')
  .on('broadcast', { event: 'vote_delta' }, handleVoteDelta)
  .subscribe();
```

#### Step 5: Add OpenGraph Meta Tags
In index.html `<head>`:
```html
<meta property="og:title" content="[Case Title] | USE CASE ARMS RACE">
<meta property="og:description" content="[Summary]">
<meta property="og:image" content="[Card PNG URL]">
<meta name="twitter:card" content="summary_large_image">
```

Test unfurl: https://cards-dev.twitter.com/validator

#### Step 6: Run Phase U1 Tests
```bash
deno task test:u1

# Verify 4 tests pass:
# ✅ First paint contains 20 cards
# ✅ Vote persistence and reconciliation
# ✅ OpenGraph unfurls
# ✅ Realtime within 2s
```

#### Step 7: Enable FLAG_FEED in Production
```bash
# After staging tests pass
FLAG_FEED=true  # Enable in production
```

---

### PHASE U2: AUTOVERIFY (AFTER PHASE U1 COMPLETE)

**Status:** ⬜ Not started

#### Step 1: Fix Embedding Dependencies
```bash
# Install embedding provider (Anthropic or OpenAI)
# Update supabase/functions/search-cases/index.ts
# Re-enable semantic search
```

#### Step 2: Deploy Migration 009 (Verifications Tables)
```bash
supabase migration new verification_tables
# Add verifications, model_actions tables
supabase db push --project-ref your-staging-ref
```

#### Step 3: Deploy autoverify Function
```bash
supabase functions deploy autoverify --project-ref your-staging-ref
```

#### Step 4: Integrate with submit-verdict
Update case submission flow to call autoverify after insert.

#### Step 5: Build Admin Queue UI
Update admin.html with needs_human review interface.

#### Step 6: Run Phase U2 Tests
```bash
deno task test:u2

# Verify 5 tests pass per TASKS.md
```

#### Step 7: Enable FLAG_AUTOVERIFY
```bash
FLAG_AUTOVERIFY=true  # Production
```

---

### PHASE U3: COMPLAINTS (AFTER PHASE U2 COMPLETE)

**Status:** ⬜ Not started

*(Steps omitted for brevity - see TASKS.md Phase U3)*

---

### PHASE EBL-1: CARD MINTING (PARALLEL TO U2-U3)

**Status:** ⬜ Functions ready, migration pending

#### Step 1: Deploy Migration 011 (Cards Tables)
```bash
supabase migration new cards_tables

# Add cards, card_instances, backgrounds, card_events tables
# From TASKS.md Phase EBL-1, Task EBL1.1
supabase db push --project-ref your-staging-ref
```

#### Step 2: Create Storage Bucket
Via Supabase Dashboard → Storage:
- [x] Create bucket: `cards` (public read)
- [x] Upload policy: Service role only

#### Step 3: Deploy mint-card Function (Already Done)
```bash
# Already deployed in Phase 0
# Verify it works:
curl -X POST "$SUPABASE_URL_STAGING/functions/v1/mint-card" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY_STAGING" \
  -H "Content-Type: application/json" \
  -d '{"case_id":"test-case-id"}'
```

#### Step 4: Run Backfill Script
```bash
# Create and run backfill script
deno run --allow-net --allow-env scripts/backfill-mint.ts
```

#### Step 5: Schedule Nightly Alignment Sync
Via Supabase SQL Editor:
```sql
SELECT cron.schedule(
  'sync-alignment',
  '0 2 * * *',  -- 2am daily
  $$SELECT net.http_post(
    url := '[SUPABASE_URL]/functions/v1/sync-alignment',
    headers := '{"Authorization": "Bearer [SERVICE_ROLE_KEY]"}'::jsonb
  )$$
);
```

#### Step 6: Run Phase EBL-1 Tests
```bash
deno task test:ebl1

# Verify 7 tests pass
```

#### Step 7: Enable FLAG_MINT_V2
```bash
FLAG_MINT_V2=true  # Production
```

---

### PHASE SHOW: DAILY EPISODES (AFTER U1, U2, EBL-1)

**Status:** ⬜ Not started, Buffer integration specified

#### Step 1: Deploy Migration 013 (Episodes Table)
```bash
supabase migration new episodes_table
# From BUFFER_INTEGRATION.md
supabase db push --project-ref your-staging-ref
```

#### Step 2: Set Up Buffer API
1. Sign up at https://buffer.com
2. Create app: "Use Case Arms Race Daily Show"
3. Connect YouTube, TikTok, LinkedIn profiles
4. Get access token
5. Add to Supabase Secrets: `BUFFER_ACCESS_TOKEN`

#### Step 3: Deploy publish-episode Function
```bash
# Create from BUFFER_INTEGRATION.md
supabase functions deploy publish-episode --project-ref your-staging-ref
```

#### Step 4: Deploy steward-brief Function (Already Done)
```bash
# Schedule via pg_cron:
SELECT cron.schedule(
  'steward-brief',
  '30 5 * * *',  -- 05:30 UTC daily
  $$SELECT net.http_post(
    url := '[SUPABASE_URL]/functions/v1/steward-brief',
    headers := '{"Authorization": "Bearer [SERVICE_ROLE_KEY]"}'::jsonb
  )$$
);
```

#### Step 5: Create Standards Page
```bash
# Create standards.html from SHOW_LAUNCH_RUNBOOK section 5
# Include: what MACHINE VERIFIED means, complaint process, satire notice
# Legal review required before launch
```

#### Step 6: Update index.html with Episode Carousel
Add episode list and social links (YouTube Shorts, TikTok, LinkedIn).

#### Step 7: Run Phase SHOW Tests
```bash
deno task test:show

# Verify episode workflow end-to-end
```

#### Step 8: Enable FLAG_SHOW
```bash
FLAG_SHOW=true  # Production
```

---

## MONITORING & OBSERVABILITY

### Health Checks

**Endpoint:** `${SUPABASE_URL}/functions/v1/health`
```typescript
// Create health check function
Deno.serve(async () => {
  const checks = {
    database: await checkDatabase(),
    storage: await checkStorage(),
    rateLimits: await checkRateLimits(),
  };
  return Response.json({ status: 'ok', checks });
});
```

### Metrics Dashboard

Via Supabase Dashboard → Monitoring:
- Database connections
- Edge function invocations
- Storage bandwidth
- Rate limit violations

### Logging

Edge functions automatically log to Supabase Logs.
View: Dashboard → Edge Functions → Logs

**Custom logging:**
```typescript
console.log('Info:', data);
console.error('Error:', error);
```

### Alerts

Set up via Dashboard → Monitoring → Alerts:
- [ ] Database CPU > 80% for 5 minutes
- [ ] Rate limit violations > 100/hour
- [ ] Edge function errors > 10/minute

---

## ROLLBACK PROCEDURES

### Rollback Migration
```bash
# Revert last migration
supabase db reset --project-ref your-prod-ref

# Or apply specific version
supabase db push --project-ref your-prod-ref --version [previous-version]
```

### Rollback Edge Function
```bash
# Redeploy previous version from git
git checkout [previous-commit]
supabase functions deploy [function-name] --project-ref your-prod-ref
git checkout main
```

### Disable Feature Flag
```bash
# Via Supabase Dashboard → Secrets
FLAG_FEED=false  # Instant rollback
```

### Emergency: Disable RLS
**ONLY in extreme emergency (security vulnerability):**
```sql
ALTER TABLE use_cases DISABLE ROW LEVEL SECURITY;
-- Fix issue immediately, then re-enable:
ALTER TABLE use_cases ENABLE ROW LEVEL SECURITY;
```

---

## BACKUP & RECOVERY

### Daily Backups (Automatic)

Supabase automatically backs up database daily.
Retention: 7 days (free tier), 30 days (pro tier)

### Manual Backup
```bash
# Dump database
pg_dump "$DATABASE_URL_PROD" > backup-$(date +%Y%m%d).sql

# Backup to S3 (if configured)
aws s3 cp backup-$(date +%Y%m%d).sql s3://your-bucket/backups/
```

### Restore from Backup
```bash
# Restore from SQL dump
psql "$DATABASE_URL_PROD" < backup-20260708.sql

# Or via Supabase Dashboard → Database → Backups → Restore
```

---

## TROUBLESHOOTING

### Issue: RLS Policies Not Working

**Symptoms:** Users can access data they shouldn't

**Solution:**
```bash
# Verify RLS enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public';

# Check policies
SELECT * FROM pg_policies WHERE schemaname='public';

# Re-apply Migration 003
supabase db push --project-ref your-prod-ref --include-all
```

### Issue: Rate Limiting Too Aggressive

**Symptoms:** Legitimate users getting HTTP 429

**Solution:**
```typescript
// Adjust limit in config/economy.ts
export const UCAR_CONFIG = {
  RATE_LIMIT_DEFAULT: 100,  // Increase from 30
};

// Or per-function override:
await checkRateLimit(userId, 'submit-verdict', 100);
```

### Issue: Edge Function Timeout

**Symptoms:** Functions return 500 after 60s

**Solution:**
```typescript
// Add timeout parameter (max 300s)
Deno.serve({ 
  port: 8000,
  signal: AbortSignal.timeout(120000)  // 2 minutes
}, handler);
```

### Issue: Embedding Search Disabled

**Symptoms:** Semantic search returns empty

**Solution:**
```bash
# Install embedding provider
# Update search-cases/index.ts
# Re-enable embed() calls
supabase functions deploy search-cases --project-ref your-prod-ref
```

---

## PRODUCTION LAUNCH CHECKLIST

### T-14 Days
- [ ] Phases 0, U1, U2, U3, EBL-1 deployed to staging
- [ ] All acceptance tests passing in staging
- [ ] Backfill minted all cards
- [ ] Standards page legal-reviewed
- [ ] Steward prompts frozen at v1

### T-7 Days
- [ ] Phase SHOW deployed to staging
- [ ] 6 Case of the Day candidates shortlisted
- [ ] 2 dress-rehearsal episodes produced
- [ ] OpenGraph unfurls verified on X
- [ ] Steward's registry entry filed

### T-1 Day
- [ ] Episode 1 recorded + scheduled
- [ ] Admin paging tested
- [ ] Rollback rehearsed (disable all flags)
- [ ] Monitor alerting configured

### Launch Day
- [ ] Publish episode 1
- [ ] Confirm Card of the Day live
- [ ] Monitor review queue + rate limits (6 hours)
- [ ] Post-launch note any [COPY] gaps found

### Week 1 Post-Launch
- [ ] Collect metrics (completion rate, submissions, votes, shares)
- [ ] Review complaint volume and dismissal rate
- [ ] Tune rate limits if needed
- [ ] Plan Phase 2-6 (EBL game economy)

---

**For questions or issues, refer to:**
- TASKS.md - Complete implementation guide
- SESSION_SUMMARY.md - This session's work
- BUILD_STATUS.md - Overall project status
- Repository: https://github.com/JBShearer/usecasearmsrace.com
