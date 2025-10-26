/**
 * PostgreSQL Storage Adapter
 * Phase 3: Privacy, Security & Governance
 *
 * Implements MemoryStore interface backed by PostgreSQL.
 * Fully implements all MemoryStore methods with envelope encryption support.
 *
 * Features:
 * - Store, recall, count with query filtering
 * - Forget (hard delete) by ID, user, or session
 * - Record access tracking (get, incrementAccessCount, exists)
 * - TTL enforcement (clearExpired)
 * - Storage statistics (getStats)
 * - Test cleanup (clear)
 * - Envelope encryption with data encryption keys (DEK)
 */

import { Pool } from 'pg';
import {
  cryptoEncryptFailuresTotal,
  cryptoDecryptFailuresTotal,
  cryptoOpsDuration,
} from '../../observability/metrics';
import { MemoryRecord } from '../models/memory-record';
import { RecallQuery, ForgetRequest } from '../models/operation-requests';
import { getEncryptionService } from '../security/encryption-service';
import { isEncryptionEnabled } from './adapter-selector';
import { MemoryStore, QueryFilters } from './memory-store-interface';

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

    // Handle pool errors
    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client', err);
    });
  }

  /**
   * Store a new memory record
   * Week 3: Added envelope encryption support
   */
  async store(record: MemoryRecord): Promise<MemoryRecord> {
    const client = await this.pool.connect();
    try {
      // Week 3: Encrypt content before storing if enabled
      let contentToStore: unknown = record.content;
      if (isEncryptionEnabled()) {
        const encryptStart = Date.now();
        try {
          const encryptionService = getEncryptionService();
          const plaintext = Buffer.from(JSON.stringify(record.content.data));
          const encrypted = await encryptionService.encrypt(plaintext, 'kek-default');

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
      const values: unknown[] = [];
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
      const values: unknown[] = [];
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
   * Forget (delete) memory records based on request criteria
   *
   * Supports deletion by:
   * - Specific record ID
   * - All records for a user (hashed_pseudonym)
   * - All records for a session
   *
   * @param request - Forget request with id, hashed_pseudonym, or session_id
   * @returns Array of deleted record IDs
   */
  async forget(request: ForgetRequest): Promise<string[]> {
    const client = await this.pool.connect();
    try {
      const conditions: string[] = [];
      const values: unknown[] = [];
      let paramCount = 1;

      // Build WHERE clause based on request
      if (request.id) {
        conditions.push(`id = $${paramCount++}`);
        values.push(request.id);
      }

      if (request.hashed_pseudonym) {
        conditions.push(`hashed_pseudonym = $${paramCount++}`);
        values.push(request.hashed_pseudonym);
      }

      if (request.session_id) {
        conditions.push(`session_id = $${paramCount++}`);
        values.push(request.session_id);
      }

      if (conditions.length === 0) {
        throw new Error('Forget request must specify id, hashed_pseudonym, or session_id');
      }

      const query = `
        DELETE FROM memory_records
        WHERE ${conditions.join(' AND ')}
        RETURNING id
      `;

      const result = await client.query(query, values);
      return result.rows.map((row) => row.id);
    } finally {
      client.release();
    }
  }

  /**
   * Get a single memory record by ID
   *
   * @param id - Record ID to retrieve
   * @returns The memory record or null if not found
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
   * Increment the access count for a record
   *
   * Updates the access_count field and updated_at timestamp.
   *
   * @param id - Record ID to update
   * @returns Updated memory record or null if not found
   */
  async incrementAccessCount(id: string): Promise<MemoryRecord | null> {
    const client = await this.pool.connect();
    try {
      const query = `
        UPDATE memory_records
        SET access_count = access_count + 1,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;

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
   * Check if a record exists by ID
   *
   * @param id - Record ID to check
   * @returns true if record exists, false otherwise
   */
  async exists(id: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const query = 'SELECT EXISTS(SELECT 1 FROM memory_records WHERE id = $1)';
      const result = await client.query(query, [id]);
      return result.rows[0].exists;
    } finally {
      client.release();
    }
  }

  /**
   * Clear expired records based on expires_at timestamp
   *
   * Deletes all records where expires_at is in the past.
   * Should be called periodically by a background job.
   *
   * @returns Number of records deleted
   */
  async clearExpired(): Promise<number> {
    const client = await this.pool.connect();
    try {
      const query = `
        DELETE FROM memory_records
        WHERE expires_at IS NOT NULL AND expires_at < NOW()
        RETURNING id
      `;

      const result = await client.query(query);
      return result.rowCount || 0;
    } finally {
      client.release();
    }
  }

  /**
   * Get storage statistics
   *
   * Returns:
   * - Total record count
   * - Record counts grouped by consent_family
   * - Approximate storage size in bytes
   *
   * @returns Storage statistics object
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

      // Get count by consent_family
      const familyQuery = `
        SELECT consent_family, COUNT(*) as count
        FROM memory_records
        GROUP BY consent_family
      `;
      const familyResult = await client.query(familyQuery);
      const records_by_family: Record<string, number> = {};
      familyResult.rows.forEach((row) => {
        records_by_family[row.consent_family] = parseInt(row.count, 10);
      });

      // Estimate storage size (sum of content column sizes)
      const sizeQuery = `
        SELECT COALESCE(SUM(pg_column_size(content)), 0) as bytes
        FROM memory_records
      `;
      const sizeResult = await client.query(sizeQuery);
      const storage_bytes = parseInt(sizeResult.rows[0].bytes, 10);

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
   * Clear all records from the database
   *
   * **WARNING:** This deletes ALL memory records permanently.
   * Should only be used for testing purposes.
   *
   * @returns Promise that resolves when all records are deleted
   */
  async clear(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('DELETE FROM memory_records');
    } finally {
      client.release();
    }
  }

  /**
   * Convert database row to MemoryRecord
   * Week 3: Added decryption support
   */
  private async rowToRecord(row: Record<string, unknown>): Promise<MemoryRecord> {
    const content =
      typeof row.content === 'string'
        ? JSON.parse(row.content)
        : (row.content as Record<string, unknown>);

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
      id: row.id as string,
      hashed_pseudonym: row.hashed_pseudonym as string,
      session_id: row.session_id as string | undefined,
      content,
      consent_family: row.consent_family as 'personal' | 'cohort' | 'population',
      consent_timestamp: row.consent_timestamp as string,
      consent_version: row.consent_version as string,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      expires_at: row.expires_at as string | undefined,
      access_count: row.access_count as number,
      audit_receipt_id: row.audit_receipt_id as string,
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
