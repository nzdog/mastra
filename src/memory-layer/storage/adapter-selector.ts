/**
 * Storage Adapter Selector
 * Phase 3: Privacy, Security & Governance - Week 1
 *
 * Routes storage operations to the correct adapter based on PERSISTENCE env var.
 * Supports: memory (default), postgres, dual-write (Week 3)
 */

import { MemoryStore } from './memory-store-interface';
import { getMemoryStore } from './in-memory-store';
import { getPostgresStore } from './postgres-store';
import { getDualStore } from './dual-store';

/**
 * Persistence modes
 */
export type PersistenceMode = 'memory' | 'postgres' | 'dual-write';

/**
 * Get the active storage adapter based on PERSISTENCE env var
 */
export function getStorageAdapter(): MemoryStore {
  const mode = (process.env.PERSISTENCE || 'memory') as PersistenceMode;

  switch (mode) {
    case 'memory':
      return getMemoryStore();

    case 'postgres':
      return getPostgresStore();

    case 'dual-write':
      // Week 3: Dual-write adapter for zero-downtime migration
      console.log('[AdapterSelector] Dual-write mode enabled (memory + postgres)');
      return getDualStore(getMemoryStore(), getPostgresStore());

    default:
      console.warn(`Unknown PERSISTENCE mode: ${mode}. Falling back to memory.`);
      return getMemoryStore();
  }
}

/**
 * Check if encryption is enabled
 */
export function isEncryptionEnabled(): boolean {
  return process.env.ENCRYPTION_ENABLED === 'true';
}

/**
 * Check if pseudonym rotation is enabled
 */
export function isPseudonymRotationEnabled(): boolean {
  return process.env.PSEUDONYM_ROTATION_ENABLED === 'true';
}

/**
 * Get feature flags summary (for debugging)
 */
export function getFeatureFlags(): Record<string, any> {
  return {
    persistence: process.env.PERSISTENCE || 'memory',
    encryption_enabled: isEncryptionEnabled(),
    pseudonym_rotation_enabled: isPseudonymRotationEnabled(),
    dual_write_enabled: process.env.DUAL_WRITE_ENABLED === 'true',
    redis_cache_enabled: process.env.REDIS_CACHE_ENABLED === 'true',
    auth_provider: process.env.AUTH_PROVIDER || 'mock',
  };
}
