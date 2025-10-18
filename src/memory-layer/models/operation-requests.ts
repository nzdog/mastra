/**
 * Operation Request Models
 * Phase 2: Memory Layer - APIs & Consent Families
 *
 * Request structures for all memory operations:
 * - Store: Save new memories
 * - Recall: Retrieve personal memories
 * - Distill: Aggregate cohort/population data
 * - Forget: Delete memories (right to be forgotten)
 * - Export: Export user data (GDPR compliance)
 */

import { MemoryContent, ConsentFamily } from './memory-record';

/**
 * Request to store a new memory
 * Used for POST /memory/store
 */
export interface StoreRequest {
  /** Memory content with type and data */
  content: MemoryContent;

  /**
   * Metadata for the memory record (REQUIRED)
   * Phase 3.2: Made required to align with schema
   */
  metadata: {
    /**
     * Hashed pseudonymous identifier (required for personal consent)
     * MUST be hashed/pseudonymous identifier (e.g., sha256(email+salt)), never raw PII
     */
    hashed_pseudonym: string;

    /** Optional session identifier for grouping */
    session_id?: string;

    /**
     * Consent family for this memory
     * Phase 3.2: Restricted to enum values only
     */
    consent_family: 'personal' | 'cohort' | 'population';

    /** ISO timestamp when consent was granted */
    consent_timestamp: string;

    /** Version of consent agreement */
    consent_version: string;

    /** Any additional custom metadata */
    [key: string]: unknown;
  };

  /** Optional ISO timestamp for automatic expiration */
  expires_at?: string;
}

/**
 * Query parameters for recalling memories
 * Used for GET /memory/recall
 */
export interface RecallQuery {
  /**
   * Hashed pseudonymous identifier (required for personal memories)
   * MUST be hashed/pseudonymous identifier (e.g., sha256(email+salt)), never raw PII
   */
  hashed_pseudonym: string;

  /** Optional session filter */
  session_id?: string;

  /** Filter memories created after this ISO timestamp */
  since?: string;

  /** Filter memories created before this ISO timestamp */
  until?: string;

  /** Filter by content type */
  type?: 'text' | 'structured' | 'embedding';

  /** Maximum number of results to return (default: 100) */
  limit?: number;

  /** Pagination offset (default: 0) - DEPRECATED: Use cursor instead for large datasets */
  offset?: number;

  /** Cursor-based pagination token (recommended for large datasets) */
  cursor?: string;

  /** Sort order: 'asc' or 'desc' by created_at (default: 'desc') */
  sort?: 'asc' | 'desc';
}

/**
 * Aggregation types for distillation
 */
export type AggregationType = 'count' | 'average' | 'sum' | 'min' | 'max' | 'distribution';

/**
 * Request to distill aggregated data from cohort or population
 * Used for POST /memory/distill
 */
export interface DistillRequest {
  /** Cohort identifier (required for cohort-level distillation) */
  cohort_id?: string;

  /** Type of aggregation to perform */
  aggregation: {
    /** Aggregation operation type */
    type: AggregationType;

    /** Field to aggregate on (for structured content) */
    field?: string;

    /** Time bucket for temporal aggregation (e.g., 'hour', 'day', 'week') */
    time_bucket?: 'hour' | 'day' | 'week' | 'month';
  };

  /** Optional filters for distillation query */
  filters?: {
    /** Filter by content type */
    content_type?: 'text' | 'structured' | 'embedding';

    /** Filter by consent family */
    consent_family?: 'cohort' | 'population';

    /** Filter by time range */
    since?: string;
    until?: string;

    /** Additional custom filters */
    [key: string]: unknown;
  };

  /** Minimum privacy threshold (minimum records required for aggregation) */
  min_records?: number;
}

/**
 * Request to forget (delete) memories
 * Used for DELETE /memory/forget
 * Supports GDPR right to be forgotten
 */
export interface ForgetRequest {
  /** Specific memory record ID to delete */
  id?: string;

  /**
   * Delete all memories for a hashed pseudonymous identifier
   * MUST be hashed/pseudonymous identifier (e.g., sha256(email+salt)), never raw PII
   */
  hashed_pseudonym?: string;

  /** Delete all memories for a session */
  session_id?: string;

  /** Reason for deletion (for audit trail) */
  reason?: string;

  /** Whether to perform hard delete (default: soft delete) */
  hard_delete?: boolean;
}

/**
 * Request to export user data
 * Used for POST /memory/export
 * Supports GDPR data portability
 */
export interface ExportRequest {
  /**
   * Hashed pseudonymous identifier for export
   * MUST be hashed/pseudonymous identifier (e.g., sha256(email+salt)), never raw PII
   */
  hashed_pseudonym: string;

  /** Export format */
  format: 'json' | 'csv' | 'jsonlines';

  /** Optional filters for export */
  filters?: {
    /** Include only specific consent families */
    consent_families?: ConsentFamily[];

    /** Time range filter */
    since?: string;
    until?: string;

    /** Include deleted records */
    include_deleted?: boolean;
  };

  /** Whether to include audit trail */
  include_audit?: boolean;
}

/**
 * Validation helper for StoreRequest
 */
export function validateStoreRequest(req: unknown): req is StoreRequest {
  if (typeof req !== 'object' || req === null) {
    return false;
  }
  const r = req as StoreRequest;
  return (
    r.content !== undefined &&
    typeof r.content === 'object' &&
    r.metadata !== undefined &&
    typeof r.metadata === 'object' &&
    typeof r.metadata.hashed_pseudonym === 'string' &&
    typeof r.metadata.consent_family === 'string' &&
    typeof r.metadata.consent_timestamp === 'string' &&
    typeof r.metadata.consent_version === 'string'
  );
}

/**
 * Validation helper for RecallQuery
 */
export function validateRecallQuery(query: unknown): query is RecallQuery {
  if (typeof query !== 'object' || query === null) {
    return false;
  }
  const q = query as RecallQuery;
  return typeof q.hashed_pseudonym === 'string';
}

/**
 * Validation helper for ForgetRequest
 */
export function validateForgetRequest(req: unknown): req is ForgetRequest {
  if (typeof req !== 'object' || req === null) {
    return false;
  }
  const r = req as ForgetRequest;
  // At least one identifier must be provided
  return r.id !== undefined || r.hashed_pseudonym !== undefined || r.session_id !== undefined;
}
