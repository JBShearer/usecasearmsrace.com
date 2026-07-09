-- ═══════════════════════════════════════════════════════════════
-- USE CASE ARMS RACE: RLS Hardening (Adapted for Existing Schema)
-- Phase 0, Task 0.6
-- ═══════════════════════════════════════════════════════════════
--
-- This migration adds RLS policies to EXISTING tables:
-- cases, entities, actions, reputation, triple_submissions, user_cards
--
-- DO NOT run migrations 000, 001, or 002 - they conflict with existing schema
--
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- PART 1: Enable RLS on all existing tables
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reputation ENABLE ROW LEVEL SECURITY;
ALTER TABLE triple_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_cards ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════
-- PART 2: Create registry_reader role for EBL isolation
-- ═══════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'registry_reader') THEN
    CREATE ROLE registry_reader;
  END IF;
END
$$;

-- Grant SELECT-only access to registry tables
GRANT SELECT ON cases TO registry_reader;
GRANT SELECT ON entities TO registry_reader;
GRANT SELECT ON actions TO registry_reader;

-- Revoke write permissions
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM registry_reader;

-- ═══════════════════════════════════════════════════════════════
-- PART 3: RLS Policies (4-tier system)
-- ═══════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────
-- TIER 1: Public read on live cases
-- ──────────────────────────────────────────────────────────────

CREATE POLICY "Public can view live cases"
  ON cases FOR SELECT
  USING (status = 'live');

CREATE POLICY "Service role full access to cases"
  ON cases FOR ALL
  USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- ──────────────────────────────────────────────────────────────
-- TIER 2: Authenticated users can submit and vote
-- ──────────────────────────────────────────────────────────────

CREATE POLICY "Authenticated users can submit triples"
  ON triple_submissions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view own submissions"
  ON triple_submissions FOR SELECT
  USING (true); -- Public read for transparency

CREATE POLICY "Users can update own submissions"
  ON triple_submissions FOR UPDATE
  USING (user_id::text = auth.uid()::text);

CREATE POLICY "Service role full access to submissions"
  ON triple_submissions FOR ALL
  USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- ──────────────────────────────────────────────────────────────
-- User cards: Users own their cards
-- ──────────────────────────────────────────────────────────────

CREATE POLICY "Users can view all cards"
  ON user_cards FOR SELECT
  USING (true); -- Public gallery

CREATE POLICY "Service role can mint cards"
  ON user_cards FOR INSERT
  WITH CHECK (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

CREATE POLICY "Service role full access to cards"
  ON user_cards FOR ALL
  USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- ──────────────────────────────────────────────────────────────
-- Reputation: Public read, service write
-- ──────────────────────────────────────────────────────────────

CREATE POLICY "Public can view reputation"
  ON reputation FOR SELECT
  USING (true);

CREATE POLICY "Service role manages reputation"
  ON reputation FOR ALL
  USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- ──────────────────────────────────────────────────────────────
-- TIER 3: Reference data (entities, actions) - Public read
-- ──────────────────────────────────────────────────────────────

CREATE POLICY "Public can view entities"
  ON entities FOR SELECT
  USING (true);

CREATE POLICY "Service role manages entities"
  ON entities FOR ALL
  USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

CREATE POLICY "Public can view actions"
  ON actions FOR SELECT
  USING (true);

CREATE POLICY "Service role manages actions"
  ON actions FOR ALL
  USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- ═══════════════════════════════════════════════════════════════
-- PART 4: Verification function
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION check_rls_enabled()
RETURNS TABLE(tablename name, rls_enabled boolean) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.tablename::name,
    t.rowsecurity AS rls_enabled
  FROM pg_tables t
  WHERE t.schemaname = 'public'
    AND t.tablename IN ('cases', 'entities', 'actions', 'reputation', 'triple_submissions', 'user_cards')
  ORDER BY t.tablename;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Test function
COMMENT ON FUNCTION check_rls_enabled() IS
'Verification function for tests/phase0/hardening.test.ts
Returns list of tables with RLS status.
All should show rls_enabled = true.';

-- ═══════════════════════════════════════════════════════════════
-- ROLLBACK INSTRUCTIONS
-- ═══════════════════════════════════════════════════════════════

COMMENT ON ROLE registry_reader IS
'Read-only role for EBL game to access registry data.
To remove: DROP ROLE registry_reader;';

-- ═══════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════════

-- Check all tables have RLS enabled
DO $$
DECLARE
  r RECORD;
  disabled_count INTEGER := 0;
BEGIN
  FOR r IN SELECT * FROM check_rls_enabled() WHERE NOT rls_enabled LOOP
    RAISE WARNING 'RLS NOT ENABLED: %', r.tablename;
    disabled_count := disabled_count + 1;
  END LOOP;

  IF disabled_count > 0 THEN
    RAISE EXCEPTION '% table(s) do not have RLS enabled', disabled_count;
  ELSE
    RAISE NOTICE 'SUCCESS: All tables have RLS enabled';
  END IF;
END;
$$;
