-- ═══════════════════════════════════════════════════════════════
-- USE CASE ARMS RACE: DID + Reputation Schema
-- Supabase PostgreSQL Migration
-- ═══════════════════════════════════════════════════════════════

-- REPUTATION SYSTEM
-- Users earn rep by extracting good triples, voting with consensus

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Identity
  wallet_id TEXT UNIQUE,  -- Local storage ID for now
  did TEXT UNIQUE,        -- did:ebl:sha256(wallet_id + created_at)

  -- Reputation
  reputation INTEGER DEFAULT 0,
  rank TEXT DEFAULT 'newcomer' CHECK (rank IN ('newcomer', 'verified', 'analyst', 'expert', 'council')),

  -- Stats
  cases_submitted INTEGER DEFAULT 0,
  triples_extracted INTEGER DEFAULT 0,
  triples_best INTEGER DEFAULT 0,  -- Their triple was voted best
  votes_correct INTEGER DEFAULT 0,  -- Voted with majority

  -- Access
  access_level TEXT DEFAULT 'public' CHECK (access_level IN ('public', 'restricted', 'embargoed', 'full')),
  credentials JSONB DEFAULT '[]',  -- ['researcher', 'journalist', etc.]

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update rank based on reputation
CREATE OR REPLACE FUNCTION update_user_rank() RETURNS TRIGGER AS $$
BEGIN
  NEW.rank := CASE
    WHEN NEW.reputation >= 1000 THEN 'council'
    WHEN NEW.reputation >= 500 THEN 'expert'
    WHEN NEW.reputation >= 200 THEN 'analyst'
    WHEN NEW.reputation >= 50 THEN 'verified'
    ELSE 'newcomer'
  END;

  -- Update access level based on rank
  NEW.access_level := CASE
    WHEN NEW.rank IN ('council', 'expert') THEN 'full'
    WHEN NEW.rank = 'analyst' THEN 'restricted'
    ELSE 'public'
  END;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_rank
  BEFORE INSERT OR UPDATE OF reputation ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_user_rank();


-- DID SYSTEM FOR USE CASES
-- Each case gets a unique, verifiable identifier

ALTER TABLE use_cases ADD COLUMN IF NOT EXISTS did TEXT UNIQUE;
ALTER TABLE use_cases ADD COLUMN IF NOT EXISTS did_signature TEXT;  -- HMAC signature
ALTER TABLE use_cases ADD COLUMN IF NOT EXISTS access_classification TEXT DEFAULT 'public'
  CHECK (access_classification IN ('public', 'restricted', 'embargoed', 'revoked'));
ALTER TABLE use_cases ADD COLUMN IF NOT EXISTS embargo_until TIMESTAMPTZ;
ALTER TABLE use_cases ADD COLUMN IF NOT EXISTS minted_by UUID REFERENCES user_profiles(id);
ALTER TABLE use_cases ADD COLUMN IF NOT EXISTS minted_at TIMESTAMPTZ;


-- TRIPLE EXTRACTIONS
-- Users extract triples from cases, others vote on quality

CREATE TABLE IF NOT EXISTS triple_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES use_cases(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_profiles(id),

  -- The triple
  subject TEXT NOT NULL,
  verb TEXT NOT NULL,
  object TEXT NOT NULL,

  -- Voting
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,
  is_best BOOLEAN DEFAULT FALSE,  -- Marked as the best triple for this case

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_triple_case ON triple_extractions(case_id);
CREATE INDEX idx_triple_user ON triple_extractions(user_id);


-- TRIPLE VOTES
-- Track who voted on which triples

CREATE TABLE IF NOT EXISTS triple_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  extraction_id UUID REFERENCES triple_extractions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_profiles(id),
  vote INTEGER CHECK (vote IN (-1, 1)),  -- -1 = downvote, 1 = upvote
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(extraction_id, user_id)  -- One vote per user per extraction
);


-- REPUTATION EVENTS
-- Log all reputation changes for auditing

CREATE TABLE IF NOT EXISTS reputation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id),
  event_type TEXT NOT NULL,  -- 'case_approved', 'triple_best', 'vote_correct', etc.
  points INTEGER NOT NULL,
  reference_id UUID,  -- The case/triple/etc that triggered this
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rep_events_user ON reputation_events(user_id);


-- CREDENTIAL GRANTS
-- Track who issued what credentials to whom

CREATE TABLE IF NOT EXISTS credential_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID REFERENCES user_profiles(id),
  issuer_id UUID REFERENCES user_profiles(id),  -- Must be expert+
  credential_type TEXT NOT NULL CHECK (credential_type IN ('researcher', 'journalist', 'whistleblower', 'industry')),
  reason TEXT,
  revoked BOOLEAN DEFAULT FALSE,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- FUNCTIONS FOR REPUTATION

