-- ═══════════════════════════════════════════════════════════════
-- USE CASE ARMS RACE: Semantic Triple Enhancement
-- Migration to add proper [WHO] → [ACTION] → [WHOM] structure
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- PART 1: Enhance use_cases table with semantic triple fields
-- ═══════════════════════════════════════════════════════════════

-- Primary semantic triple (the canonical "X does Y to Z")
ALTER TABLE use_cases ADD COLUMN IF NOT EXISTS subject TEXT;        -- WHO: "Government agency", "Tech company"
ALTER TABLE use_cases ADD COLUMN IF NOT EXISTS verb TEXT;           -- ACTION: "catalogs", "monitors", "denies"
ALTER TABLE use_cases ADD COLUMN IF NOT EXISTS object TEXT;         -- WHOM: "license plates", "job applicants"

-- Summary for Discovery screen (brief "just the facts" description)
ALTER TABLE use_cases ADD COLUMN IF NOT EXISTS summary TEXT;        -- 1-2 sentence neutral summary

-- Modifiers as JSONB for flexibility
-- Structure: { "who": ["government", "ATF"], "action": ["automatically"], "whom": ["HIDTA", "drivers"] }
ALTER TABLE use_cases ADD COLUMN IF NOT EXISTS modifiers JSONB DEFAULT '{"who": [], "action": [], "whom": []}';

-- Source quality rating (aggregated from user votes)
ALTER TABLE use_cases ADD COLUMN IF NOT EXISTS source_quality TEXT DEFAULT 'unknown'
  CHECK (source_quality IN ('unknown', 'trustworthy', 'suspicious', 'mixed'));
ALTER TABLE use_cases ADD COLUMN IF NOT EXISTS source_good_votes INTEGER DEFAULT 0;
ALTER TABLE use_cases ADD COLUMN IF NOT EXISTS source_evil_votes INTEGER DEFAULT 0;

-- Comedy style tags (aggregated from user selections)
-- Structure: { "semantic": 5, "surprise": 3, "escalation": 2 }
ALTER TABLE use_cases ADD COLUMN IF NOT EXISTS comedy_tags JSONB DEFAULT '{}';

-- Story arc classification (auto-detected or user-assigned)
ALTER TABLE use_cases ADD COLUMN IF NOT EXISTS story_arc TEXT
  CHECK (story_arc IN ('panopticon', 'computer_says_no', 'rise_of_machines', 'minority_report', 'data_harvest', 'black_box', NULL));

-- ═══════════════════════════════════════════════════════════════
-- PART 2: Create semantic_modifiers reference table
-- Allows for hierarchical modifier trees
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS semantic_modifiers (
  id SERIAL PRIMARY KEY,

  -- Category: who, action, or whom
  category TEXT NOT NULL CHECK (category IN ('who', 'action', 'whom')),

  -- The modifier label
  label TEXT NOT NULL,

  -- Parent modifier for hierarchy (NULL = top level)
  parent_id INTEGER REFERENCES semantic_modifiers(id),

  -- Type classification
  modifier_type TEXT NOT NULL CHECK (modifier_type IN (
    'entity_type',    -- government, commercial, research
    'specific',       -- ATF, Flock, HIDTA
    'manner',         -- secretly, automatically
    'context',        -- students, patients
    'program'         -- HIPAA, FERPA
  )),

  -- Usage stats
  usage_count INTEGER DEFAULT 0,

  -- Example use cases where this modifier appears
  example_case_ids UUID[] DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(category, label)
);

CREATE INDEX idx_modifiers_category ON semantic_modifiers(category);
CREATE INDEX idx_modifiers_parent ON semantic_modifiers(parent_id);
CREATE INDEX idx_modifiers_type ON semantic_modifiers(modifier_type);

-- ═══════════════════════════════════════════════════════════════
-- PART 3: Seed initial modifier vocabulary
-- ═══════════════════════════════════════════════════════════════

-- WHO modifiers: Entity types (top level)
INSERT INTO semantic_modifiers (category, label, modifier_type) VALUES
  ('who', 'government', 'entity_type'),
  ('who', 'commercial', 'entity_type'),
  ('who', 'research', 'entity_type'),
  ('who', 'healthcare', 'entity_type'),
  ('who', 'military', 'entity_type'),
  ('who', 'law enforcement', 'entity_type'),
  ('who', 'nonprofit', 'entity_type'),
  ('who', 'education', 'entity_type')
ON CONFLICT (category, label) DO NOTHING;

