/**
 * Prometheus Metrics for Audit & Governance
 *
 * Phase 1.2: Metrics activation for observability
 * Exports registry and instrumented metrics for audit operations
 */

import * as promClient from 'prom-client';

// Create dedicated registry for audit metrics
export const register = new promClient.Registry();

// Collect default Node.js metrics (heap, CPU, event loop, etc.)
promClient.collectDefaultMetrics({ register, prefix: 'nodejs_' });

// =============================================================================
// AUDIT EVENT METRICS
// =============================================================================

/** Total number of audit events emitted */
export const auditEventsTotal = new promClient.Counter({
  name: 'audit_events_total',
  help: 'Total number of audit events emitted',
  labelNames: ['event_type', 'operation'],
  registers: [register],
});

/** Current ledger height (total events in Merkle tree) */
export const auditLedgerHeight = new promClient.Gauge({
  name: 'audit_ledger_height',
  help: 'Current ledger height (total events in Merkle tree)',
  registers: [register],
});

// =============================================================================
// PERFORMANCE METRICS
// =============================================================================

/** Time to cryptographically sign an audit event (milliseconds) */
export const auditSignatureDuration = new promClient.Histogram({
  name: 'audit_signature_duration_ms',
  help: 'Time to cryptographically sign an audit event (milliseconds)',
  labelNames: ['algorithm'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 25, 50, 100], // milliseconds
  registers: [register],
});

/** Time to append event to Merkle tree (milliseconds) */
export const auditMerkleAppendDuration = new promClient.Histogram({
  name: 'audit_merkle_append_duration_ms',
  help: 'Time to append event to Merkle tree (milliseconds)',
  buckets: [0.5, 1, 2, 5, 10, 25, 50, 100, 250], // milliseconds
  registers: [register],
});

/** Time to perform integrity check (milliseconds) */
export const auditIntegrityCheckDuration = new promClient.Histogram({
  name: 'audit_integrity_check_duration_ms',
  help: 'Time to perform integrity check (milliseconds)',
  labelNames: ['check_type'],
  buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000], // milliseconds
  registers: [register],
});

/** Time spent waiting to acquire file lock (milliseconds) */
export const auditFileLockWaitDuration = new promClient.Histogram({
  name: 'audit_file_lock_wait_duration_ms',
  help: 'Time spent waiting to acquire file lock (milliseconds)',
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000], // milliseconds
  registers: [register],
});

// =============================================================================
// VERIFICATION & SECURITY METRICS
// =============================================================================

/** Time to verify a receipt (milliseconds) */
export const auditVerificationDuration = new promClient.Histogram({
  name: 'audit_verification_duration_ms',
  help: 'Time to verify a receipt (milliseconds)',
  labelNames: ['verification_type'],
  buckets: [1, 5, 10, 25, 50, 100, 250], // milliseconds
  registers: [register],
});

/** Total number of failed receipt verifications */
export const auditVerificationFailures = new promClient.Counter({
  name: 'audit_verification_failures_total',
  help: 'Total number of failed receipt verifications',
  labelNames: ['failure_reason'],
  registers: [register],
});

// =============================================================================
// KEY ROTATION & JWKS METRICS
// =============================================================================

/** Age of current signing key in days */
export const auditKeyAgeDays = new promClient.Gauge({
  name: 'audit_key_age_days',
  help: 'Age of current signing key in days',
  labelNames: ['kid'],
  registers: [register],
});

/** Total requests to JWKS endpoint */
export const auditJwksFetchRequests = new promClient.Counter({
  name: 'audit_jwks_fetch_requests_total',
  help: 'Total requests to JWKS endpoint',
  labelNames: ['status'],
  registers: [register],
});

/**
 * Total number of JWKS/Ledger kid mismatches detected
 * Phase 1.2: Critical alert metric - should always be 0
 */
export const auditJwksMismatchTotal = new promClient.Counter({
  name: 'audit_jwks_mismatch_total',
  help: 'Total number of JWKS/Ledger kid mismatches detected (critical alert)',
  registers: [register],
});

/**
 * Info gauge for ledger signer kid
 * Phase 1.2: For monitoring/dashboards
 */
export const auditLedgerSignerKid = new promClient.Gauge({
  name: 'audit_ledger_signer_kid_info',
  help: 'Current ledger signer key ID (info metric)',
  labelNames: ['kid'],
  registers: [register],
});

