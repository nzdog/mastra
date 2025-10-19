/**
 * Memory Store Interface
 * Phase 2: Memory Layer - APIs & Consent Families
 *
 * Defines the storage abstraction for memory operations.
 * Implementations can use in-memory, PostgreSQL, DynamoDB, etc.
 */

import { MemoryRecord } from '../models/memory-record';
import { RecallQuery } from '../models/operation-requests';
import { ForgetRequest } from '../models/operation-requests';

/**
 * Filter options for querying records
 */
export interface QueryFilters {
  /**
   * Hashed pseudonymous identifier
   * MUST be hashed/pseudonymous identifier, never raw PII
   */
  hashed_pseudonym?: string;
  session_id?: string;
  consent_family?: 'personal' | 'cohort' | 'population';
  since?: string; // ISO timestamp
  until?: string; // ISO timestamp
  type?: 'text' | 'structured' | 'embedding';
  limit?: number;
  offset?: number;
  sort?: 'asc' | 'desc';
}

/**
 * Memory Store Interface
 *
 * All storage implementations must implement this interface
 */
export interface MemoryStore {
  /**
   * Store a new memory record
   * @param record - The memory record to store
   * @returns Promise resolving to the stored record with generated fields
   */
  store(record: MemoryRecord): Promise<MemoryRecord>;

  /**
   * Recall (query) memory records
   * @param query - Query parameters for filtering and pagination
   * @returns Promise resolving to array of matching records
   */
  recall(query: RecallQuery): Promise<MemoryRecord[]>;

  /**
   * Forget (delete) memory records
   * @param request - Forget request with id, user_id, or session_id
   * @returns Promise resolving to array of deleted record IDs
   */
  forget(request: ForgetRequest): Promise<string[]>;

  /**
   * Count records matching filters
   * @param filters - Query filters
   * @returns Promise resolving to count of matching records
   */
  count(filters: QueryFilters): Promise<number>;

  /**
   * Get a single record by ID
   * @param id - Record ID
   * @returns Promise resolving to record or null if not found
   */
  get(id: string): Promise<MemoryRecord | null>;

  /**
   * Update a record's access count
   * @param id - Record ID
   * @returns Promise resolving to updated record or null if not found
   */
  incrementAccessCount(id: string): Promise<MemoryRecord | null>;

  /**
   * Check if a record exists
   * @param id - Record ID
   * @returns Promise resolving to true if record exists
   */
  exists(id: string): Promise<boolean>;

  /**
   * Clear expired records (TTL enforcement)
   * @returns Promise resolving to number of records deleted
   */
  clearExpired(): Promise<number>;

  /**
   * Get storage statistics
   * @returns Promise resolving to storage stats
   */
  getStats(): Promise<{
    total_records: number;
    records_by_family: Record<string, number>;
    storage_bytes: number;
  }>;

  /**
   * Clear all records (for testing)
   */
  clear(): Promise<void>;
}

/**
 * Type guard to check if object is a MemoryRecord
 */
export function isMemoryRecord(obj: unknown): obj is MemoryRecord {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const record = obj as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.hashed_pseudonym === 'string' &&
    typeof record.content === 'object' &&
    typeof record.consent_family === 'string' &&
    typeof record.consent_timestamp === 'string' &&
    typeof record.consent_version === 'string' &&
    typeof record.created_at === 'string' &&
    typeof record.updated_at === 'string' &&
    typeof record.access_count === 'number' &&
    typeof record.audit_receipt_id === 'string'
  );
}
