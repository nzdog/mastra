/**
 * Backward Compatibility Shim for StoreRequest
 * Phase 3.2: Gradual migration support
 *
 * This middleware provides backward compatibility for legacy clients during migration:
 * 1. Missing metadata field -> synthesize from legacy fields
 * 2. Legacy/alias consent_family values -> map to canonical values
 *
 * Environment flags control behavior:
 * - COMPAT_ALLOW_LEGACY_METADATA=true: Accept requests without metadata field
 * - COMPAT_ALLOW_LEGACY_FAMILY=true: Accept legacy consent_family aliases
 *
 * Deprecation: These flags will be removed in a future release (target: 3-6 months).
 * All clients should migrate to the canonical StoreRequest format.
 */

import { Request, Response, NextFunction } from 'express';
import { ConsentFamily } from '../models/memory-record';

/**
 * Prometheus counter for legacy request tracking
 * Incremented when compat shims are applied
 */
let compatLegacyStoreRequestsTotal = 0;

/**
 * Get current compat metrics (for Prometheus export)
 */
export function getCompatMetrics(): Record<string, number> {
  return {
    'compat_legacy_store_requests_total{reason="missing_metadata"}': compatLegacyStoreRequestsTotal,
    'compat_legacy_store_requests_total{reason="legacy_family"}': compatLegacyStoreRequestsTotal,
  };
}

/**
 * Legacy consent family aliases that should be mapped to canonical values
 */
const LEGACY_FAMILY_ALIASES: Record<string, ConsentFamily> = {
  // Canonical values (pass through)
  personal: 'personal',
  cohort: 'cohort',
  population: 'population',

  // Legacy aliases (case variations)
  Personal: 'personal',
  PERSONAL: 'personal',
  Cohort: 'cohort',
  COHORT: 'cohort',
  Population: 'population',
  POPULATION: 'population',

  // Legacy aliases (alternative names)
  individual: 'personal',
  Individual: 'personal',
  INDIVIDUAL: 'personal',
  user: 'personal',
  User: 'personal',
  USER: 'personal',
  group: 'cohort',
  Group: 'cohort',
  GROUP: 'cohort',
  aggregate: 'population',
  Aggregate: 'population',
  AGGREGATE: 'population',
};

/**
 * Check if the current request is a store operation
 */
function isStoreOperation(req: Request): boolean {
  return req.method === 'POST' && req.path.includes('/store');
}

/**
 * Map legacy consent_family value to canonical value
 * Returns null if mapping not allowed or value unknown
 */
function mapLegacyConsentFamily(value: string): ConsentFamily | null {
  const allowLegacyFamily = process.env.COMPAT_ALLOW_LEGACY_FAMILY === 'true';

  // Check if it's already a canonical value
  if (value === 'personal' || value === 'cohort' || value === 'population') {
    return value as ConsentFamily;
  }

  // If not canonical and compat flag is off, reject
  if (!allowLegacyFamily) {
    return null;
  }

  // Try to map legacy alias
  const mapped = LEGACY_FAMILY_ALIASES[value];
  if (mapped) {
    console.log(
      `[CompatShim] Mapped legacy consent_family '${value}' -> '${mapped}' (COMPAT_ALLOW_LEGACY_FAMILY=true)`
    );
    compatLegacyStoreRequestsTotal++;
    return mapped;
  }

  return null;
}

/**
 * Synthesize metadata field from legacy request format
 * Legacy format had hashed_pseudonym, consent_family, etc. at top level
 */
function synthesizeMetadata(body: Record<string, unknown>, consentContext?: Record<string, unknown>): Record<string, unknown> | null {
  const allowLegacyMetadata = process.env.COMPAT_ALLOW_LEGACY_METADATA === 'true';

  // If metadata already exists, no synthesis needed
  if (body.metadata) {
    return null;
  }

  // If compat flag is off, reject
  if (!allowLegacyMetadata) {
    return null;
  }

  // Extract legacy fields (could be at top level or in other locations)
  const hashedPseudonym = body.hashed_pseudonym || consentContext?.hashed_pseudonym || 'unknown';
  const consentFamily = body.consent_family || consentContext?.family || 'personal';
  const consentTimestamp = body.consent_timestamp || new Date().toISOString();
  const consentVersion = body.consent_version || 'legacy-compat';

  console.log(
    `[CompatShim] Synthesizing metadata for legacy request (COMPAT_ALLOW_LEGACY_METADATA=true)`
  );
  console.log(
    `[CompatShim]   hashed_pseudonym: ${hashedPseudonym}, consent_family: ${consentFamily}`
  );
  compatLegacyStoreRequestsTotal++;

  // Synthesize metadata object
  return {
    hashed_pseudonym: String(hashedPseudonym),
    consent_family: mapLegacyConsentFamily(String(consentFamily)) || 'personal',
    consent_timestamp: String(consentTimestamp),
    consent_version: String(consentVersion),
  };
}

/**
 * Backward Compatibility Shim Middleware
 *
 * Applied BEFORE schema validation to transform legacy requests into canonical format.
 * This allows gradual client migration without breaking existing integrations.
 *
 * Middleware order:
 * 1. Consent resolver (extracts family from URL)
 * 2. **Compat shim** (transforms legacy requests) <- THIS MIDDLEWARE
 * 3. Schema validator (validates canonical format)
 * 4. Operation handlers
 */
export function compatShim(req: Request, res: Response, next: NextFunction): void {
  // Only apply to store operations
  if (!isStoreOperation(req)) {
    return next();
  }

  const body = req.body as Record<string, unknown>;
  const consentContext = (req as unknown as { consentContext?: Record<string, unknown> }).consentContext;

  // Step 1: Synthesize metadata if missing
  const synthesizedMetadata = synthesizeMetadata(body, consentContext);
  if (synthesizedMetadata) {
    body.metadata = synthesizedMetadata;
  }

  // Step 2: Map legacy consent_family in metadata (if it exists now)
  const metadata = body.metadata as Record<string, unknown> | undefined;
  if (metadata && typeof metadata.consent_family === 'string') {
    const originalFamily = metadata.consent_family;
    const mappedFamily = mapLegacyConsentFamily(originalFamily);

    if (mappedFamily === null) {
      // Invalid consent_family and compat flag is off
      console.warn(
        `[CompatShim] Invalid consent_family '${originalFamily}' and COMPAT_ALLOW_LEGACY_FAMILY=false`
      );
      // Let schema validator reject it
    } else if (mappedFamily !== originalFamily) {
      // Legacy alias detected, map to canonical
      metadata.consent_family = mappedFamily;
    }
  }

  // Continue to next middleware (schema validation)
  next();
}

/**
 * Export metrics getter for integration with observability/metrics.ts
 */
export function incrementCompatMetric(reason: 'missing_metadata' | 'legacy_family'): void {
  compatLegacyStoreRequestsTotal++;
  console.log(
    `[CompatShim] Metric incremented: compat_legacy_store_requests_total{reason="${reason}"}`
  );
}