-- WHO modifiers: Specific entities (children of entity types)
INSERT INTO semantic_modifiers (category, label, parent_id, modifier_type)
SELECT 'who', specific.label, parent.id, 'specific'
FROM (VALUES
  ('law enforcement', 'ATF'),
  ('law enforcement', 'FBI'),
  ('law enforcement', 'ICE'),
  ('law enforcement', 'DEA'),
  ('law enforcement', 'local police'),
  ('government', 'IRS'),
  ('government', 'DMV'),
  ('government', 'SSA'),
  ('commercial', 'Flock Safety'),
  ('commercial', 'Clearview AI'),
  ('commercial', 'Palantir'),
  ('commercial', 'Amazon'),
  ('commercial', 'Google'),
  ('commercial', 'Meta'),
  ('healthcare', 'hospital'),
  ('healthcare', 'insurance'),
  ('education', 'school district'),
  ('education', 'university')
) AS specific(parent_label, label)
JOIN semantic_modifiers parent ON parent.label = specific.parent_label AND parent.category = 'who'
ON CONFLICT (category, label) DO NOTHING;

-- ACTION modifiers: Manner adverbs
INSERT INTO semantic_modifiers (category, label, modifier_type) VALUES
  ('action', 'secretly', 'manner'),
  ('action', 'automatically', 'manner'),
  ('action', 'systematically', 'manner'),
  ('action', 'accidentally', 'manner'),
  ('action', 'experimentally', 'manner'),
  ('action', 'continuously', 'manner'),
  ('action', 'in real-time', 'manner'),
  ('action', 'without consent', 'manner'),
  ('action', 'at scale', 'manner')
ON CONFLICT (category, label) DO NOTHING;

-- WHOM modifiers: Affected contexts
INSERT INTO semantic_modifiers (category, label, modifier_type) VALUES
  ('whom', 'students', 'context'),
  ('whom', 'patients', 'context'),
  ('whom', 'workers', 'context'),
  ('whom', 'the public', 'context'),
  ('whom', 'suspects', 'context'),
  ('whom', 'immigrants', 'context'),
  ('whom', 'minors', 'context'),
  ('whom', 'vulnerable groups', 'context'),
  ('whom', 'job applicants', 'context'),
  ('whom', 'welfare recipients', 'context'),
  ('whom', 'drivers', 'context')
ON CONFLICT (category, label) DO NOTHING;

-- WHOM modifiers: Programs/regulations
INSERT INTO semantic_modifiers (category, label, modifier_type) VALUES
  ('whom', 'HIDTA', 'program'),
  ('whom', 'HIPAA-protected', 'program'),
  ('whom', 'FERPA-protected', 'program'),
  ('whom', 'Title IX', 'program'),
  ('whom', 'ADA-covered', 'program')
ON CONFLICT (category, label) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- PART 4: Function to update source quality from votes
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_source_quality() RETURNS TRIGGER AS $$
BEGIN
  -- Calculate quality based on vote ratio
  IF NEW.source_good_votes + NEW.source_evil_votes >= 3 THEN
    IF NEW.source_good_votes > NEW.source_evil_votes * 2 THEN
      NEW.source_quality := 'trustworthy';
    ELSIF NEW.source_evil_votes > NEW.source_good_votes * 2 THEN
      NEW.source_quality := 'suspicious';
    ELSE
      NEW.source_quality := 'mixed';
    END IF;
  ELSE
    NEW.source_quality := 'unknown';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_source_quality
  BEFORE INSERT OR UPDATE OF source_good_votes, source_evil_votes ON use_cases
  FOR EACH ROW EXECUTE FUNCTION update_source_quality();

-- ═══════════════════════════════════════════════════════════════
-- PART 5: Function to detect story arc from semantic triple
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION detect_story_arc(
  p_subject TEXT,
  p_verb TEXT,
  p_object TEXT
) RETURNS TEXT AS $$
DECLARE
  combined TEXT;
