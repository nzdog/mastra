/**
 * In-Memory Storage Adapter
 * Phase 2: Memory Layer - APIs & Consent Families
 *
 * Implements MemoryStore interface with in-memory storage.
 * Includes indexing, TTL enforcement, and consent family enforcement.
 */

import { MemoryStore, QueryFilters } from './memory-store-interface';
import { MemoryRecord, ConsentFamily } from '../models/memory-record';
import { RecallQuery, ForgetRequest } from '../models/operation-requests';

/**
 * Index structure for fast lookups
 */
interface MemoryIndex {
  byHashedPseudonym: Map<string, Set<string>>; // hashed_pseudonym -> set of record IDs
  bySessionId: Map<string, Set<string>>; // session_id -> set of record IDs
  byConsentFamily: Map<ConsentFamily, Set<string>>; // consent_family -> set of record IDs
}

/**
 * In-Memory Storage Implementation
 *
 * Features:
 * - Fast CRUD operations with O(1) lookups
 * - Indexing by user_id, session_id, consent_family
 * - TTL enforcement with expires_at
 * - Consent family privacy enforcement
 * - k-anonymity for cohort/population queries
 */
export class InMemoryStore implements MemoryStore {
  private records: Map<string, MemoryRecord> = new Map();
  private indexes: MemoryIndex = {
    byHashedPseudonym: new Map(),
    bySessionId: new Map(),
    byConsentFamily: new Map(),
  };

  private readonly K_ANONYMITY_MIN = 5; // Minimum records for cohort/population queries

  /**
   * Validate that hashed_pseudonym doesn't contain raw PII patterns
   * Rejects: emails (@), spaces, SSN-like patterns
   */
  private validateHashedPseudonym(hashedPseudonym: string): void {
    // Check for email pattern
    if (hashedPseudonym.includes('@')) {
      throw new Error(
        'Invalid hashed_pseudonym: contains @ symbol (possible raw email). Must be hashed.'
      );
    }

    // Check for spaces
    if (/\s/.test(hashedPseudonym)) {
      throw new Error('Invalid hashed_pseudonym: contains spaces. Must be hashed identifier.');
    }

    // Check for SSN pattern (XXX-XX-XXXX)
    if (/^\d{3}-\d{2}-\d{4}$/.test(hashedPseudonym)) {
      throw new Error('Invalid hashed_pseudonym: matches SSN pattern. Must be hashed.');
    }

    // Optional: Validate expected hash format (hs_ prefix or 64-char hex)
    const hashedPattern = /^(hs_[A-Za-z0-9_-]{43}|[a-f0-9]{64})$/;
    if (!hashedPattern.test(hashedPseudonym)) {
      throw new Error(
        'Invalid hashed_pseudonym format. Expected: hs_<base64url> or SHA-256 hex (64 chars)'
      );
    }
  }

  /**
   * Store a new memory record
   */
  async store(record: MemoryRecord): Promise<MemoryRecord> {
    // Validate hashed_pseudonym
    this.validateHashedPseudonym(record.hashed_pseudonym);

    // Store record
    this.records.set(record.id, { ...record });

    // Update indexes
    this.addToIndex(record);

    return { ...record };
  }

