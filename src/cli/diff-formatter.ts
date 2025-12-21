/**
 * Diff Formatter
 *
 * Colorized diff formatting for CLI
 */

import { NormalizationChange } from '../protocol/normalization/types';
import { colors } from './cli-utils';

/**
 * Format diff for terminal display with colors
 */
export function formatDiff(changes: NormalizationChange[]): string {
  if (changes.length === 0) {
    return `${colors.green}No changes needed${colors.reset}`;
  }

  const lines: string[] = [];
  lines.push(''); // Blank line before changes

  for (const change of changes) {
    if (change.normalized === '(removed)') {
      lines.push(
        `  ${colors.gray}Line ${change.lineNumber}:${colors.reset} ${colors.red}(blank)${colors.reset} → ${colors.green}(removed)${colors.reset}  ${colors.gray}(${change.description})${colors.reset}`
      );
    } else {
      // Show original and normalized
      const originalDisplay = change.original.trim() === '' ? '(blank)' : `"${change.original}"`;
      const normalizedDisplay =
        change.normalized.trim() === '' ? '(blank)' : `"${change.normalized}"`;

      lines.push(
        `  ${colors.gray}Line ${change.lineNumber}:${colors.reset} ${colors.red}${originalDisplay}${colors.reset} → ${colors.green}${normalizedDisplay}${colors.reset}  ${colors.gray}(${change.description})${colors.reset}`
      );
    }
  }

  lines.push(''); // Blank line after changes
  return lines.join('\n');
}

/**
 * Format summary of changes
 */
export function formatSummary(changeCount: number): string {
  if (changeCount === 0) {
    return `${colors.green}✅ No formatting issues found${colors.reset}`;
  } else if (changeCount === 1) {
    return `${colors.yellow}ℹ️  Found 1 auto-fixable formatting issue${colors.reset}`;
  } else {
    return `${colors.yellow}ℹ️  Found ${changeCount} auto-fixable formatting issues${colors.reset}`;
  }
}
