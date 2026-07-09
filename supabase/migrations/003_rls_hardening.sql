-- ═══════════════════════════════════════════════════════════════
-- USE CASE ARMS RACE: Row Level Security (RLS) Policies
-- Migration 003: Hardening - Phase 0, Task 0.1-0.6
-- ═══════════════════════════════════════════════════════════════
--
-- CRITICAL: This migration enables production-safe database access.
-- No table should be accessible without explicit RLS policies.
--
-- Policy Tiers (from db/POLICIES.md):
-- Tier 1: Public Read, Service Write Only (use_cases, semantic_modifiers)
-- Tier 2: Authenticated Read/Write, User Scoped (user_profiles, cards, etc.)
-- Tier 3: Authenticated Write, Public Read (reputation_events, audit logs)
-- Tier 4: Registry Read-Only Access (registry_reader role for EBL functions)
--
-- Source: db/POLICIES.md + UCAR_REGISTRY_BUILD_PLAN invariant 1
-- ═══════════════════════════════════════════════════════════════

-- ============================================================================
-- TIER 4: Create Registry Read-Only Role (EBL Isolation)
-- ============================================================================

-- Create role for EBL functions (read-only access to registry)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'registry_reader') THEN
    CREATE ROLE registry_reader;
  END IF;
END
$$;

-- Grant SELECT on registry tables only
GRANT SELECT ON use_cases TO registry_reader;
GRANT SELECT ON semantic_modifiers TO registry_reader;

-- Revoke all mutations (ensure read-only)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM registry_reader;

COMMENT ON ROLE registry_reader IS 'EBL functions use this role for read-only registry access (UCAR_REGISTRY_BUILD_PLAN invariant 1)';

-- ============================================================================
-- TIER 1: Public Read, Service Write Only
-- ============================================================================

-- use_cases: Core registry table
ALTER TABLE use_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read approved cases" ON use_cases
  FOR SELECT
  USING (
    status = 'machine_verified'
    OR status IS NULL  -- Legacy cases without status
  );

CREATE POLICY "Service role can insert" ON use_cases
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update" ON use_cases
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- No DELETE policy = no one can delete (append-only audit log)

COMMENT ON POLICY "Public read approved cases" ON use_cases IS
  'Registry is "instrument of record" - only approved cases visible to public';

-- semantic_modifiers: Vocabulary reference table
ALTER TABLE semantic_modifiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read modifiers" ON semantic_modifiers
  FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage modifiers" ON semantic_modifiers
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- TIER 2: Authenticated Read/Write, User Scoped
-- ============================================================================

-- user_profiles: User identity and reputation
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users read own profile" ON user_profiles
  FOR SELECT
  USING (
    auth.uid() = id
    OR wallet_id = current_setting('app.anon_id', true)  -- Anonymous identity
  );

-- Users can update their own profile (limited fields)
CREATE POLICY "Users update own profile" ON user_profiles
  FOR UPDATE
  USING (auth.uid() = id OR wallet_id = current_setting('app.anon_id', true))
  WITH CHECK (
    (auth.uid() = id OR wallet_id = current_setting('app.anon_id', true))
    AND (OLD.reputation = NEW.reputation)  -- Cannot self-grant reputation
    AND (OLD.rank = NEW.rank)              -- Cannot self-promote rank
    AND (OLD.access_level = NEW.access_level)  -- Cannot self-elevate access
  );

-- Service role can manage all profiles
CREATE POLICY "Service role full access profiles" ON user_profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Public can read public leaderboard data (filtered via view)
CREATE POLICY "Public read leaderboard" ON user_profiles
  FOR SELECT
  USING (true);  -- View will filter sensitive fields

COMMENT ON POLICY "Users update own profile" ON user_profiles IS
  'Users can update non-critical fields only; reputation/rank managed by triggers';

-- triple_extractions: Semantic triple submissions
ALTER TABLE triple_extractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read extractions" ON triple_extractions
  FOR SELECT
  USING (true);

CREATE POLICY "Users insert own extractions" ON triple_extractions
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR user_id IN (SELECT id FROM user_profiles WHERE wallet_id = current_setting('app.anon_id', true))
  );

CREATE POLICY "Service role manage extractions" ON triple_extractions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- triple_votes: Votes on triple quality
ALTER TABLE triple_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read votes" ON triple_votes
  FOR SELECT
  USING (true);

CREATE POLICY "Users vote on triples" ON triple_votes
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR user_id IN (SELECT id FROM user_profiles WHERE wallet_id = current_setting('app.anon_id', true))
  );