-- Award reputation points
CREATE OR REPLACE FUNCTION award_reputation(
  p_user_id UUID,
  p_event_type TEXT,
  p_points INTEGER,
  p_reference_id UUID DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  new_rep INTEGER;
BEGIN
  -- Log the event
  INSERT INTO reputation_events (user_id, event_type, points, reference_id)
  VALUES (p_user_id, p_event_type, p_points, p_reference_id);

  -- Update user reputation
  UPDATE user_profiles
  SET reputation = reputation + p_points
  WHERE id = p_user_id
  RETURNING reputation INTO new_rep;

  RETURN new_rep;
END;
$$ LANGUAGE plpgsql;


-- Generate DID for a case
CREATE OR REPLACE FUNCTION generate_case_did(
  p_case_id UUID
) RETURNS TEXT AS $$
DECLARE
  case_data RECORD;
  did_input TEXT;
  did TEXT;
BEGIN
  SELECT id, title, description, category, created_at
  INTO case_data
  FROM use_cases
  WHERE id = p_case_id;

  -- Build deterministic input for DID
  did_input := case_data.id::TEXT || '|' ||
               COALESCE(case_data.title, '') || '|' ||
               COALESCE(case_data.category, '') || '|' ||
               case_data.created_at::TEXT;

  -- Generate DID using SHA256 (first 32 chars)
  did := 'did:ebl:' || encode(sha256(did_input::bytea), 'hex');
  did := substring(did from 1 for 48);  -- did:ebl: + 40 chars

  -- Update the case
  UPDATE use_cases
  SET did = did, minted_at = NOW()
  WHERE id = p_case_id;

  RETURN did;
END;
$$ LANGUAGE plpgsql;


-- Check if user can access a case
CREATE OR REPLACE FUNCTION can_access_case(
  p_user_id UUID,
  p_case_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  case_classification TEXT;
  case_embargo TIMESTAMPTZ;
  user_access TEXT;
  user_credentials JSONB;
BEGIN
  -- Get case access info
  SELECT access_classification, embargo_until
  INTO case_classification, case_embargo
  FROM use_cases WHERE id = p_case_id;

  -- Public cases are always accessible
  IF case_classification = 'public' THEN
    RETURN TRUE;
  END IF;

  -- Revoked cases are never accessible
  IF case_classification = 'revoked' THEN
    RETURN FALSE;
  END IF;

  -- Embargoed cases: check time and credentials
  IF case_classification = 'embargoed' THEN
    IF case_embargo IS NOT NULL AND NOW() >= case_embargo THEN
      RETURN TRUE;  -- Embargo lifted
    END IF;
  END IF;

  -- Check user access level
  SELECT access_level, credentials
  INTO user_access, user_credentials
  FROM user_profiles WHERE id = p_user_id;

  -- Full access users can see everything except revoked
  IF user_access = 'full' THEN
    RETURN TRUE;
  END IF;

  -- Restricted access for analysts+
  IF case_classification = 'restricted' AND user_access IN ('restricted', 'full') THEN
    RETURN TRUE;
  END IF;

  -- Check specific credentials for embargoed
  IF case_classification = 'embargoed' THEN
    IF user_credentials ? 'journalist' OR user_credentials ? 'researcher' THEN
      RETURN TRUE;
    END IF;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;


-- VIEW: Cases with access filtering
CREATE OR REPLACE VIEW accessible_cases AS
SELECT
  uc.*,
  CASE
    WHEN uc.access_classification = 'public' THEN true
    WHEN uc.access_classification = 'revoked' THEN false
    WHEN uc.access_classification = 'embargoed' AND uc.embargo_until <= NOW() THEN true
    ELSE false
  END as publicly_accessible
FROM use_cases uc
WHERE uc.status IN ('active', 'approved');


-- REPUTATION POINT VALUES
COMMENT ON TABLE reputation_events IS '
Reputation Point Values:
------------------------
case_approved: +10 (your submitted case was approved)
triple_best: +25 (your triple was chosen as best)
vote_correct: +2 (you voted with consensus)
approve_correct: +5 (you approved a case others also approved)
views_100: +15 (your case got 100+ views)
caught_duplicate: +20 (you caught a duplicate/fake)
case_rejected: -5 (your submission was rejected)
triple_nonsense: -10 (your triple was voted nonsense)
';


-- INDEXES for performance
CREATE INDEX IF NOT EXISTS idx_cases_did ON use_cases(did);
CREATE INDEX IF NOT EXISTS idx_cases_classification ON use_cases(access_classification);
CREATE INDEX IF NOT EXISTS idx_cases_minted ON use_cases(minted_at);
