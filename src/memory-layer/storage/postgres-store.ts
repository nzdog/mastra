/**
 * PostgreSQL Storage Adapter
 * Phase 3: Privacy, Security & Governance
 *
 * Implements MemoryStore interface backed by PostgreSQL.
 * Week 1 scope: store, recall, count only (no encryption yet).
 * Week 3: Added envelope encryption support.
 * Other methods stubbed with TODO Phase 3.
 */

import { Pool, PoolClient } from 'pg';
import { MemoryRecord } from '../models/memory-record';
import { RecallQuery, ForgetRequest } from '../models/operation-requests';
import { MemoryStore, QueryFilters } from './memory-store-interface';
import { getEncryptionService } from '../security/encryption-service';
import { isEncryptionEnabled } from './adapter-selector';
import {
  cryptoEncryptFailuresTotal,
  cryptoDecryptFailuresTotal,
  cryptoOpsDuration,
  postgresPoolErrorsTotal,
} from '../../observability/metrics';

// Query and performance constants
const MAX_QUERY_LIMIT = 10000; // Maximum LIMIT for queries (prevent DoS)
const MAX_QUERY_OFFSET = 100000; // Maximum OFFSET for queries (performance guard)
const BATCH_DECRYPT_CONCURRENCY = 10; // Bounded concurrency for decryption

/**
 * PostgreSQL configuration from environment
 */
interface PostgresConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
  max: number; // Pool size
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

/**
 * Database row structure from memory_records table
 * Maps exactly to the PostgreSQL schema for type safety
 */
interface PostgresRow {
  id: string;
  hashed_pseudonym: string;
  session_id: string | null;
  content: string | object; // JSONB column (parsed as object by pg)
  consent_family: string;
  consent_timestamp: string;
  consent_version: string;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  access_count: number;
  audit_receipt_id: string;
  encryption_version: string | null;
}

/**
 * Load Postgres config from environment variables
 */
function loadConfig(): PostgresConfig {
  return {
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432', 10),
    database: process.env.PGDATABASE || 'lichen_memory',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || '',
    ssl: process.env.PGSSL === 'true',
    max: 20, // Connection pool size
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };
}

/**
 * PostgreSQL implementation of MemoryStore
 */
export class PostgresStore implements MemoryStore {
  private pool: Pool;
  private consecutivePoolErrors = 0;
  private readonly MAX_POOL_ERRORS = 5;
  private readonly CIRCUIT_BREAKER_RESET_MS = 10000; // 10 seconds
  private circuitBreakerTripped = false;
  private pgConfig: PostgresConfig;

  constructor(config?: PostgresConfig) {
    this.pgConfig = config || loadConfig();
    this.pool = new Pool(this.pgConfig);

    // Handle pool errors with circuit breaker
    this.pool.on('error', async (err: any) => {
      this.consecutivePoolErrors++;
      postgresPoolErrorsTotal.inc({ error_type: err.code || err.name || 'unknown' });

      console.error(
        `[PostgresStore] Unexpected pool error (${this.consecutivePoolErrors}/${this.MAX_POOL_ERRORS}):`,
        err.message
      );

      // Circuit breaker: trip after MAX_POOL_ERRORS consecutive errors
      if (this.consecutivePoolErrors >= this.MAX_POOL_ERRORS && !this.circuitBreakerTripped) {
        this.circuitBreakerTripped = true;
        console.error('[PostgresStore] Circuit breaker tripped. Pausing connections for 10s.');

        // Close pool (use stored config for recovery)
        await this.pool
          .end()
          .catch((endErr) => console.error('[PostgresStore] Error closing pool:', endErr));

        // Reset after delay
        setTimeout(async () => {
          try {
            console.log('[PostgresStore] Circuit breaker reset. Reinitializing pool.');
            this.pool = new Pool(this.pgConfig);
            this.consecutivePoolErrors = 0;
            this.circuitBreakerTripped = false;
          } catch (e) {
            console.error('[PostgresStore] Failed to reinitialize pool:', e);
            // Keep breaker tripped; will retry on next reset interval or health check
          }
        }, this.CIRCUIT_BREAKER_RESET_MS);
      }
    });

    // Reset error counter on successful connection
    this.pool.on('connect', () => {
      if (this.consecutivePoolErrors > 0) {
        console.log('[PostgresStore] Connection restored. Resetting error counter.');
        this.consecutivePoolErrors = 0;
      }
    });
  }

