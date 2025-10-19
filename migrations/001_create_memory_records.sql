-- Migration 001: Create memory_records table
-- Phase 3: Privacy, Security & Governance
-- Week 1: Base table with indexes (no partitioning yet)
-- LOCKED_AT: 2025-10-19 (Phase 3.3 - Memory Layer Freeze)

-- Create memory_records table
CREATE TABLE IF NOT EXISTS memory_records (
  -- Identity
  id UUID PRIMARY KEY,
  hashed_pseudonym TEXT NOT NULL,
  session_id TEXT,

  -- Content (JSONB for flexibility; will store encrypted data in Week 3)
  -- Structure: { type, data, metadata } OR { type, data_ciphertext, dek_ciphertext, dek_kid, encryption_version }
  content JSONB NOT NULL,

  -- Consent & Governance
  consent_family TEXT NOT NULL CHECK (consent_family IN ('personal', 'cohort', 'population')),
  consent_timestamp TIMESTAMPTZ NOT NULL,
  consent_version TEXT NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,  -- NULL = no expiration

  -- Metrics
  access_count INTEGER NOT NULL DEFAULT 0,

  -- Audit
  audit_receipt_id UUID NOT NULL
);

-- Indexes for common queries
-- Primary lookup: hashed_pseudonym + consent_family + created_at (for recall)
CREATE INDEX IF NOT EXISTS idx_memory_records_pseudonym_family_created
  ON memory_records (hashed_pseudonym, consent_family, created_at DESC);

-- Session-based recall
CREATE INDEX IF NOT EXISTS idx_memory_records_session_created
  ON memory_records (session_id, created_at DESC)
  WHERE session_id IS NOT NULL;

-- TTL sweep (expires_at cleanup)
CREATE INDEX IF NOT EXISTS idx_memory_records_expires
  ON memory_records (expires_at)
  WHERE expires_at IS NOT NULL;

-- Consent family filter (for aggregations)
CREATE INDEX IF NOT EXISTS idx_memory_records_family_created
  ON memory_records (consent_family, created_at DESC);

-- JSONB index for content type filtering
CREATE INDEX IF NOT EXISTS idx_memory_records_content_type
  ON memory_records ((content->>'type'));

-- Comments for documentation
COMMENT ON TABLE memory_records IS 'Memory Layer storage - Phase 3 with encryption support';
COMMENT ON COLUMN memory_records.hashed_pseudonym IS 'HMAC-derived pseudonym (rotates every 90 days)';
COMMENT ON COLUMN memory_records.content IS 'Memory content; encrypted in production (envelope encryption)';
COMMENT ON COLUMN memory_records.consent_family IS 'Consent scope: personal, cohort, or population';
COMMENT ON COLUMN memory_records.expires_at IS 'TTL expiration timestamp (NULL = never expires)';

-- Migration metadata
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  description TEXT
);

INSERT INTO schema_migrations (version, description)
VALUES (1, 'Create memory_records table with base indexes')
ON CONFLICT (version) DO NOTHING;
