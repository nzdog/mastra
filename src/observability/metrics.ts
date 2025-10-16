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
