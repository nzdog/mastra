/**
 * PostgreSQL Storage Adapter
 * Phase 3: Privacy, Security & Governance
 *
 * Implements MemoryStore interface backed by PostgreSQL.
 * Week 1 scope: store, recall, count only (no encryption yet).
 * Week 3: Added envelope encryption support.
 * Other methods stubbed with TODO Phase 3.
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
 * Database row representation from PostgreSQL
 */
interface DbMemoryRow {
  id: string;
  hashed_pseudonym: string;
  session_id: string | null;
  content: string | Record<string, unknown>;
  consent_family: string;
  consent_timestamp: string;
  consent_version: string;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  access_count: number;
  audit_receipt_id: string;
  encryption_version?: string | null;
}

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
      let contentToStore: Record<string, unknown> = record.content as unknown as Record<string, unknown>;
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
   * TODO(Phase 3): Implement forget with hard delete support
   */
  async forget(_request: ForgetRequest): Promise<string[]> {
    throw new Error('TODO(Phase 3): Implement PostgresStore.forget()');
  }

  /**
   * TODO(Phase 3): Implement get by ID
   */
  async get(_id: string): Promise<MemoryRecord | null> {
    throw new Error('TODO(Phase 3): Implement PostgresStore.get()');
  }

  /**
   * TODO(Phase 3): Implement access count increment
   */
  async incrementAccessCount(_id: string): Promise<MemoryRecord | null> {
    throw new Error('TODO(Phase 3): Implement PostgresStore.incrementAccessCount()');
  }

  /**
   * TODO(Phase 3): Implement exists check
   */
  async exists(_id: string): Promise<boolean> {
    throw new Error('TODO(Phase 3): Implement PostgresStore.exists()');
  }

  /**
   * TODO(Phase 3): Implement TTL sweep job
   */
  async clearExpired(): Promise<number> {
    throw new Error('TODO(Phase 3): Implement PostgresStore.clearExpired()');
  }

  /**
   * TODO(Phase 3): Implement stats aggregation
   */
  async getStats(): Promise<{
    total_records: number;
    records_by_family: Record<string, number>;
    storage_bytes: number;
  }> {
    throw new Error('TODO(Phase 3): Implement PostgresStore.getStats()');
  }

  /**
   * TODO(Phase 3): Implement clear for testing
   */
  async clear(): Promise<void> {
    throw new Error('TODO(Phase 3): Implement PostgresStore.clear()');
  }

  /**
   * Convert database row to MemoryRecord
   * Week 3: Added decryption support
   */
  private async rowToRecord(row: DbMemoryRow): Promise<MemoryRecord> {
    const content = typeof row.content === 'string' ? JSON.parse(row.content) : row.content;

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
      session_id: row.session_id,
      content,
      consent_family: row.consent_family,
      consent_timestamp: row.consent_timestamp,
      consent_version: row.consent_version,
      created_at: row.created_at,
      updated_at: row.updated_at,
      expires_at: row.expires_at,
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
