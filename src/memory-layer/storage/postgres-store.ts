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

  constructor(config?: PostgresConfig) {
    const pgConfig = config || loadConfig();
    this.pool = new Pool(pgConfig);

    // Handle pool errors and record metrics
    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client', err);
      postgresPoolErrorsTotal.inc({ error_type: err.name || 'unknown' });
    });
  }

  /**
   * Store a new memory record
   * Week 3: Added envelope encryption support
   */
  async store(record: MemoryRecord): Promise<MemoryRecord> {
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

          cryptoOpsDuration.observe({ op: 'encrypt' }, Date.now() - encryptStart);
        } catch (err) {
          cryptoEncryptFailuresTotal.inc({ reason: 'encryption_failed' });
          console.error('[PostgresStore] Encryption failed:', err);
          throw new Error('Failed to encrypt record');
        }
      }

      const query = `
        INSERT INTO memory_records (
          id, hashed_pseudonym, session_id, content,
          consent_family, consent_timestamp, consent_version,
          created_at, updated_at, expires_at, access_count, audit_receipt_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO UPDATE SET
          updated_at = EXCLUDED.updated_at,
          content = EXCLUDED.content,
          access_count = EXCLUDED.access_count
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
      const limit = query.limit || 100;
      const offset = query.offset || 0;

      const sql = `
        SELECT * FROM memory_records
        ${whereClause}
        ORDER BY created_at ${sortOrder}
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;

      values.push(limit, offset);

      const result = await client.query(sql, values);
      return Promise.all(result.rows.map((row) => this.rowToRecord(row)));
    } finally {
      client.release();
    }
  }

  /**
   * Count records matching filters
   */
  async count(filters: QueryFilters): Promise<number> {
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
    const client = await this.pool.connect();
    try {
      await client.query('TRUNCATE TABLE memory_records');
    } finally {
      client.release();
    }
  }

  /**
   * Convert database row to MemoryRecord
   *
   * Transforms PostgreSQL row data into MemoryRecord format. Handles:
   * - JSON parsing of content field
   * - Decryption of encrypted content (if encryption enabled)
   * - Type coercion for timestamps and IDs
   *
   * Week 3: Added decryption support and type safety
   *
   * @param row - PostgreSQL row from memory_records table
   * @returns Fully hydrated MemoryRecord with decrypted content
   */
  private async rowToRecord(row: PostgresRow): Promise<MemoryRecord> {
    let content = typeof row.content === 'string' ? JSON.parse(row.content) : row.content;

    // Week 3: Decrypt content if encrypted
    if (isEncryptionEnabled() && content.data_ciphertext) {
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
        console.error('[PostgresStore] Decryption failed:', err);
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