BEGIN
  combined := LOWER(COALESCE(p_subject, '') || ' ' || COALESCE(p_verb, '') || ' ' || COALESCE(p_object, ''));

  -- Panopticon: surveillance, monitoring, tracking
  IF combined ~ '(surveil|monitor|track|watch|scan|camera|recogni)' THEN
    RETURN 'panopticon';
  END IF;

  -- Computer Says No: denials, rejections, automated decisions
  IF combined ~ '(deny|reject|flag|block|refuse|declin|automat.*decis)' THEN
    RETURN 'computer_says_no';
  END IF;

  -- Rise of Machines: automation replacing humans
  IF combined ~ '(replac|automat|eliminat|robot|job|workforce|layoff)' THEN
    RETURN 'rise_of_machines';
  END IF;

  -- Minority Report: prediction, pre-crime, profiling
  IF combined ~ '(predict|profile|forecast|pre.?crime|risk.*score|recidiv)' THEN
    RETURN 'minority_report';
  END IF;

  -- Data Harvest: collection, scraping, privacy
  IF combined ~ '(collect|harvest|scrap|data|privacy|consent|personal)' THEN
    RETURN 'data_harvest';
  END IF;

  -- Black Box: unexplainable AI, bias, discrimination
  IF combined ~ '(bias|discriminat|unexplain|black.?box|opaque|unfair)' THEN
    RETURN 'black_box';
  END IF;

  RETURN NULL;  -- No clear arc detected
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════
-- PART 6: Trigger to auto-detect story arc when triple is set
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION auto_detect_story_arc() RETURNS TRIGGER AS $$
BEGIN
  -- Only auto-detect if story_arc is not already set
  IF NEW.story_arc IS NULL AND (NEW.subject IS NOT NULL OR NEW.verb IS NOT NULL) THEN
    NEW.story_arc := detect_story_arc(NEW.subject, NEW.verb, NEW.object);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_story_arc
  BEFORE INSERT OR UPDATE OF subject, verb, object ON use_cases
  FOR EACH ROW EXECUTE FUNCTION auto_detect_story_arc();

-- ═══════════════════════════════════════════════════════════════
-- PART 7: View for cases with full semantic data
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW cases_with_semantics AS
SELECT
  uc.*,
  -- Formatted triple
  COALESCE(uc.subject, 'Unknown') || ' → ' ||
  COALESCE(uc.verb, 'does something to') || ' → ' ||
  COALESCE(uc.object, 'someone') AS formatted_triple,

  -- Modifier counts
  jsonb_array_length(COALESCE(uc.modifiers->'who', '[]'::jsonb)) AS who_modifier_count,
  jsonb_array_length(COALESCE(uc.modifiers->'action', '[]'::jsonb)) AS action_modifier_count,
  jsonb_array_length(COALESCE(uc.modifiers->'whom', '[]'::jsonb)) AS whom_modifier_count,

  -- Has complete semantic data?
  (uc.subject IS NOT NULL AND uc.verb IS NOT NULL AND uc.object IS NOT NULL) AS has_complete_triple,
  (uc.summary IS NOT NULL AND LENGTH(uc.summary) > 20) AS has_summary

FROM use_cases uc;

-- ═══════════════════════════════════════════════════════════════
-- PART 8: Example update for "Commercial LPR (via HIDTA partners)"
-- This shows how to structure a legacy case
-- ═══════════════════════════════════════════════════════════════

-- This is an example - uncomment and modify the WHERE clause for real data
/*
UPDATE use_cases SET
  subject = 'Government agency',
  verb = 'catalogs',
  object = 'license plate locations',
  summary = 'The ATF uses commercial license plate reader data shared through High Intensity Drug Trafficking Area (HIDTA) partnerships to track vehicle movements across the country.',
  modifiers = '{
    "who": ["law enforcement", "ATF", "federal"],
    "action": ["automatically", "systematically"],
    "whom": ["HIDTA", "drivers", "the public"]
  }'::jsonb,
  story_arc = 'panopticon'
WHERE title ILIKE '%LPR%' OR title ILIKE '%license plate%' OR title ILIKE '%HIDTA%';
*/

-- ═══════════════════════════════════════════════════════════════
-- PART 9: Indexes for semantic search
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_cases_subject ON use_cases(subject);
CREATE INDEX IF NOT EXISTS idx_cases_verb ON use_cases(verb);
CREATE INDEX IF NOT EXISTS idx_cases_object ON use_cases(object);
CREATE INDEX IF NOT EXISTS idx_cases_story_arc ON use_cases(story_arc);
CREATE INDEX IF NOT EXISTS idx_cases_source_quality ON use_cases(source_quality);

-- Full-text search on semantic fields
CREATE INDEX IF NOT EXISTS idx_cases_semantic_fts ON use_cases USING gin(
  to_tsvector('english', COALESCE(subject, '') || ' ' || COALESCE(verb, '') || ' ' || COALESCE(object, '') || ' ' || COALESCE(summary, ''))
);

-- ═══════════════════════════════════════════════════════════════
-- DONE
-- ═══════════════════════════════════════════════════════════════