/**
 * Info gauge for JWKS active kid
 * Phase 1.2: For monitoring/dashboards
 */
export const auditJwksActiveKid = new promClient.Gauge({
  name: 'audit_jwks_active_kid_info',
  help: 'Current JWKS active key ID (info metric)',
  labelNames: ['kid'],
  registers: [register],
});

// =============================================================================
// CORS METRICS
// =============================================================================

/** Total number of CORS preflight requests */
export const corsPreflightTotal = new promClient.Counter({
  name: 'cors_preflight_total',
  help: 'Total number of CORS preflight (OPTIONS) requests',
  labelNames: ['route', 'origin_allowed'],
  registers: [register],
});

/** Total number of rejected CORS requests */
export const corsRejectTotal = new promClient.Counter({
  name: 'cors_reject_total',
  help: 'Total number of rejected CORS requests (invalid origin)',
  labelNames: ['route'],
  registers: [register],
});

/** Time to process CORS preflight request (milliseconds) */
export const corsPreflightDuration = new promClient.Histogram({
  name: 'cors_preflight_duration_ms',
  help: 'Time to process CORS preflight request (milliseconds)',
  buckets: [0.1, 0.5, 1, 2, 5, 10, 25, 50], // milliseconds
  registers: [register],
});

// =============================================================================
// OPERATIONAL METRICS
// =============================================================================

/** Number of temporary files removed during crash recovery */
export const auditCrashRecoveryTempFilesRemoved = new promClient.Counter({
  name: 'audit_crash_recovery_temp_files_removed_total',
  help: 'Number of temporary files removed during crash recovery',
  registers: [register],
});

/** Number of times file lock acquisition was retried */
export const auditFileLockContention = new promClient.Counter({
  name: 'audit_file_lock_contention_total',
  help: 'Number of times file lock acquisition was retried',
  labelNames: ['retry_count'],
  registers: [register],
});

// =============================================================================
// PHASE 2: MEMORY LAYER METRICS
// =============================================================================

/** Duration of memory operations in seconds */
export const memoryOperationDuration = new promClient.Histogram({
  name: 'memory_operation_duration_seconds',
  help: 'Duration of memory operations in seconds',
  labelNames: ['operation', 'consent_family', 'status'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5], // seconds
  registers: [register],
});

/** Total number of memory operations */
export const memoryOperationTotal = new promClient.Counter({
  name: 'memory_operation_total',
  help: 'Total number of memory operations by type',
  labelNames: ['operation', 'consent_family', 'status'],
  registers: [register],
});

/** Total number of memory records stored */
export const memoryStoreRecordsTotal = new promClient.Counter({
  name: 'memory_store_records_total',
  help: 'Total number of memory records stored',
  labelNames: ['consent_family', 'content_type'],
  registers: [register],
});

/** Total number of memory records recalled */
export const memoryRecallRecordsTotal = new promClient.Counter({
  name: 'memory_recall_records_total',
  help: 'Total number of memory records recalled',
  labelNames: ['consent_family'],
  registers: [register],
});

/** Total number of memory records forgotten (deleted) */
export const memoryForgetRecordsTotal = new promClient.Counter({
  name: 'memory_forget_records_total',
  help: 'Total number of memory records forgotten (deleted)',
  labelNames: ['consent_family', 'hard_delete'],
  registers: [register],
});

/** Total number of distillation operations */
export const memoryDistillTotal = new promClient.Counter({
  name: 'memory_distill_total',
  help: 'Total number of distillation operations',
  labelNames: ['consent_family', 'aggregation_type', 'privacy_met'],
  registers: [register],
});

/** Total number of export operations */
export const memoryExportTotal = new promClient.Counter({
  name: 'memory_export_total',
  help: 'Total number of export operations',
  labelNames: ['consent_family', 'format'],
  registers: [register],
});

/** Current number of memory records in storage */
export const memoryRecordsInStorage = new promClient.Gauge({
  name: 'memory_records_in_storage',
  help: 'Current number of memory records in storage',
  labelNames: ['consent_family'],
  registers: [register],
});

/** Total storage size in bytes */
export const memoryStorageSizeBytes = new promClient.Gauge({
  name: 'memory_storage_size_bytes',
  help: 'Total storage size in bytes',
  registers: [register],
});

/** Number of consent resolution failures */
export const memoryConsentResolutionFailures = new promClient.Counter({
  name: 'memory_consent_resolution_failures_total',
  help: 'Number of consent resolution failures',
  labelNames: ['reason', 'consent_family'],
  registers: [register],
});

