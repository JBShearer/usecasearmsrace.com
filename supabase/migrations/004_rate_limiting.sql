-- ═══════════════════════════════════════════════════════════════
-- USE CASE ARMS RACE: Rate Limiting System
-- Migration 004: Hardening - Phase 0, Task 0.3
-- ═══════════════════════════════════════════════════════════════
--
-- Purpose: Prevent spam and DOS attacks with per-user rate limiting
-- Default: 30 calls per minute per function (configurable in economy.ts)
--
-- Source: TASKS.md Phase 0, Task 0.3 + config/economy.ts
-- ═══════════════════════════════════════════════════════════════

-- ============================================================================
-- RATE LIMITS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS rate_limits (
  user_id TEXT NOT NULL,              -- UUID for authenticated, x-anon-id for anonymous
  function_name TEXT NOT NULL,        -- Edge function name (e.g., 'submit-verdict')
  minute_bucket TIMESTAMPTZ NOT NULL, -- Rounded to minute (for bucketing)
  call_count INT NOT NULL DEFAULT 1,

  PRIMARY KEY (user_id, function_name, minute_bucket),

  -- Auto-cleanup: Delete buckets older than 5 minutes (pg_cron job)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for cleanup query (no WHERE clause - simpler, no IMMUTABLE issue)
CREATE INDEX IF NOT EXISTS idx_rate_limits_cleanup ON rate_limits(minute_bucket);

COMMENT ON TABLE rate_limits IS
  'Per-user per-function rate limiting (30 calls/min default). Buckets auto-expire after 5min.';

-- ============================================================================
-- RLS POLICY (Service Role Only)
-- ============================================================================

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON rate_limits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY "Service role only" ON rate_limits IS
  'Only edge functions (service role) can manage rate limits';

-- ============================================================================
-- RPC FUNCTION: Increment Rate Limit
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_rate_limit(
  p_user_id TEXT,
  p_function_name TEXT,
  p_bucket TIMESTAMPTZ
) RETURNS TABLE(call_count INT) AS $$
  INSERT INTO rate_limits (user_id, function_name, minute_bucket, call_count)
  VALUES (p_user_id, p_function_name, p_bucket, 1)
  ON CONFLICT (user_id, function_name, minute_bucket)
  DO UPDATE SET call_count = rate_limits.call_count + 1
  RETURNING rate_limits.call_count;
$$ LANGUAGE sql SECURITY DEFINER;

COMMENT ON FUNCTION increment_rate_limit IS
  'Atomically increment call count for user+function+bucket. Returns new count.';

-- ============================================================================
-- CLEANUP JOB (pg_cron)
-- ============================================================================

-- Delete rate limit buckets older than 5 minutes (runs every minute)
-- Requires pg_cron extension (install via Supabase dashboard if not present)

-- Schedule via Supabase SQL Editor:
-- SELECT cron.schedule(
--   'cleanup-rate-limits',
--   '* * * * *',  -- Every minute
--   $$DELETE FROM rate_limits WHERE minute_bucket < NOW() - INTERVAL '5 minutes'$$
-- );

COMMENT ON TABLE rate_limits IS
  'Rate limiting with auto-cleanup. Install cleanup job via: SELECT cron.schedule(...) in SQL Editor';

-- ============================================================================
-- TEST QUERIES
-- ============================================================================

-- Test increment (should return 1, then 2, then 3...):
-- SELECT increment_rate_limit('test-user', 'test-function', date_trunc('minute', NOW()));
-- SELECT increment_rate_limit('test-user', 'test-function', date_trunc('minute', NOW()));
-- SELECT increment_rate_limit('test-user', 'test-function', date_trunc('minute', NOW()));

-- Check current call count:
-- SELECT * FROM rate_limits WHERE user_id = 'test-user';

-- Verify cleanup (wait 6 minutes, then check - old buckets should be gone):
-- SELECT count(*) FROM rate_limits WHERE minute_bucket < NOW() - INTERVAL '5 minutes';
-- (Should return 0 after cleanup job runs)

-- ============================================================================
-- ACCEPTANCE CRITERIA (Phase 0, Task 0.7)
-- ============================================================================

-- [ ] Rate limit table created with correct schema
-- [ ] increment_rate_limit RPC function works atomically
-- [ ] Service role can read/write rate_limits
-- [ ] Authenticated/anonymous users CANNOT directly access rate_limits
-- [x] Cleanup index exists for efficient old bucket deletion
-- [ ] Edge functions updated to call rateLimit.ts (see supabase/shared/rateLimit.ts)
-- [ ] Test: 31st call in same minute returns HTTP 429 (see tests/phase0/hardening.test.ts)

-- ════════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION 004
-- ════════════════════════════════════════════════════════════════════════════
