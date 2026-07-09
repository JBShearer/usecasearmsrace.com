-- ═══════════════════════════════════════════════════════════════
-- USE CASE ARMS RACE: Base Schema (CREATE use_cases table)
-- Run this FIRST before 001 and 002
-- ═══════════════════════════════════════════════════════════════

-- Create the base use_cases table that other migrations depend on
CREATE TABLE IF NOT EXISTS use_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic metadata
  title TEXT NOT NULL,
  description TEXT,  -- Longer description (used by 001's generate_case_did function)
  category TEXT,     -- Category classification (used by 001's generate_case_did function)
  source TEXT,       -- URL to article/documentation

  -- Voting (good vs evil)
  good_votes INTEGER DEFAULT 0,
  evil_votes INTEGER DEFAULT 0,

  -- Status workflow
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',           -- Just submitted, awaiting verification
    'machine_verified',  -- Passed automated checks
    'needs_human',       -- Flagged for human review
    'approved',          -- Human approved
    'rejected',          -- Rejected (spam, duplicate, etc.)
    'active'             -- Active/published (used by 001's publicly_accessible view)
  )),

  -- Machine verification
  machine_verified BOOLEAN DEFAULT false,
  verification_score FLOAT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Impact rating (1-5, derived from votes)
  impact INTEGER DEFAULT 1 CHECK (impact >= 1 AND impact <= 5),

  -- Faction (derived from vote ratio)
  faction TEXT CHECK (faction IN ('heaven', 'hell')),
  alignment_ratio FLOAT, -- good_votes / (good_votes + evil_votes)

  -- Card minting
  card_minted BOOLEAN DEFAULT false,
  card_art_url TEXT
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_use_cases_status ON use_cases(status);
CREATE INDEX IF NOT EXISTS idx_use_cases_created ON use_cases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_use_cases_votes ON use_cases(good_votes DESC, evil_votes DESC);
CREATE INDEX IF NOT EXISTS idx_use_cases_faction ON use_cases(faction) WHERE faction IS NOT NULL;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_use_cases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER use_cases_updated_at
  BEFORE UPDATE ON use_cases
  FOR EACH ROW
  EXECUTE FUNCTION update_use_cases_updated_at();

-- Auto-update alignment ratio and faction from votes
CREATE OR REPLACE FUNCTION update_case_faction()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate alignment ratio (0.0 = all evil, 1.0 = all good)
  IF (NEW.good_votes + NEW.evil_votes) > 0 THEN
    NEW.alignment_ratio := NEW.good_votes::float / (NEW.good_votes + NEW.evil_votes);
  ELSE
    NEW.alignment_ratio := 0.5; -- neutral if no votes
  END IF;

  -- Determine faction with hysteresis (0.05 buffer to prevent flip-flopping)
  IF NEW.alignment_ratio >= 0.55 THEN
    NEW.faction := 'heaven';
  ELSIF NEW.alignment_ratio <= 0.45 THEN
    NEW.faction := 'hell';
  ELSE
    NEW.faction := NULL; -- contested/neutral
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER use_cases_faction
  BEFORE INSERT OR UPDATE OF good_votes, evil_votes ON use_cases
  FOR EACH ROW
  EXECUTE FUNCTION update_case_faction();

-- ═══════════════════════════════════════════════════════════════
-- NOTES
-- ═══════════════════════════════════════════════════════════════
--
-- This migration creates the base use_cases table that migrations
-- 001 and 002 depend on (they both do ALTER TABLE use_cases).
--
-- Apply order:
-- 1. This file (000_base_schema.sql)
-- 2. 001_did_reputation.sql
-- 3. 002_semantic_triples.sql
-- 4. 003_rls_hardening.sql
-- 5. 004_rate_limiting.sql
--
-- ═══════════════════════════════════════════════════════════════
