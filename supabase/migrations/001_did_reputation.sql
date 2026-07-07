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


-- ═══════════════════════════════════════════════════════════════
-- CARD COLLECTION SYSTEM
-- Users collect cards, cards have powers, decks can be built
-- ═══════════════════════════════════════════════════════════════

-- Cards that users have collected
CREATE TABLE IF NOT EXISTS user_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  case_id UUID REFERENCES use_cases(id),

  -- Card stats (generated at mint time)
  card_name TEXT NOT NULL,           -- NVN title
  faction TEXT NOT NULL CHECK (faction IN ('heaven', 'hell')),
  attack INTEGER NOT NULL DEFAULT 5,
  defense INTEGER NOT NULL DEFAULT 5,
  flavor_text TEXT,

  -- The triple this user extracted
  triple_subject TEXT,
  triple_verb TEXT,
  triple_object TEXT,

  -- Card rarity based on how unique the extraction was
  rarity TEXT DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'legendary')),

  -- Card powers (JSON array of abilities)
  powers JSONB DEFAULT '[]',

  minted_at TIMESTAMPTZ DEFAULT NOW(),

  -- A user can have multiple copies of the same case (different extractions)
  UNIQUE(user_id, case_id, triple_subject, triple_verb, triple_object)
);

CREATE INDEX idx_user_cards_user ON user_cards(user_id);
CREATE INDEX idx_user_cards_faction ON user_cards(faction);
CREATE INDEX idx_user_cards_rarity ON user_cards(rarity);


-- Card powers/abilities
-- Heaven cards help, Hell cards harm (in-game)
COMMENT ON COLUMN user_cards.powers IS '
Card Powers (JSON array):
-------------------------
HEAVEN POWERS:
- {"type": "heal", "value": 2} - Restore 2 reputation to target
- {"type": "shield", "value": 1} - Block 1 attack
- {"type": "reveal", "scope": "restricted"} - Reveal a restricted case
- {"type": "verify", "bonus": 5} - +5 rep when this triple is validated
- {"type": "inspire", "multiplier": 1.5} - 1.5x coins on next mint

HELL POWERS:
- {"type": "attack", "value": 3} - Deal 3 damage to opponent card
- {"type": "corrupt", "chance": 0.2} - 20% chance to flip a heaven card
- {"type": "surveil", "duration": 3} - See opponent hands for 3 turns
- {"type": "deny", "target": "credential"} - Block a credential grant
- {"type": "leak", "scope": "embargoed"} - Reveal an embargoed case early
';


-- User decks (for future card battle mode)
CREATE TABLE IF NOT EXISTS user_decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Main Deck',
  description TEXT,
  faction_focus TEXT CHECK (faction_focus IN ('heaven', 'hell', 'mixed')),
  card_ids UUID[] DEFAULT '{}',  -- Array of user_card IDs
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_decks_user ON user_decks(user_id);


-- ═══════════════════════════════════════════════════════════════
-- TRIPLE VARIATIONS - Capture everyone's ideas
-- Every extraction attempt is stored, even "wrong" ones
-- This is the hive mind's view of AI use cases
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS triple_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source (either from a case or freeform)
  case_id UUID REFERENCES use_cases(id),
  source_url TEXT,                    -- If submitted from URL
  source_title TEXT,

  -- The submitted triple
  subject TEXT NOT NULL,
  verb TEXT NOT NULL,
  object TEXT NOT NULL,

  -- Who submitted and when
  user_id UUID REFERENCES user_profiles(id),
  session_id TEXT,                    -- Anonymous session if no user

  -- Classification
  faction TEXT CHECK (faction IN ('heaven', 'hell')),
  user_reasoning TEXT,                -- Why they chose heaven/hell

  -- The flavor note they picked
  flavor_note TEXT,

  -- Validation status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'validated', 'disputed', 'rejected')),
  validator_id UUID REFERENCES user_profiles(id),
  validated_at TIMESTAMPTZ,

  -- Clustering (for finding patterns)
  embedding VECTOR(384),              -- For semantic similarity (if pgvector enabled)
  cluster_id INTEGER,                 -- Which idea cluster this belongs to

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_triple_submissions_case ON triple_submissions(case_id);
CREATE INDEX idx_triple_submissions_user ON triple_submissions(user_id);
CREATE INDEX idx_triple_submissions_status ON triple_submissions(status);
CREATE INDEX idx_triple_submissions_faction ON triple_submissions(faction);


