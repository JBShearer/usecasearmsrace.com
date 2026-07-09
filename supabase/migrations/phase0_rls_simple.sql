-- ═══════════════════════════════════════════════════════════════
-- PHASE 0: RLS Security for Existing Tables
-- Apply this to existing database with: cases, entities, actions, etc.
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

-- Cases: Public read live cases, service role full access
CREATE POLICY "public_read_live_cases" ON cases FOR SELECT USING (status = 'live');
CREATE POLICY "service_full_cases" ON cases FOR ALL USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- Entities: Public read, service write
CREATE POLICY "public_read_entities" ON entities FOR SELECT USING (true);
CREATE POLICY "service_full_entities" ON entities FOR ALL USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- Actions: Public read, service write
CREATE POLICY "public_read_actions" ON actions FOR SELECT USING (true);
CREATE POLICY "service_full_actions" ON actions FOR ALL USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- Reputation: Public read, service write
CREATE POLICY "public_read_reputation" ON reputation FOR SELECT USING (true);
CREATE POLICY "service_full_reputation" ON reputation FOR ALL USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- Triple submissions: Authenticated insert, public read, service full
CREATE POLICY "auth_insert_submissions" ON triple_submissions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "public_read_submissions" ON triple_submissions FOR SELECT USING (true);
CREATE POLICY "service_full_submissions" ON triple_submissions FOR ALL USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- User cards: Public read, service write
CREATE POLICY "public_read_cards" ON user_cards FOR SELECT USING (true);
CREATE POLICY "service_full_cards" ON user_cards FOR ALL USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- Verification function
CREATE OR REPLACE FUNCTION check_rls_enabled()
RETURNS TABLE(tablename name, rls_enabled boolean) AS $$
  SELECT t.tablename::name, t.rowsecurity AS rls_enabled
  FROM pg_tables t
  WHERE t.schemaname = 'public'
    AND t.tablename IN ('cases', 'entities', 'actions', 'reputation', 'triple_submissions', 'user_cards')
  ORDER BY t.tablename;
$$ LANGUAGE sql SECURITY DEFINER;
