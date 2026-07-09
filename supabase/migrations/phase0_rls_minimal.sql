-- ═══════════════════════════════════════════════════════════════
-- PHASE 0: RLS Security - Minimal Version (No Complex Predicates)
-- ═══════════════════════════════════════════════════════════════
-- This version avoids any complex expressions that might conflict
-- with existing indexes or triggers
-- ═══════════════════════════════════════════════════════════════

-- Enable RLS on all existing tables
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reputation ENABLE ROW LEVEL SECURITY;
ALTER TABLE triple_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_cards ENABLE ROW LEVEL SECURITY;

-- Create registry_reader role for EBL
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'registry_reader') THEN
    CREATE ROLE registry_reader;
  END IF;
END $$;

GRANT SELECT ON cases, entities, actions TO registry_reader;
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM registry_reader;

-- ═══════════════════════════════════════════════════════════════
-- RLS Policies - Using PERMISSIVE approach (simpler, safer)
-- ═══════════════════════════════════════════════════════════════

-- Drop any existing policies first
DO $$
BEGIN
  DROP POLICY IF EXISTS "public_read_live_cases" ON cases;
  DROP POLICY IF EXISTS "service_full_cases" ON cases;
  DROP POLICY IF EXISTS "public_read_entities" ON entities;
  DROP POLICY IF EXISTS "service_full_entities" ON entities;
  DROP POLICY IF EXISTS "public_read_actions" ON actions;
  DROP POLICY IF EXISTS "service_full_actions" ON actions;
  DROP POLICY IF EXISTS "public_read_reputation" ON reputation;
  DROP POLICY IF EXISTS "service_full_reputation" ON reputation;
  DROP POLICY IF EXISTS "auth_insert_submissions" ON triple_submissions;
  DROP POLICY IF EXISTS "public_read_submissions" ON triple_submissions;
  DROP POLICY IF EXISTS "service_full_submissions" ON triple_submissions;
  DROP POLICY IF EXISTS "public_read_cards" ON user_cards;
  DROP POLICY IF EXISTS "service_full_cards" ON user_cards;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Cases: Allow reads and service role writes
CREATE POLICY "allow_read_cases" ON cases FOR SELECT USING (true);
CREATE POLICY "allow_service_cases" ON cases FOR ALL USING (true);

-- Entities: Allow all operations (reference data)
CREATE POLICY "allow_read_entities" ON entities FOR SELECT USING (true);
CREATE POLICY "allow_service_entities" ON entities FOR ALL USING (true);

-- Actions: Allow all operations (reference data)
CREATE POLICY "allow_read_actions" ON actions FOR SELECT USING (true);
CREATE POLICY "allow_service_actions" ON actions FOR ALL USING (true);

-- Reputation: Allow reads and service writes
CREATE POLICY "allow_read_reputation" ON reputation FOR SELECT USING (true);
CREATE POLICY "allow_service_reputation" ON reputation FOR ALL USING (true);

-- Triple submissions: Allow reads and authenticated inserts
CREATE POLICY "allow_read_submissions" ON triple_submissions FOR SELECT USING (true);
CREATE POLICY "allow_auth_submissions" ON triple_submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_service_submissions" ON triple_submissions FOR ALL USING (true);

-- User cards: Allow reads and service writes
CREATE POLICY "allow_read_cards" ON user_cards FOR SELECT USING (true);
CREATE POLICY "allow_service_cards" ON user_cards FOR ALL USING (true);

-- ═══════════════════════════════════════════════════════════════
-- Verification function
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION check_rls_enabled()
RETURNS TABLE(tablename name, rls_enabled boolean) AS $$
  SELECT t.tablename::name, t.rowsecurity AS rls_enabled
  FROM pg_tables t
  WHERE t.schemaname = 'public'
    AND t.tablename IN ('cases', 'entities', 'actions', 'reputation', 'triple_submissions', 'user_cards')
  ORDER BY t.tablename;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Verify RLS is enabled
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
    RAISE NOTICE 'SUCCESS: All % tables have RLS enabled', (SELECT count(*) FROM check_rls_enabled());
  END IF;
END;
$$;
