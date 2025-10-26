-- Migration 001: Create memory_records table
-- Phase 3: Privacy, Security & Governance
-- Week 1: Base table with indexes and range partitioning by created_at

-- Create memory_records table (partitioned by created_at for performance)
CREATE TABLE IF NOT EXISTS memory_records (
  -- Identity
  id UUID NOT NULL,
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
  audit_receipt_id UUID NOT NULL,

  -- Composite primary key (id + created_at required for partitioning)
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

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
VALUES (1, 'Create memory_records table with base indexes and partitioning')
ON CONFLICT (version) DO NOTHING;

-- ============================================================================
-- Create initial partitions
-- ============================================================================
-- Note: Additional partitions will be created by migration 002_partitions.sql

-- Historical partition (for any old data)
CREATE TABLE IF NOT EXISTS memory_records_historical PARTITION OF memory_records
  FOR VALUES FROM (MINVALUE) TO ('2025-01-01');

-- Monthly partitions for 2025
CREATE TABLE IF NOT EXISTS memory_records_2025_01 PARTITION OF memory_records
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE IF NOT EXISTS memory_records_2025_02 PARTITION OF memory_records
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE IF NOT EXISTS memory_records_2025_03 PARTITION OF memory_records
  FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');
CREATE TABLE IF NOT EXISTS memory_records_2025_04 PARTITION OF memory_records
  FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');
CREATE TABLE IF NOT EXISTS memory_records_2025_05 PARTITION OF memory_records
  FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');
CREATE TABLE IF NOT EXISTS memory_records_2025_06 PARTITION OF memory_records
  FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');
CREATE TABLE IF NOT EXISTS memory_records_2025_07 PARTITION OF memory_records
  FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');
CREATE TABLE IF NOT EXISTS memory_records_2025_08 PARTITION OF memory_records
  FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');
CREATE TABLE IF NOT EXISTS memory_records_2025_09 PARTITION OF memory_records
  FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');
CREATE TABLE IF NOT EXISTS memory_records_2025_10 PARTITION OF memory_records
  FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
CREATE TABLE IF NOT EXISTS memory_records_2025_11 PARTITION OF memory_records
  FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
CREATE TABLE IF NOT EXISTS memory_records_2025_12 PARTITION OF memory_records
  FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

-- Future partitions (first 3 months of 2026)
CREATE TABLE IF NOT EXISTS memory_records_2026_01 PARTITION OF memory_records
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE IF NOT EXISTS memory_records_2026_02 PARTITION OF memory_records
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE IF NOT EXISTS memory_records_2026_03 PARTITION OF memory_records
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