-- ═══════════════════════════════════════════════════════════════
-- IDEA CLUSTERS
-- Group similar triple submissions to find patterns in how people
-- think about AI use cases
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS idea_clusters (
  id SERIAL PRIMARY KEY,

  -- Cluster metadata
  name TEXT,                          -- Auto-generated or curator-assigned
  description TEXT,

  -- Representative triple (centroid)
  centroid_subject TEXT,
  centroid_verb TEXT,
  centroid_object TEXT,

  -- Stats
  submission_count INTEGER DEFAULT 0,
  heaven_count INTEGER DEFAULT 0,
  hell_count INTEGER DEFAULT 0,

  -- Is this a "nightmare scenario" cluster?
  is_dystopian BOOLEAN DEFAULT FALSE,
  dystopia_score FLOAT,               -- How consistently people vote hell

  -- Is this a "utopia scenario" cluster?
  is_utopian BOOLEAN DEFAULT FALSE,
  utopia_score FLOAT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- Function to assign card rarity based on triple uniqueness
CREATE OR REPLACE FUNCTION calculate_card_rarity(
  p_case_id UUID,
  p_subject TEXT,
  p_verb TEXT,
  p_object TEXT
) RETURNS TEXT AS $$
DECLARE
  similar_count INTEGER;
  total_for_case INTEGER;
BEGIN
  -- Count how many similar extractions exist for this case
  SELECT COUNT(*) INTO similar_count
  FROM triple_submissions
  WHERE case_id = p_case_id
    AND subject ILIKE '%' || p_subject || '%'
    AND verb ILIKE '%' || p_verb || '%'
    AND object ILIKE '%' || p_object || '%';

  -- Count total extractions for this case
  SELECT COUNT(*) INTO total_for_case
  FROM triple_submissions
  WHERE case_id = p_case_id;

  -- Determine rarity (more unique = more rare)
  IF total_for_case < 5 THEN
    RETURN 'uncommon';  -- Early extractor bonus
  ELSIF similar_count <= 1 THEN
    RETURN 'legendary';  -- Completely unique extraction
  ELSIF similar_count <= 3 THEN
    RETURN 'rare';
  ELSIF similar_count <= 10 THEN
    RETURN 'uncommon';
  ELSE
    RETURN 'common';
  END IF;
END;
$$ LANGUAGE plpgsql;


-- Function to generate card powers based on faction and rarity
CREATE OR REPLACE FUNCTION generate_card_powers(
  p_faction TEXT,
  p_rarity TEXT
) RETURNS JSONB AS $$
DECLARE
  powers JSONB := '[]';
  power_count INTEGER;
BEGIN
  -- More rare = more powers
  power_count := CASE p_rarity
    WHEN 'legendary' THEN 3
    WHEN 'rare' THEN 2
    WHEN 'uncommon' THEN 1
    ELSE 0
  END;

  IF power_count = 0 THEN
    RETURN powers;
  END IF;

  -- Add faction-appropriate powers
  IF p_faction = 'heaven' THEN
    powers := powers || jsonb_build_array(
      jsonb_build_object('type', 'heal', 'value', 1 + (random() * 3)::int)
    );
    IF power_count >= 2 THEN
      powers := powers || jsonb_build_array(
        jsonb_build_object('type', 'shield', 'value', 1 + (random() * 2)::int)
      );
    END IF;
    IF power_count >= 3 THEN
      powers := powers || jsonb_build_array(
        jsonb_build_object('type', 'inspire', 'multiplier', 1.5)
      );
    END IF;
  ELSE  -- hell
    powers := powers || jsonb_build_array(
      jsonb_build_object('type', 'attack', 'value', 2 + (random() * 4)::int)
    );
    IF power_count >= 2 THEN
      powers := powers || jsonb_build_array(
        jsonb_build_object('type', 'corrupt', 'chance', 0.1 + (random() * 0.2))
      );
    END IF;
    IF power_count >= 3 THEN
      powers := powers || jsonb_build_array(
        jsonb_build_object('type', 'surveil', 'duration', 2 + (random() * 3)::int)
      );
    END IF;
  END IF;

  RETURN powers;
END;
$$ LANGUAGE plpgsql;
