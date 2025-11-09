/**
 * Pseudonymization Utilities
 * Phase 2: Memory Layer - User ID Hashing
 *
 * Provides HMAC-based pseudonymization for user identifiers.
 * Uses rotating secrets for privacy-preserving pseudonym rotation (Phase 3).
 */

import { createHmac } from 'crypto';

/**
 * Hash user ID using HMAC-SHA256
 *
 * Uses a secret key to create a one-way hash of the user ID.
 * This prevents storing raw user identifiers in the memory layer.
 *
 * Phase 3: Will support automatic rotation every 90 days.
 *
 * @param userId - Raw user identifier (email, username, UUID, etc.)
 * @returns Hashed pseudonym (64-character hex string)
 *
 * @example
 * ```typescript
 * const hashed = hashUserId('user@example.com');
 * // Returns: "a1b2c3d4e5f6..."
 * ```
 */
export function hashUserId(userId: string): string {
  // Use environment secret or fallback (MUST be changed in production)
  const secret = process.env.PSEUDONYM_SECRET || 'default-secret-change-me-in-production';

  if (secret === 'default-secret-change-me-in-production' && process.env.NODE_ENV === 'production') {
    console.warn('⚠️  WARNING: Using default PSEUDONYM_SECRET in production. Generate one with: openssl rand -hex 32');
  }

  return createHmac('sha256', secret)
    .update(userId)
    .digest('hex');
}

/**
 * Validate that a user ID is present and non-empty
 *
 * @param userId - User identifier to validate
 * @returns true if valid, false otherwise
 */
export function isValidUserId(userId: string | undefined | null): userId is string {
  return typeof userId === 'string' && userId.length > 0;
}

/**
 * Get the current pseudonym rotation epoch
 *
 * Phase 3: Returns the current 90-day epoch number for pseudonym rotation.
 * For now, always returns 0 (no rotation).
 *
 * @returns Epoch number (0 = initial epoch, 1 = first rotation, etc.)
 */
export function getPseudonymEpoch(): number {
  if (process.env.PSEUDONYM_ROTATION_ENABLED !== 'true') {
    return 0;
  }

  // Phase 3: Calculate epoch based on rotation start date
  // const rotationStart = new Date(process.env.PSEUDONYM_ROTATION_START || '2025-01-01');
  // const daysSinceStart = Math.floor((Date.now() - rotationStart.getTime()) / (1000 * 60 * 60 * 24));
  // return Math.floor(daysSinceStart / 90);

  return 0;
}