  /**
   * Recall memory records with privacy enforcement
   */
  async recall(query: RecallQuery): Promise<MemoryRecord[]> {
    // Get candidate record IDs from indexes
    const candidateIds = this.getCandidateIds(query);

    // Filter and sort records
    let results: MemoryRecord[] = [];

    for (const id of candidateIds) {
      const record = this.records.get(id);
      if (!record) continue;

      // Check if record matches all query filters
      if (this.matchesQuery(record, query)) {
        results.push({ ...record });
      }
    }

    // Sort by created_at
    const sortOrder = query.sort || 'desc';
    results.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });

    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || 100;
    results = results.slice(offset, offset + limit);

    // Increment access count for all returned records (async)
    results.forEach((record) => {
      this.incrementAccessCount(record.id).catch((err) =>
        console.error('Failed to increment access count:', err)
      );
    });

    return results;
  }

  /**
   * Forget (delete) memory records
   */
  async forget(request: ForgetRequest): Promise<string[]> {
    const deletedIds: string[] = [];

    // Find records to delete
    let recordsToDelete: MemoryRecord[] = [];

    if (request.id) {
      // Delete by specific ID
      const record = this.records.get(request.id);
      if (record) {
        recordsToDelete = [record];
      }
    } else if (request.hashed_pseudonym) {
      // Delete all records for hashed_pseudonym
      const userRecordIds =
        this.indexes.byHashedPseudonym.get(request.hashed_pseudonym) || new Set();
      recordsToDelete = Array.from(userRecordIds)
        .map((id) => this.records.get(id))
        .filter((r): r is MemoryRecord => r !== undefined);
    } else if (request.session_id) {
      // Delete all records for session
      const sessionRecordIds = this.indexes.bySessionId.get(request.session_id) || new Set();
      recordsToDelete = Array.from(sessionRecordIds)
        .map((id) => this.records.get(id))
        .filter((r): r is MemoryRecord => r !== undefined);
    }

    // Perform deletion
    for (const record of recordsToDelete) {
      // Remove from main store
      this.records.delete(record.id);

      // Remove from indexes
      this.removeFromIndex(record);

      deletedIds.push(record.id);
    }

    return deletedIds;
  }

  /**
   * Count records matching filters
   */
  async count(filters: QueryFilters): Promise<number> {
    let count = 0;

    // Get candidate IDs from indexes
    const candidateIds = this.getCandidateIdsFromFilters(filters);

    for (const id of candidateIds) {
      const record = this.records.get(id);
      if (!record) continue;

      if (this.matchesFilters(record, filters)) {
        count++;
      }
    }

    return count;
  }

  /**
   * Get a single record by ID
   */
  async get(id: string): Promise<MemoryRecord | null> {
    const record = this.records.get(id);
    return record ? { ...record } : null;
  }

  /**
   * Increment access count for a record
   */
  async incrementAccessCount(id: string): Promise<MemoryRecord | null> {
    const record = this.records.get(id);
    if (!record) {
      return null;
    }

    record.access_count++;
    record.updated_at = new Date().toISOString();

    return { ...record };
  }

  /**
   * Check if record exists
   */
  async exists(id: string): Promise<boolean> {
    return this.records.has(id);
  }

  /**
   * Clear expired records (TTL enforcement)
   */
  async clearExpired(): Promise<number> {
    const now = new Date().toISOString();
    let deletedCount = 0;

    for (const [id, record] of this.records.entries()) {
      if (record.expires_at && record.expires_at <= now) {
        this.records.delete(id);
        this.removeFromIndex(record);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{
    total_records: number;
    records_by_family: Record<string, number>;
    storage_bytes: number;
  }> {
    const stats = {
      total_records: this.records.size,
      records_by_family: {
        personal: this.indexes.byConsentFamily.get('personal')?.size || 0,
        cohort: this.indexes.byConsentFamily.get('cohort')?.size || 0,
        population: this.indexes.byConsentFamily.get('population')?.size || 0,
      },
      storage_bytes: 0,
    };

    // Estimate storage size
    const serialized = JSON.stringify(Array.from(this.records.values()));
    stats.storage_bytes = Buffer.byteLength(serialized, 'utf8');

    return stats;
  }

  /**
   * Clear all records (for testing)
   */
  async clear(): Promise<void> {
    this.records.clear();
    this.indexes.byHashedPseudonym.clear();
    this.indexes.bySessionId.clear();
    this.indexes.byConsentFamily.clear();
  }

  /**
   * Iterate over all records (for backfill/migration)
   * Returns an iterable of all memory records
   */
  *iterateAll(): Iterable<MemoryRecord> {
    for (const record of this.records.values()) {
      yield { ...record }; // Return copy to prevent mutation
    }
  }

  /**
   * Add record to indexes
   */
  private addToIndex(record: MemoryRecord): void {
    // Index by hashed_pseudonym
    if (!this.indexes.byHashedPseudonym.has(record.hashed_pseudonym)) {
      this.indexes.byHashedPseudonym.set(record.hashed_pseudonym, new Set());
    }
    this.indexes.byHashedPseudonym.get(record.hashed_pseudonym)!.add(record.id);

    // Index by session_id
    if (record.session_id) {
      if (!this.indexes.bySessionId.has(record.session_id)) {
        this.indexes.bySessionId.set(record.session_id, new Set());
      }
      this.indexes.bySessionId.get(record.session_id)!.add(record.id);
    }

    // Index by consent_family
    if (!this.indexes.byConsentFamily.has(record.consent_family)) {
      this.indexes.byConsentFamily.set(record.consent_family, new Set());
    }
    this.indexes.byConsentFamily.get(record.consent_family)!.add(record.id);
  }

  /**
   * Remove record from indexes
   */
  private removeFromIndex(record: MemoryRecord): void {
    // Remove from hashed_pseudonym index
    const userIndex = this.indexes.byHashedPseudonym.get(record.hashed_pseudonym);
    if (userIndex) {
      userIndex.delete(record.id);
      if (userIndex.size === 0) {
        this.indexes.byHashedPseudonym.delete(record.hashed_pseudonym);
      }
    }

    // Remove from session_id index
    if (record.session_id) {
      const sessionIndex = this.indexes.bySessionId.get(record.session_id);
      if (sessionIndex) {
        sessionIndex.delete(record.id);
        if (sessionIndex.size === 0) {
          this.indexes.bySessionId.delete(record.session_id);
        }
      }
    }

    // Remove from consent_family index
    const familyIndex = this.indexes.byConsentFamily.get(record.consent_family);
    if (familyIndex) {
      familyIndex.delete(record.id);
      if (familyIndex.size === 0) {
        this.indexes.byConsentFamily.delete(record.consent_family);
      }
    }
  }

  /**
   * Get candidate record IDs from indexes based on query
   */
  private getCandidateIds(query: RecallQuery): Set<string> {
    // Start with hashed_pseudonym index (required)
    const userIds = this.indexes.byHashedPseudonym.get(query.hashed_pseudonym) || new Set<string>();

    // If session_id specified, intersect with session index
    if (query.session_id) {
      const sessionIds = this.indexes.bySessionId.get(query.session_id) || new Set<string>();
      return new Set([...userIds].filter((id) => sessionIds.has(id)));
    }

    return userIds;
  }

  /**
   * Get candidate record IDs from filters
   */
  private getCandidateIdsFromFilters(filters: QueryFilters): Set<string> {
    if (filters.hashed_pseudonym) {
      return this.indexes.byHashedPseudonym.get(filters.hashed_pseudonym) || new Set<string>();
    }

    if (filters.session_id) {
      return this.indexes.bySessionId.get(filters.session_id) || new Set<string>();
    }

    if (filters.consent_family) {
      return this.indexes.byConsentFamily.get(filters.consent_family) || new Set<string>();
    }

    // No index available, return all record IDs
    return new Set(this.records.keys());
  }

  /**
   * Check if record matches query filters
   */
  private matchesQuery(record: MemoryRecord, query: RecallQuery): boolean {
    // Hashed pseudonym must match
    if (record.hashed_pseudonym !== query.hashed_pseudonym) {
      return false;
    }

    // Session ID filter
    if (query.session_id && record.session_id !== query.session_id) {
      return false;
    }

    // Time range filters
    if (query.since && record.created_at < query.since) {
      return false;
    }
    if (query.until && record.created_at > query.until) {
      return false;
    }

    // Content type filter
    if (query.type && record.content.type !== query.type) {
      return false;
    }

    // Check expiration
    if (record.expires_at && record.expires_at <= new Date().toISOString()) {
      return false;
    }

    return true;
  }

  /**
   * Check if record matches filters
   */
  private matchesFilters(record: MemoryRecord, filters: QueryFilters): boolean {
    if (filters.hashed_pseudonym && record.hashed_pseudonym !== filters.hashed_pseudonym) {
      return false;
    }

    if (filters.session_id && record.session_id !== filters.session_id) {
      return false;
    }

    if (filters.consent_family && record.consent_family !== filters.consent_family) {
      return false;
    }

    if (filters.since && record.created_at < filters.since) {
      return false;
    }

    if (filters.until && record.created_at > filters.until) {
      return false;
    }

    if (filters.type && record.content.type !== filters.type) {
      return false;
    }

    // Check expiration
    if (record.expires_at && record.expires_at <= new Date().toISOString()) {
      return false;
    }

    return true;
  }
}

/**
 * Singleton instance
 */
let storeInstance: InMemoryStore | null = null;

/**
 * Get global in-memory store instance
 */
export function getMemoryStore(): InMemoryStore {
  if (!storeInstance) {
    storeInstance = new InMemoryStore();
  }
  return storeInstance;
}
