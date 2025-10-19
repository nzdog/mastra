-- ============================================================================
-- ⚠️  DEV-ONLY: DANGEROUS MIGRATION (DROPS TABLE). DO NOT RUN IN PROD.
-- ============================================================================
-- PostgreSQL Partitioning Migration (DESTRUCTIVE)
-- Phase 3 Week 3: Postgres Hardening
--
-- ⚠️  THIS MIGRATION DROPS ALL DATA IN memory_records TABLE
-- ⚠️  Run ONLY on brand-new environments or AFTER verified backfill + cutover
-- ⚠️  DO NOT use this migration in production - use 002_partitions.sql instead
--
-- For production environments with existing data:
--   1. Use dual-write mode (PERSISTENCE=dual-write)
--   2. Run backfill script: npx ts-node scripts/backfill-to-postgres.ts
--   3. Verify data parity
--   4. Use the SAFE migration: 002_partitions.sql
--
-- This dev-only migration recreates the table as partitioned from scratch.
-- ============================================================================

-- Drop existing table and recreate as partitioned table
-- ⚠️  WARNING: This will drop all data. Run only on fresh install or after backfill.
DROP TABLE IF EXISTS memory_records CASCADE;

-- Create partitioned table by month (created_at)
CREATE TABLE memory_records (
  id UUID NOT NULL,
  hashed_pseudonym TEXT NOT NULL,
  session_id TEXT,
  content JSONB NOT NULL,
  consent_family TEXT NOT NULL CHECK (consent_family IN ('personal', 'cohort', 'population')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  access_count INTEGER NOT NULL DEFAULT 0,
  audit_receipt_id UUID NOT NULL,
  encryption_version TEXT,  -- Phase 3.2: Track encryption version (NULL = plaintext)
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create indexes on partitioned table
-- Index 1: Primary lookup by pseudonym + family + time
CREATE INDEX idx_memory_records_pseudonym_family
  ON memory_records (hashed_pseudonym, consent_family, created_at DESC);

-- Index 2: Session-based queries
CREATE INDEX idx_memory_records_session
  ON memory_records (session_id, created_at DESC)
  WHERE session_id IS NOT NULL;

-- Index 3: TTL sweep (expires_at)
CREATE INDEX idx_memory_records_expires
  ON memory_records (expires_at)
  WHERE expires_at IS NOT NULL;

-- Index 4: Audit trail linking
CREATE INDEX idx_memory_records_audit
  ON memory_records (audit_receipt_id);

-- ============================================================================
-- Create monthly partitions for current/future months
-- Phase 3.2: Updated to include current month (October 2025) onwards
-- ============================================================================

-- October 2025 (current)
CREATE TABLE memory_records_2025_10 PARTITION OF memory_records
  FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');

-- November 2025
CREATE TABLE memory_records_2025_11 PARTITION OF memory_records
  FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

-- December 2025
CREATE TABLE memory_records_2025_12 PARTITION OF memory_records
  FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

-- January 2026
CREATE TABLE memory_records_2026_01 PARTITION OF memory_records
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

-- February 2026
CREATE TABLE memory_records_2026_02 PARTITION OF memory_records
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

-- March 2026
CREATE TABLE memory_records_2026_03 PARTITION OF memory_records
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

-- April 2026
CREATE TABLE memory_records_2026_04 PARTITION OF memory_records
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

-- ============================================================================
-- Helper function to create new partitions automatically
-- ============================================================================

CREATE OR REPLACE FUNCTION create_monthly_partition(target_date DATE)
RETURNS TEXT AS $$
DECLARE
  partition_name TEXT;
  start_date DATE;
  end_date DATE;
BEGIN
  -- Calculate partition boundaries
  start_date := DATE_TRUNC('month', target_date);
  end_date := start_date + INTERVAL '1 month';

  -- Generate partition name
  partition_name := 'memory_records_' || TO_CHAR(start_date, 'YYYY_MM');

  -- Create partition if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = partition_name
  ) THEN
    EXECUTE format(
      'CREATE TABLE %I PARTITION OF memory_records FOR VALUES FROM (%L) TO (%L)',
      partition_name,
      start_date,
      end_date
    );
    RETURN 'Created partition: ' || partition_name;
  ELSE
    RETURN 'Partition already exists: ' || partition_name;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Partition maintenance notes
-- ============================================================================

-- To create next month's partition:
-- SELECT create_monthly_partition(NOW() + INTERVAL '1 month');

-- To list all partitions:
-- SELECT tablename FROM pg_tables WHERE tablename LIKE 'memory_records_%' ORDER BY tablename;

-- To drop old partitions (e.g., older than 6 months):
-- DROP TABLE memory_records_2025_05; -- Will also remove data

-- To detach partition before dropping (preserves data):
-- ALTER TABLE memory_records DETACH PARTITION memory_records_2025_05;

COMMENT ON TABLE memory_records IS 'Phase 3: Partitioned memory records by month for scalability';
COMMENT ON FUNCTION create_monthly_partition IS 'Helper to create new monthly partition';
