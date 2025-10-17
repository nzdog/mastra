/**
 * Operation Response Models
 * Phase 2: Memory Layer - APIs & Consent Families
 *
 * Response structures for all memory operations.
 * All responses include audit_receipt_id for governance trail.
 */

import { MemoryRecord } from './memory-record';

/**
 * Base response interface with audit trail
 * All operation responses extend this to ensure audit tracking
 */
export interface BaseResponse {
  /** Audit receipt ID for governance trail */
  audit_receipt_id: string;

  /** ISO timestamp of the operation */
  timestamp: string;
}

/**
 * Response for store operation
 * POST /memory/store
 */
export interface StoreResponse extends BaseResponse {
  /** ID of the newly created memory record */
  id: string;

  /**
   * Hashed pseudonymous identifier associated with the memory
   * MUST be hashed/pseudonymous identifier, never raw PII
   */
  hashed_pseudonym: string;

  /** Session ID if provided */
  session_id?: string;

  /** Consent family of the stored memory */
  consent_family: string;

  /** ISO timestamp when the record was created */
  created_at: string;

  /** Optional expiration timestamp */
  expires_at?: string;
}

/**
 * Response for recall operation
 * GET /memory/recall
 */
export interface RecallResponse extends BaseResponse {
  /** Array of retrieved memory records */
  records: MemoryRecord[];

  /** Pagination metadata */
  pagination: {
    /** Total number of records matching the query */
    total: number;

    /** Number of records returned in this response */
    count: number;

    /** Current offset */
    offset: number;

    /** Limit used for this query */
    limit: number;

    /** Whether there are more records available */
    has_more: boolean;
  };

  /** Query metadata */
  query: {
    /**
     * Hashed pseudonymous identifier used for the query
     * MUST be hashed/pseudonymous identifier, never raw PII
     */
    hashed_pseudonym: string;

    /** Session ID filter if applied */
    session_id?: string;

    /** Time range filters */
    since?: string;
    until?: string;
  };
}

/**
 * Aggregated result from distillation
 */
export interface AggregationResult {
  /** Type of aggregation performed */
  type: string;

  /** Aggregated value(s) */
  value: number | Record<string, number>;

  /** Number of records included in aggregation */
  record_count: number;

  /** Time bucket if temporal aggregation was used */
  time_bucket?: string;

  /** Timestamp for this aggregation bucket */
  bucket_timestamp?: string;
}

/**
 * Response for distill operation
 * POST /memory/distill
 */
export interface DistillResponse extends BaseResponse {
  /** Cohort ID if cohort-level distillation */
  cohort_id?: string;

  /** Consent family level of distillation */
  consent_family: 'cohort' | 'population';

  /** Array of aggregation results */
  results: AggregationResult[];

  /** Metadata about the distillation */
  metadata: {
    /** Total number of records considered */
    total_records: number;

    /** Number of records that passed filters */
    filtered_records: number;

    /** Whether minimum privacy threshold was met */
    privacy_threshold_met: boolean;

    /** Minimum records threshold used */
    min_records: number;

    /** Time range of data */
    time_range?: {
      start: string;
      end: string;
    };
  };
}

/**
 * Response for forget operation
 * DELETE /memory/forget
 */
export interface ForgetResponse extends BaseResponse {
  /** Number of records deleted */
  deleted_count: number;

  /** IDs of deleted records */
  deleted_ids: string[];

  /** Whether this was a hard delete */
  hard_delete: boolean;

  /** Deletion metadata */
  metadata: {
    /**
     * Hashed pseudonymous identifier if user-level deletion
     * MUST be hashed/pseudonymous identifier, never raw PII
     */
    hashed_pseudonym?: string;

    /** Session ID if session-level deletion */
    session_id?: string;

    /** Reason for deletion */
    reason?: string;
  };
}

/**
 * Export format metadata
 */
export interface ExportMetadata {
  /**
   * Hashed pseudonymous identifier for the export
   * MUST be hashed/pseudonymous identifier, never raw PII
   */
  hashed_pseudonym: string;

  /** Export format */
  format: 'json' | 'csv' | 'jsonlines';

  /** Number of records exported */
  record_count: number;

  /** Size of export in bytes */
  size_bytes: number;

  /** Time range of exported data */
  time_range: {
    start: string;
    end: string;
  };

  /** Consent families included */
  consent_families: string[];

  /** Whether deleted records were included */
  includes_deleted: boolean;

  /** Whether audit trail was included */
  includes_audit: boolean;
}

/**
 * Response for export operation
 * POST /memory/export
 */
export interface ExportResponse extends BaseResponse {
  /** URL or reference to download the export */
  export_url?: string;

  /** Inline export data (for small exports) */
  data?: unknown;

  /** Export metadata */
  metadata: ExportMetadata;

  /** Expiration time for the export URL */
  expires_at?: string;
}

/**
 * Helper to create a base response with audit trail
 */
export function createBaseResponse(audit_receipt_id: string): BaseResponse {
  return {
    audit_receipt_id,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Helper to create pagination metadata
 */
export function createPaginationMetadata(
  total: number,
  count: number,
  offset: number,
  limit: number
): RecallResponse['pagination'] {
  return {
    total,
    count,
    offset,
    limit,
    has_more: offset + count < total,
  };
}

/**
 * Type guard for StoreResponse
 */
export function isStoreResponse(obj: unknown): obj is StoreResponse {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'audit_receipt_id' in obj &&
    'timestamp' in obj
  );
}

/**
 * Type guard for RecallResponse
 */
export function isRecallResponse(obj: unknown): obj is RecallResponse {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'records' in obj &&
    'pagination' in obj &&
    'audit_receipt_id' in obj
  );
}