  /**
   * Check circuit breaker status before pool operations
   * Throws error if breaker is open (tripped)
   * @private
   */
  private checkCircuitBreaker(): void {
    if (this.circuitBreakerTripped) {
      throw new Error('Circuit breaker open - database temporarily unavailable');
    }
  }

  /**
   * Store a new memory record
   * Week 3: Added envelope encryption support
   */
  async store(record: MemoryRecord): Promise<MemoryRecord> {
    this.checkCircuitBreaker();

    // Input validation (before touching the pool)
    if (!record.id) {
      throw new Error('Invalid MemoryRecord: id is required');
    }
    if (!record.hashed_pseudonym) {
      throw new Error('Invalid MemoryRecord: hashed_pseudonym is required');
    }
    if (!record.content) {
      throw new Error('Invalid MemoryRecord: content is required');
    }
    if (!record.content.type) {
      throw new Error('Invalid MemoryRecord: content.type is required');
    }
    if (!record.consent_family) {
      throw new Error('Invalid MemoryRecord: consent_family is required');
    }
    const validConsentFamilies = ['personal', 'cohort', 'population'];
    if (!validConsentFamilies.includes(record.consent_family)) {
      throw new Error(
        `Invalid MemoryRecord: consent_family must be one of [${validConsentFamilies.join(', ')}], got '${record.consent_family}'`
      );
    }

    const client = await this.pool.connect();
    try {
      // Week 3: Encrypt content before storing if enabled
      let contentToStore: any = record.content;
      let encryptionVersion: string | null = null;

      if (isEncryptionEnabled()) {
        const encryptStart = Date.now();
        try {
          const encryptionService = getEncryptionService();
          const plaintext = Buffer.from(JSON.stringify(record.content.data));
          const encrypted = await encryptionService.encrypt(plaintext); // Uses current KEK

          // Storage-layer encrypted content structure (not in MemoryContent interface)
          contentToStore = {
            data_ciphertext: encrypted.data_ciphertext,
            dek_ciphertext: encrypted.dek_ciphertext,
            dek_kid: encrypted.dek_kid,
            encryption_version: encrypted.encryption_version,
            auth_tag: encrypted.auth_tag,
            iv: encrypted.iv,
            type: record.content.type, // Preserve metadata
          };

          encryptionVersion = encrypted.encryption_version;
          cryptoOpsDuration.observe({ op: 'encrypt' }, Date.now() - encryptStart);
        } catch (err) {
          cryptoEncryptFailuresTotal.inc({ reason: 'encryption_failed' });
          // Redacted: No PII/content in logs, only record ID and error type
          console.error(
            `[PostgresStore] Encryption failed for record (id=${record.id}, reason=${(err as Error).name || 'unknown'})`
          );
          throw new Error('Failed to encrypt record');
        }
      }

      const query = `
        INSERT INTO memory_records (
          id, hashed_pseudonym, session_id, content,
          consent_family, consent_timestamp, consent_version,
          created_at, updated_at, expires_at, access_count, audit_receipt_id, encryption_version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (id) DO UPDATE SET
          updated_at = EXCLUDED.updated_at,
          content = EXCLUDED.content,
          access_count = EXCLUDED.access_count,
          encryption_version = EXCLUDED.encryption_version
        RETURNING *
      `;

      const values = [
        record.id,
        record.hashed_pseudonym,
        record.session_id || null,
        JSON.stringify(contentToStore),
        record.consent_family,
        record.consent_timestamp,
        record.consent_version,
        record.created_at,
        record.updated_at,
        record.expires_at || null,
        record.access_count,
        record.audit_receipt_id,
        encryptionVersion,
      ];

      const result = await client.query(query, values);
      return await this.rowToRecord(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * Recall (query) memory records with filters
   * Week 3: Added decryption support
   */
  async recall(query: RecallQuery): Promise<MemoryRecord[]> {
    this.checkCircuitBreaker();
    const client = await this.pool.connect();
    try {
      const conditions: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      // Required: hashed_pseudonym
      if (query.hashed_pseudonym) {
        conditions.push(`hashed_pseudonym = $${paramIndex++}`);
        values.push(query.hashed_pseudonym);
      }

      // Optional filters
      if (query.session_id) {
        conditions.push(`session_id = $${paramIndex++}`);
        values.push(query.session_id);
      }

      if (query.since) {
        conditions.push(`created_at >= $${paramIndex++}`);
        values.push(query.since);
      }

      if (query.until) {
        conditions.push(`created_at <= $${paramIndex++}`);
        values.push(query.until);
      }

      if (query.type) {
        conditions.push(`content->>'type' = $${paramIndex++}`);
        values.push(query.type);
      }

      // Expiration filter (exclude expired records)
      conditions.push(`(expires_at IS NULL OR expires_at > NOW())`);

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const sortOrder = query.sort === 'asc' ? 'ASC' : 'DESC';

      // Cap LIMIT and OFFSET to prevent performance issues and DoS
      const limit = Math.min(query.limit || 100, MAX_QUERY_LIMIT);
      const offset = Math.min(query.offset || 0, MAX_QUERY_OFFSET);

      // TODO: Implement cursor-based pagination for large offsets (>10k records)
      // Current OFFSET approach degrades performance linearly with offset size
      if ((query.offset || 0) > 10000) {
        console.warn(
          `[PostgresStore] Large OFFSET detected (${query.offset}). Consider cursor-based pagination for better performance.`
        );
      }

      const sql = `
        SELECT * FROM memory_records
        ${whereClause}
        ORDER BY created_at ${sortOrder}
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;

      values.push(limit, offset);

      const result = await client.query(sql, values);

      // Batch decryption with bounded concurrency to avoid memory spikes
      return this.batchRowsToRecords(result.rows);
    } finally {
      client.release();
    }
  }

  /**
   * Count records matching filters
   *
   * Returns the number of non-expired records matching the given filters.
   * Automatically excludes expired records (expires_at <= NOW()).
   *
   * @param filters - Query filters (hashed_pseudonym, session_id, consent_family, etc.)
   * @returns Count of matching records
   *
   * @example
   * const count = await store.count({ hashed_pseudonym: 'abc123' });
   * console.log(`User has ${count} active memories`);
   */
  async count(filters: QueryFilters): Promise<number> {
    this.checkCircuitBreaker();
    const client = await this.pool.connect();
    try {
      const conditions: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (filters.hashed_pseudonym) {
        conditions.push(`hashed_pseudonym = $${paramIndex++}`);
        values.push(filters.hashed_pseudonym);
      }

      if (filters.session_id) {
        conditions.push(`session_id = $${paramIndex++}`);
        values.push(filters.session_id);
      }

      if (filters.consent_family) {
        conditions.push(`consent_family = $${paramIndex++}`);
        values.push(filters.consent_family);
      }

      if (filters.since) {
        conditions.push(`created_at >= $${paramIndex++}`);
        values.push(filters.since);
      }

      if (filters.until) {
        conditions.push(`created_at <= $${paramIndex++}`);
        values.push(filters.until);
      }

      if (filters.type) {
        conditions.push(`content->>'type' = $${paramIndex++}`);
        values.push(filters.type);
      }

      // Exclude expired records
      conditions.push(`(expires_at IS NULL OR expires_at > NOW())`);

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const sql = `SELECT COUNT(*) as count FROM memory_records ${whereClause}`;

      const result = await client.query(sql, values);
      return parseInt(result.rows[0].count, 10);
    } finally {
      client.release();
    }
  }

  /**
   * Forget (delete) records for GDPR compliance
   *
   * Permanently deletes memory records based on the request criteria.
   * Supports deletion by:
   * - Specific record ID
   * - All records for a hashed_pseudonym
   * - All records for a session_id
   *
   * @param request - ForgetRequest with id, hashed_pseudonym, or session_id
   * @returns Array of deleted record IDs
   */
  async forget(request: ForgetRequest): Promise<string[]> {
    this.checkCircuitBreaker();
    const client = await this.pool.connect();
    try {
      const conditions: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (request.id) {
        // Delete specific record by ID
        conditions.push(`id = $${paramIndex++}`);
        values.push(request.id);
      } else if (request.hashed_pseudonym) {
        // Delete all records for user
        conditions.push(`hashed_pseudonym = $${paramIndex++}`);
        values.push(request.hashed_pseudonym);
      } else if (request.session_id) {
        // Delete all records for session
        conditions.push(`session_id = $${paramIndex++}`);
        values.push(request.session_id);
      } else {
        throw new Error('ForgetRequest must specify id, hashed_pseudonym, or session_id');
      }

      const whereClause = conditions.join(' AND ');
      const query = `
        DELETE FROM memory_records
        WHERE ${whereClause}
        RETURNING id
      `;

      const result = await client.query(query, values);
      const deletedIds = result.rows.map((row) => row.id);

      // Redacted: Log count only, no IDs or PII
      console.log(`[PostgresStore] Deleted ${deletedIds.length} records for forget request`);
      return deletedIds;
    } finally {
      client.release();
    }
  }

  /**
   * Get a single record by ID
   */
  async get(id: string): Promise<MemoryRecord | null> {
    this.checkCircuitBreaker();
    const client = await this.pool.connect();
    try {
      const query = 'SELECT * FROM memory_records WHERE id = $1';
      const result = await client.query(query, [id]);

      if (result.rows.length === 0) {
        return null;
      }

      return await this.rowToRecord(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * Increment access count - STUB for Phase 3
   * TODO: Implement proper access count tracking
   */
  async incrementAccessCount(id: string): Promise<MemoryRecord | null> {
    console.warn('[PostgresStore] incrementAccessCount() not yet implemented - returning null');
    return null;
  }

  /**
   * Check if a record exists by ID
   */
  async exists(id: string): Promise<boolean> {
    this.checkCircuitBreaker();
    const client = await this.pool.connect();
    try {
      const query = 'SELECT EXISTS(SELECT 1 FROM memory_records WHERE id = $1) as exists';
      const result = await client.query(query, [id]);
      return result.rows[0].exists;
    } finally {
      client.release();
    }
  }

  /**
   * Clear expired records - STUB for Phase 3
   * TODO: Implement TTL sweep job
   */
  async clearExpired(): Promise<number> {
    console.warn('[PostgresStore] clearExpired() not yet implemented - returning 0');
    return 0;
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{
    total_records: number;
    records_by_family: Record<string, number>;
    storage_bytes: number;
  }> {
    this.checkCircuitBreaker();
    const client = await this.pool.connect();
    try {
      // Get total count
      const totalQuery = 'SELECT COUNT(*) as count FROM memory_records';
      const totalResult = await client.query(totalQuery);
      const total_records = parseInt(totalResult.rows[0].count, 10);

      // Get counts by consent family
      const familyQuery = `
        SELECT consent_family, COUNT(*) as count
        FROM memory_records
        GROUP BY consent_family
      `;
      const familyResult = await client.query(familyQuery);
      const records_by_family: Record<string, number> = {};
      for (const row of familyResult.rows) {
        records_by_family[row.consent_family] = parseInt(row.count, 10);
      }

      // Get approximate storage size (PostgreSQL specific)
      const sizeQuery = `
        SELECT pg_total_relation_size('memory_records') as bytes
      `;
      const sizeResult = await client.query(sizeQuery);
      const storage_bytes = parseInt(sizeResult.rows[0].bytes, 10) || 0;

      return {
        total_records,
        records_by_family,
        storage_bytes,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Clear all records (for testing only)
   */
  async clear(): Promise<void> {
    this.checkCircuitBreaker();
    const client = await this.pool.connect();
    try {
      await client.query('TRUNCATE TABLE memory_records');
    } finally {
      client.release();
    }
  }

  /**
   * Batch convert rows to records with bounded concurrency
   * Prevents memory spikes from unbounded Promise.all() on large result sets
   * @param rows - Array of PostgresRow to convert
   * @returns Array of MemoryRecord
   */
  private async batchRowsToRecords(rows: PostgresRow[]): Promise<MemoryRecord[]> {
    const results: MemoryRecord[] = [];
    const batchSize = BATCH_DECRYPT_CONCURRENCY;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map((row) => this.rowToRecord(row)));
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Convert database row to MemoryRecord
   *
   * Transforms PostgreSQL row data into MemoryRecord format. Handles:
   * - JSON parsing of content field
   * - Decryption of encrypted content (detected via encryption_version)
   * - Type coercion for timestamps and IDs
   *
   * Week 3: Added decryption support and type safety
   * Critical Issue #2 fix: Uses encryption_version to detect encrypted records,
   * preventing data loss when ENCRYPTION_ENABLED toggles.
   *
   * @param row - PostgreSQL row from memory_records table
   * @returns Fully hydrated MemoryRecord with decrypted content
   */
  private async rowToRecord(row: PostgresRow): Promise<MemoryRecord> {
    let content = typeof row.content === 'string' ? JSON.parse(row.content) : row.content;

    // Detect if content is encrypted using encryption_version field OR data_ciphertext presence
    // This ensures we can decrypt records even if ENCRYPTION_ENABLED is toggled off
    // Explicit null/undefined checks to avoid falsy empty string issues
    const isEncrypted =
      (row.encryption_version !== null && row.encryption_version !== undefined) ||
      (content && typeof content === 'object' && 'data_ciphertext' in content);

    if (isEncrypted) {
      const decryptStart = Date.now();
      try {
        const encryptionService = getEncryptionService();
        const plaintext = await encryptionService.decrypt({
          data_ciphertext: content.data_ciphertext,
          dek_ciphertext: content.dek_ciphertext,
          dek_kid: content.dek_kid,
          encryption_version: content.encryption_version,
          auth_tag: content.auth_tag,
          iv: content.iv,
        });

        content.data = JSON.parse(Buffer.from(plaintext).toString());
        cryptoOpsDuration.observe({ op: 'decrypt' }, Date.now() - decryptStart);
      } catch (err) {
        cryptoDecryptFailuresTotal.inc({ reason: 'decryption_failed' });
        // Redacted: No PII/content in logs, only record ID and error type
        console.error(
          `[PostgresStore] Decryption failed for record (id=${row.id}, encryption_version=${row.encryption_version || 'none'}, reason=${(err as Error).name || 'unknown'})`
        );
        throw new Error('Failed to decrypt record');
      }
    }

    return {
      id: row.id,
      hashed_pseudonym: row.hashed_pseudonym,
      session_id: row.session_id || undefined,
      content,
      consent_family: row.consent_family as 'personal' | 'cohort' | 'population',
      consent_timestamp: row.consent_timestamp,
      consent_version: row.consent_version,
      created_at: row.created_at,
      updated_at: row.updated_at,
      expires_at: row.expires_at || undefined,
      access_count: row.access_count,
      audit_receipt_id: row.audit_receipt_id,
      encryption_version: row.encryption_version || undefined,
    };
  }

  /**
   * Close the connection pool (for graceful shutdown)
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}

/**
 * Singleton instance factory
 * Controlled by PERSISTENCE env var
 */
let postgresInstance: PostgresStore | null = null;

export function getPostgresStore(): PostgresStore {
  if (!postgresInstance) {
    postgresInstance = new PostgresStore();
  }
  return postgresInstance;
}
