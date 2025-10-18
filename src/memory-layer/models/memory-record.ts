/**
 * Memory Record Data Model
 * Phase 2: Memory Layer - APIs & Consent Families
 */

/**
 * Consent family types defining data sharing boundaries
 * - personal: User-only access, hashed/pseudonymous identifiers only (no raw PII)
 * - cohort: Group-level aggregated data, no direct identifiers
 * - population: System-wide aggregated data, no direct identifiers
 */
export type ConsentFamily = 'personal' | 'cohort' | 'population';

/**
 * Content type classification for memory records
 * - text: Plain text content
 * - structured: JSON or structured data
 * - embedding: Vector embeddings for semantic search
 */
export type ContentType = 'text' | 'structured' | 'embedding';

/**
 * Content structure for memory records
 */
export interface MemoryContent {
  type: ContentType;
  data: unknown; // Could be string, object, or number[] for embeddings
  metadata?: Record<string, unknown>;
}

/**
 * Core memory record structure
 * All memory operations (store, recall, distill) work with these records
 */
export interface MemoryRecord {
  /** Unique identifier for the memory record (UUID) */
  id: string;

  /**
   * MUST be hashed/pseudonymous identifier (e.g., sha256(email+salt)), never raw PII
   * Format: 'hs_' prefix + base64url OR SHA-256 hex (64 chars)
   * NEVER use raw emails, SSNs, or other identifiable information
   */
  hashed_pseudonym: string;

  /** Session identifier for grouping related memories */
  session_id?: string;

  /** The actual memory content with type and metadata */
  content: MemoryContent;

  /** Consent family determining access and aggregation rules */
  consent_family: ConsentFamily;

  /** ISO timestamp when consent was granted */
  consent_timestamp: string;

  /** Version of consent agreement (e.g., "1.0", "2.1") */
  consent_version: string;

  /** ISO timestamp when record was created */
  created_at: string;

  /** ISO timestamp when record was last updated */
  updated_at: string;

  /** Optional ISO timestamp for automatic expiration */
  expires_at?: string;

  /** Number of times this memory has been accessed */
  access_count: number;

  /** Reference to audit receipt for governance trail */
  audit_receipt_id: string;
}

/**
 * Type guard to check if a consent family allows PII
 */
export function allowsPII(family: ConsentFamily): boolean {
  return family === 'personal';
}

/**
 * Type guard to check if a consent family requires aggregation
 */
export function requiresAggregation(family: ConsentFamily): boolean {
  return family === 'cohort' || family === 'population';
}

/**
 * Helper to create a new memory record with defaults
 */
export function createMemoryRecord(
  partial: Pick<
    MemoryRecord,
    'hashed_pseudonym' | 'content' | 'consent_family' | 'consent_timestamp' | 'consent_version'
  >
): Omit<MemoryRecord, 'id' | 'created_at' | 'updated_at' | 'audit_receipt_id'> {
  return {
    ...partial,
    access_count: 0,
  };
}
