/**
 * Protocol Normalizer
 *
 * Safe, idempotent normalization with backup/diff
 */

import * as fs from 'fs';
//import * as path from 'path';
import { NormalizationResult, NormalizationOptions, NormalizationChange } from './types';
import {
  normalizeWhitespace,
  normalizeBulletSpacing,
  normalizeOutcomesCasing,
} from './whitespace-normalizer';

export class ProtocolNormalizer {
  /**
   * Normalize a protocol file (in-memory only, no file modification)
   * Returns normalized content and list of changes
   */
  public normalizeContent(
    content: string,
    options: NormalizationOptions = {}
  ): NormalizationResult {
    const {
      fixWhitespace = true,
      fixBulletSpacing = true,
      fixOutcomesCasing = true,
      formatFrontmatter = false,
    } = options;

    let normalized = content;
    const allChanges: NormalizationChange[] = [];

    // Apply normalizations in order

    if (fixWhitespace) {
      const { normalized: n1, changes: c1 } = normalizeWhitespace(normalized);
      normalized = n1;
      allChanges.push(...c1);
    }

    if (fixBulletSpacing) {
      const { normalized: n2, changes: c2 } = normalizeBulletSpacing(normalized);
      normalized = n2;
      allChanges.push(...c2);
    }

    if (fixOutcomesCasing) {
      const { normalized: n3, changes: c3 } = normalizeOutcomesCasing(normalized);
      normalized = n3;
      allChanges.push(...c3);
    }

    if (formatFrontmatter) {
      // STUB: Frontmatter formatting not implemented (preserves comments)
      console.warn('⚠️  Frontmatter reformatting will remove comments and custom ordering');
      console.warn('   Use --format-frontmatter to apply (not recommended unless necessary)');
      // For now, do nothing - frontmatter formatting is optional and not implemented
    }

    return {
      hasChanges: allChanges.length > 0,
      changes: allChanges,
      originalContent: content,
      normalizedContent: normalized,
      changeCount: allChanges.length,
    };
  }

  /**
   * Normalize a file and write changes (with backup)
   * Returns true if changes were applied, false otherwise
   */
  public normalizeFile(
    filePath: string,
    options: NormalizationOptions = {},
    dryRun = false
  ): { success: boolean; result: NormalizationResult; backupPath?: string; error?: string } {
    try {
      // Read file
      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          result: {
            hasChanges: false,
            changes: [],
            originalContent: '',
            normalizedContent: '',
            changeCount: 0,
          },
          error: `File not found: ${filePath}`,
        };
      }

      const content = fs.readFileSync(filePath, 'utf-8');

      // Normalize content
      const result = this.normalizeContent(content, options);

      // If no changes, return early
      if (!result.hasChanges) {
        return { success: true, result };
      }

      // Dry run - don't modify file
      if (dryRun) {
        return { success: true, result };
      }

      // Create backup
      const backupPath = `${filePath}.backup`;
      fs.writeFileSync(backupPath, content, 'utf-8');

      // Write normalized content
      fs.writeFileSync(filePath, result.normalizedContent, 'utf-8');

      return { success: true, result, backupPath };
    } catch (error) {
      return {
        success: false,
        result: {
          hasChanges: false,
          changes: [],
          originalContent: '',
          normalizedContent: '',
          changeCount: 0,
        },
        error: `Failed to normalize file: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Restore file from backup
   */
  public restoreFromBackup(filePath: string): { success: boolean; error?: string } {
    try {
      const backupPath = `${filePath}.backup`;

      if (!fs.existsSync(backupPath)) {
        return {
          success: false,
          error: `Backup not found: ${backupPath}`,
        };
      }

      const backupContent = fs.readFileSync(backupPath, 'utf-8');
      fs.writeFileSync(filePath, backupContent, 'utf-8');

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to restore backup: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
