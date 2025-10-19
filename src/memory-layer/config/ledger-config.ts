/**
 * Ledger Configuration
 *
 * Controls ledger enablement and optional behavior for different environments
 */

/**
 * Check if ledger is enabled
 * Default: true (production mode)
 */
export function isLedgerEnabled(): boolean {
  return process.env.LEDGER_ENABLED !== 'false';
}

/**
 * Check if ledger is optional (graceful degradation)
 * Default: false (ledger required in production)
 * Set to true in CI/test environments where ledger may not be initialized
 */
export function isLedgerOptional(): boolean {
  return process.env.LEDGER_OPTIONAL === 'true';
}
