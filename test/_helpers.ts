/**
 * Test Helpers
 *
 * Shared constants and utilities for tests.
 */

/**
 * Invalid pseudonym for testing validation rejection.
 *
 * Intentionally too short to pass validation (requires hs_ + base64url ≥ 43 chars),
 * but NOT email-like to avoid tripping PII scanners.
 */
export const INVALID_PSEUDONYM = 'hs_short';