/** Number of k-anonymity violations */
export const memoryKAnonymityViolations = new promClient.Counter({
  name: 'memory_k_anonymity_violations_total',
  help: 'Number of k-anonymity violations (privacy threshold not met)',
  labelNames: ['consent_family', 'operation'],
  registers: [register],
});

// =============================================================================
// PHASE 3: ENCRYPTION METRICS
// =============================================================================

/** Total number of encryption failures */
export const cryptoEncryptFailuresTotal = new promClient.Counter({
  name: 'crypto_encrypt_failures_total',
  help: 'Total number of encryption failures',
  labelNames: ['reason'],
  registers: [register],
});

/** Total number of decryption failures */
export const cryptoDecryptFailuresTotal = new promClient.Counter({
  name: 'crypto_decrypt_failures_total',
  help: 'Total number of decryption failures',
  labelNames: ['reason'],
  registers: [register],
});

/** Duration of cryptographic operations in milliseconds */
export const cryptoOpsDuration = new promClient.Histogram({
  name: 'crypto_ops_duration_ms',
  help: 'Duration of cryptographic operations (encrypt/decrypt) in milliseconds',
  labelNames: ['op'],
  buckets: [0.5, 1, 2, 5, 10, 25, 50, 100, 250, 500], // milliseconds
  registers: [register],
});

// =============================================================================
// PHASE 3 WEEK 3: DUAL-WRITE MIGRATION METRICS
// =============================================================================

/** Total number of dual-write records written */
export const dualWriteRecordsTotal = new promClient.Counter({
  name: 'dual_write_records_total',
  help: 'Total number of records written in dual-write mode',
  labelNames: ['primary_store', 'secondary_store', 'status'],
  registers: [register],
});

/** Total number of dual-write failures */
export const dualWriteFailuresTotal = new promClient.Counter({
  name: 'dual_write_failures_total',
  help: 'Total number of dual-write failures by store',
  labelNames: ['store', 'reason'],
  registers: [register],
});

/** Lag between primary and secondary stores in seconds */
export const dualWriteLagSeconds = new promClient.Gauge({
  name: 'dual_write_lag_seconds',
  help: 'Lag between primary and secondary stores (optional)',
  labelNames: ['store'],
  registers: [register],
});

// =============================================================================
// BACKFILL METRICS
// =============================================================================

/** Total number of records backfilled */
export const backfillRecordsTotal = new promClient.Counter({
  name: 'backfill_records_total',
  help: 'Total number of records backfilled to Postgres',
  labelNames: ['status'],
  registers: [register],
});

/** Total number of backfill failures */
export const backfillFailuresTotal = new promClient.Counter({
  name: 'backfill_failures_total',
  help: 'Total number of backfill operation failures',
  labelNames: ['reason'],
  registers: [register],
});

// =============================================================================
// POSTGRES POOL METRICS
// =============================================================================

/** Total number of PostgreSQL pool errors */
export const postgresPoolErrorsTotal = new promClient.Counter({
  name: 'postgres_pool_errors_total',
  help: 'Total number of PostgreSQL connection pool errors',
  labelNames: ['error_type'],
  registers: [register],
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Measure timing for a synchronous operation
 * Returns the result and observes the duration in the provided histogram
 */
export function measureSync<T>(
  histogram: promClient.Histogram<string>,
  labels: Record<string, string> | undefined,
  fn: () => T
): T {
  const start = Date.now();
  try {
    return fn();
  } finally {
    const duration = Date.now() - start;
    if (labels) {
      histogram.observe(labels, duration);
    } else {
      histogram.observe(duration);
    }
  }
}

/**
 * Measure timing for an asynchronous operation
 * Returns the result and observes the duration in the provided histogram
 */
export async function measureAsync<T>(
  histogram: promClient.Histogram<string>,
  labels: Record<string, string> | undefined,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  try {
    return await fn();
  } finally {
    const duration = Date.now() - start;
    if (labels) {
      histogram.observe(labels, duration);
    } else {
      histogram.observe(duration);
    }
  }
}

/**
 * Get metrics in Prometheus text format
 */
export async function getMetrics(): Promise<string> {
  return await register.metrics();
}

/**
 * Get metrics content type header
 */
export function getContentType(): string {
  return register.contentType;
}
