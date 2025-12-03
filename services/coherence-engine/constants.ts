/**
 * COHERENCE ENGINE CONSTANTS
 * Centralized configuration values and thresholds
 */

/**
 * Expansion Detection Thresholds
 */
export const EXPANSION_SIGNAL_THRESHOLD = 5; // Minimum signals for expansion (out of 7)
export const MIN_COHERENCE_FOR_EXPANSION = 0.6; // Minimum coherence score for available capacity

/**
 * Drift Detection Thresholds
 */
export const MIN_COHERENCE_THRESHOLD = 0.5; // Coherence score below this indicates field drift

/**
 * Input Validation Limits
 */
export const MAX_TENSION_KEYWORD_LENGTH = 200; // Maximum length for tension_keyword field

/**
 * API Configuration
 */
export const REQUEST_SIZE_LIMIT = '1mb'; // Maximum request body size

/**
 * Rate Limiting Configuration
 *
 * Protects API endpoints from abuse while allowing legitimate usage patterns.
 *
 * Current Settings:
 * - Window: 15 minutes (900,000 ms)
 * - Max Requests: 100 per window per IP
 * - Rate: ~6.7 requests/minute or ~0.11 requests/second
 *
 * Rationale:
 * - 15-minute window provides reasonable reset time for legitimate users
 * - 100 requests allows burst traffic (e.g., page loads, rapid testing)
 * - Per-IP tracking prevents single user from overwhelming system
 * - Rate is permissive enough for development but prevents DoS attacks
 *
 * Adjustment Guidelines:
 * - Increase MAX_REQUESTS if legitimate users hit limits
 * - Decrease for stricter rate limiting in production
 * - Monitor logs for rate limit hits to tune values
 * - Consider different limits for different endpoint groups
 */
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const RATE_LIMIT_MAX_REQUESTS = 100; // Max requests per window per IP

/**
 * False-High Detection
 */
export const FALSE_HIGH_SIGNAL_THRESHOLD = 0; // Even ONE signal indicates false-high
export const HYPE_KEYWORDS = [
  'amazing',
  'incredible',
  'unstoppable',
  'breakthrough',
  'revolutionary',
  'transformative',
  'epic',
  'crushing_it',
  'dominating',
  'winning',
  'killing_it',
  'beast_mode',
  'fire',
  'lit',
];

export const EXCITED_KEYWORDS = ['excited', 'energized', 'motivated', 'pumped'];
