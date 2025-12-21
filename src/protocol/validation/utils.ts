/**
 * Validation Utilities
 *
 * Helper functions for normalizing and comparing protocol data
 */

/**
 * Normalize a stone reference for comparison
 * - Converts objects to strings (handles YAML parsing quirks)
 * - Trims whitespace
 * - Collapses consecutive whitespace to single space
 * - Converts to lowercase for case-insensitive matching
 */
export function normalizeStone(stone: unknown): string | null {
  if (typeof stone === 'string') {
    // Already a string, just normalize it
    return normalizeString(stone);
  }

  if (typeof stone === 'object' && stone !== null) {
    // YAML parsed "Stone 4: Title" as { 'Stone 4': 'Title' }
    // Convert back to string format
    const entries = Object.entries(stone);
    if (entries.length === 1) {
      const [key, value] = entries[0];
      const stoneString = `${key}: ${value}`;
      return normalizeString(stoneString);
    }
  }

  // Invalid stone type
  return null;
}

/**
 * Convert a stone to its display string format (for error messages)
 */
export function stoneToString(stone: unknown): string {
  if (typeof stone === 'string') {
    return stone;
  }

  if (typeof stone === 'object' && stone !== null) {
    const entries = Object.entries(stone);
    if (entries.length === 1) {
      const [key, value] = entries[0];
      return `${key}: ${value}`;
    }
  }

  return String(stone);
}

/**
 * Normalize a string for comparison:
 * - Trim whitespace
 * - Collapse consecutive whitespace to single space
 * - Convert to lowercase
 */
export function normalizeString(str: string): string {
  return str.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Check if two stone references match after normalization
 */
export function stonesMatch(stone1: unknown, stone2: unknown): boolean {
  const normalized1 = normalizeStone(stone1);
  const normalized2 = normalizeStone(stone2);

  if (normalized1 === null || normalized2 === null) {
    return false;
  }

  return normalized1 === normalized2;
}
