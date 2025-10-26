/**
 * Canonical JSON Serialization (RFC 8785)
 *
 * Ensures deterministic serialization for cryptographic signatures
 * Phase 1.1: Prevents signature verification failures due to different key ordering
 */

/**
 * Canonicalize a value for deterministic JSON serialization
 * - Objects: Sort keys alphabetically
 * - Arrays: Keep original order
 * - Primitives: Return as-is
 */
function canonicalizeValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(canonicalizeValue);
  }

  // Sort object keys alphabetically
  const sortedKeys = Object.keys(value).sort();
  const canonicalObj: Record<string, unknown> = {};

  for (const key of sortedKeys) {
    canonicalObj[key] = canonicalizeValue((value as Record<string, unknown>)[key]);
  }

  return canonicalObj;
}

/**
 * Canonical JSON stringify (RFC 8785 compatible)
 *
 * Ensures deterministic serialization:
 * 1. Sort object keys alphabetically
 * 2. No whitespace
 * 3. Escape sequences normalized
 * 4. Numbers in standard form
 *
 * @param obj - Object to serialize
 * @returns Canonical JSON string
 *
 * @example
 * ```typescript
 * const obj = { z: 1, a: 2, m: { y: 3, x: 4 } };
 * const canonical = canonicalStringify(obj);
 * // Result: '{"a":2,"m":{"x":4,"y":3},"z":1}'
 * ```
 */
export function canonicalStringify(obj: unknown): string {
  const canonical = canonicalizeValue(obj);
  return JSON.stringify(canonical);
}

/**
 * Compare two objects for canonical equality
 * Uses canonical serialization to ensure consistent comparison
 */
export function canonicalEqual(a: unknown, b: unknown): boolean {
  return canonicalStringify(a) === canonicalStringify(b);
}
