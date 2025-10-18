-- =====================================================================
-- SAFE PRODUCTION MIGRATION
-- Migration 003: Add encryption_version column
-- =====================================================================
--
-- Purpose: Track which records are encrypted to prevent data loss when
--          ENCRYPTION_ENABLED toggles between true/false.
--
-- Behavior:
--   - Adds nullable encryption_version column (default NULL for plaintext)
--   - Idempotent: Uses IF NOT EXISTS for safety
--   - Zero-downtime: Does not require table locks or data migration
--
-- Usage:
--   psql -U postgres -d lichen_memory -f migrations/003_add_encryption_version.sql
--
-- Rollback:
--   ALTER TABLE memory_records DROP COLUMN IF EXISTS encryption_version;
--
-- =====================================================================

-- Add encryption_version column to track encryption state per record
ALTER TABLE memory_records
ADD COLUMN IF NOT EXISTS encryption_version TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN memory_records.encryption_version IS
  'Encryption version identifier (e.g., "v1"). NULL indicates plaintext (unencrypted).';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Migration 003 complete: encryption_version column added';
END $$;
