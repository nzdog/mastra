/**
 * Input Validation & Sanitization Module
 *
 * Provides validation functions for user input, protocol slugs, and session IDs.
 * Includes prompt injection detection and sanitization.
 */

/**
 * Input length constraints
 */
export const INPUT_CONSTRAINTS = {
  MAX_USER_INPUT_LENGTH: 5000, // 5000 chars max for user input
  MAX_SESSION_ID_LENGTH: 100, // UUID should be ~36 chars
  MAX_PROTOCOL_SLUG_LENGTH: 200,
  MIN_USER_INPUT_LENGTH: 1,
};

/**
 * Validation result type
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitized?: string;
}

/**
 * Validate and sanitize user input to prevent prompt injection and excessive token usage
 *
 * @param input - User input string to validate
 * @param fieldName - Name of the field being validated (for error messages)
 * @returns Validation result with sanitized input if valid
 *
 * @example
 * ```typescript
 * const result = validateUserInput(userInput, 'user_response');
 * if (!result.valid) {
 *   return res.status(400).json({ error: result.error });
 * }
 * const sanitized = result.sanitized;
 * ```
 */
export function validateUserInput(input: string, fieldName: string = 'input'): ValidationResult {
  // Check type
  if (typeof input !== 'string') {
    return { valid: false, error: `${fieldName} must be a string` };
  }

  // Trim whitespace
  const trimmed = input.trim();

  // Check minimum length
  if (trimmed.length < INPUT_CONSTRAINTS.MIN_USER_INPUT_LENGTH) {
    return { valid: false, error: `${fieldName} cannot be empty` };
  }

  // Check maximum length (prevents excessive token usage)
  if (trimmed.length > INPUT_CONSTRAINTS.MAX_USER_INPUT_LENGTH) {
    return {
      valid: false,
      error: `${fieldName} too long. Maximum ${INPUT_CONSTRAINTS.MAX_USER_INPUT_LENGTH} characters allowed (received ${trimmed.length})`,
    };
  }

  // Check for suspicious patterns (basic prompt injection detection)
  const suspiciousPatterns = [
    /ignore\s+(all\s+)?(previous|above|prior)\s+instructions/i,
    /disregard\s+(all\s+)?(previous|above|prior)\s+instructions/i,
    /forget\s+(all\s+)?(previous|above|prior)\s+instructions/i,
    /system\s*:\s*/i, // Trying to inject system messages
    /assistant\s*:\s*/i, // Trying to inject assistant messages
    /<\|im_start\|>/i, // ChatML injection
    /<\|im_end\|>/i,
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(trimmed)) {
      console.warn(`⚠️  Potential prompt injection detected: ${trimmed.substring(0, 100)}...`);
      // Log but don't block - could be legitimate conversation about AI
      // return { valid: false, error: 'Input contains suspicious patterns' };
    }
  }

  // Check for excessive special characters (might indicate injection attempt)
  const specialCharCount = (trimmed.match(/[<>{}[\]]/g) || []).length;
  if (specialCharCount > 50) {
    console.warn(`⚠️  Excessive special characters detected: ${specialCharCount}`);
  }

  return { valid: true, sanitized: trimmed };
}

/**
 * Validate protocol slug to prevent path traversal
 *
 * @param slug - Protocol slug to validate (optional)
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const result = validateProtocolSlug(req.body.protocol_slug);
 * if (!result.valid) {
 *   return res.status(400).json({ error: result.error });
 * }
 * ```
 */
export function validateProtocolSlug(slug: string | undefined): ValidationResult {
  if (!slug) {
    return { valid: true }; // Optional field
  }

  if (typeof slug !== 'string') {
    return { valid: false, error: 'protocol_slug must be a string' };
  }

  if (slug.length > INPUT_CONSTRAINTS.MAX_PROTOCOL_SLUG_LENGTH) {
    return { valid: false, error: 'protocol_slug too long' };
  }

  // Only allow alphanumeric, hyphens, and underscores (prevents path traversal)
  if (!/^[a-z0-9_-]+$/i.test(slug)) {
    return {
      valid: false,
      error: 'protocol_slug can only contain letters, numbers, hyphens, and underscores',
    };
  }

  // Prevent path traversal attempts
  if (slug.includes('..') || slug.includes('/') || slug.includes('\\')) {
    return { valid: false, error: 'Invalid protocol_slug format' };
  }

  return { valid: true };
}

/**
 * Validate session ID format
 *
 * @param sessionId - Session ID to validate
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const result = validateSessionId(req.body.session_id);
 * if (!result.valid) {
 *   return res.status(400).json({ error: result.error });
 * }
 * ```
 */
export function validateSessionId(sessionId: string): ValidationResult {
  if (typeof sessionId !== 'string') {
    return { valid: false, error: 'session_id must be a string' };
  }

  if (sessionId.length > INPUT_CONSTRAINTS.MAX_SESSION_ID_LENGTH) {
    return { valid: false, error: 'session_id too long' };
  }

  // UUIDs should be alphanumeric + hyphens
  if (!/^[a-f0-9-]+$/i.test(sessionId)) {
    return { valid: false, error: 'Invalid session_id format' };
  }

  return { valid: true };
}
