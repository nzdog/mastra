/**
 * Diff Generator
 *
 * Generates line-by-line diff for display
 */

import { NormalizationChange } from './types';

/**
 * Generate formatted diff for terminal display
 */
export function generateDiff(changes: NormalizationChange[]): string {
  if (changes.length === 0) {
    return 'No changes';
  }

  const lines: string[] = [];

  for (const change of changes) {
    if (change.normalized === '(removed)') {
      lines.push(`  Line ${change.lineNumber}: (blank) → (removed)  (${change.description})`);
    } else {
      // Truncate long lines for display
      const originalTrunc =
        change.original.length > 40 ? change.original.substring(0, 37) + '...' : change.original;
      const normalizedTrunc =
        change.normalized.length > 40
          ? change.normalized.substring(0, 37) + '...'
          : change.normalized;

      lines.push(
        `  Line ${change.lineNumber}: "${originalTrunc}" → "${normalizedTrunc}"  (${change.description})`
      );
    }
  }

  return lines.join('\n');
}

/**
 * Generate summary line for changes
 */
export function generateSummary(changeCount: number): string {
  if (changeCount === 0) {
    return 'No formatting issues found';
  } else if (changeCount === 1) {
    return '1 formatting change';
  } else {
    return `${changeCount} formatting changes`;
  }
}