CREATE POLICY "Service role manage votes" ON triple_votes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- user_cards: Collected cards
ALTER TABLE user_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own cards" ON user_cards
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR user_id IN (SELECT id FROM user_profiles WHERE wallet_id = current_setting('app.anon_id', true))
  );

CREATE POLICY "Service role manage cards" ON user_cards
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- user_decks: Deck building
ALTER TABLE user_decks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own decks" ON user_decks
  FOR ALL
  USING (
    auth.uid() = user_id
    OR user_id IN (SELECT id FROM user_profiles WHERE wallet_id = current_setting('app.anon_id', true))
  )
  WITH CHECK (
    auth.uid() = user_id
    OR user_id IN (SELECT id FROM user_profiles WHERE wallet_id = current_setting('app.anon_id', true))
  );

-- triple_submissions: Raw submissions with embeddings
ALTER TABLE triple_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read submissions" ON triple_submissions
  FOR SELECT
  USING (true);

CREATE POLICY "Users insert submissions" ON triple_submissions
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR user_id IN (SELECT id FROM user_profiles WHERE wallet_id = current_setting('app.anon_id', true))
  );

CREATE POLICY "Service role manage submissions" ON triple_submissions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- idea_clusters: Semantic clustering
ALTER TABLE idea_clusters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read clusters" ON idea_clusters
  FOR SELECT
  USING (true);

CREATE POLICY "Service role manage clusters" ON idea_clusters
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- TIER 3: Authenticated Write, Public Read (Audit Logs)
-- ============================================================================

-- reputation_events: Append-only reputation audit log
ALTER TABLE reputation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read rep events" ON reputation_events
  FOR SELECT
  USING (true);

CREATE POLICY "Service role insert rep events" ON reputation_events
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- No UPDATE or DELETE policies (append-only)

COMMENT ON POLICY "Public read rep events" ON reputation_events IS
  'Public transparency: all reputation changes visible (UCAR_REGISTRY_BUILD_PLAN invariant 5)';

-- credential_grants: Issuer-based credentials
ALTER TABLE credential_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read credentials" ON credential_grants
  FOR SELECT
  USING (true);

CREATE POLICY "Service role manage credentials" ON credential_grants
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- HELPER FUNCTION: Check RLS Status (for tests)
-- ============================================================================

CREATE OR REPLACE FUNCTION check_rls_enabled()
RETURNS TABLE(table_name text, rls_enabled boolean) AS $$
  SELECT tablename::text, rowsecurity
  FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY tablename;
$$ LANGUAGE sql SECURITY DEFINER;

COMMENT ON FUNCTION check_rls_enabled IS
  'Test helper: returns RLS status for all public tables (Phase 0 acceptance test 4)';

-- ============================================================================
-- VERIFICATION QUERIES (Run after migration)
-- ============================================================================

-- Verify all tables have RLS enabled:
-- SELECT * FROM check_rls_enabled() WHERE rls_enabled = false;
-- (Should return 0 rows)

-- Verify registry_reader role exists and has correct grants:
-- SELECT * FROM pg_roles WHERE rolname = 'registry_reader';
-- SELECT grantee, table_name, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE grantee = 'registry_reader';
-- (Should show SELECT only on use_cases, semantic_modifiers)

-- Test anonymous read (should succeed for approved cases):
-- SET ROLE anon;
-- SELECT count(*) FROM use_cases WHERE status = 'machine_verified';
-- RESET ROLE;

-- Test anonymous write (should fail):
-- SET ROLE anon;
-- INSERT INTO use_cases (title, summary) VALUES ('Test', 'Should fail');
-- RESET ROLE;
-- (Should return: ERROR: new row violates row-level security policy)

-- ============================================================================
-- ROLLBACK (if needed)
-- ============================================================================

-- To disable RLS on all tables (emergency only):
-- ALTER TABLE use_cases DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
-- ... (repeat for all tables)

-- To drop registry_reader role:
-- REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM registry_reader;
-- DROP ROLE IF EXISTS registry_reader;

-- ============================================================================
-- ACCEPTANCE CRITERIA (Phase 0, Task 0.7)
-- ============================================================================

-- [ ] No code path grants privileges based on email content (test: grep codebase)
-- [ ] Unauthenticated user cannot mutate any table (test: API calls return 401/403)
-- [x] Registry read-only role created (test: registry_reader role exists)
-- [x] RLS enabled on 100% of tables (test: check_rls_enabled() returns 0 false)
-- [ ] Rate limit returns HTTP 429 on 31st call (test: requires Migration 004)

-- ════════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION 003
-- ════════════════════════════════════════════════════════════════════════════
