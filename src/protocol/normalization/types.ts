/**
 * Normalization Types
 *
 * Defines interfaces for normalization operations
 */

export interface NormalizationChange {
  lineNumber: number;
  original: string;
  normalized: string;
  description: string;
}

export interface NormalizationResult {
  hasChanges: boolean;
  changes: NormalizationChange[];
  originalContent: string;
  normalizedContent: string;
  changeCount: number;
}

export interface NormalizationOptions {
  fixWhitespace?: boolean;
  fixBulletSpacing?: boolean;
  fixOutcomesCasing?: boolean;
  fixHeadingSpacing?: boolean;
  formatFrontmatter?: boolean;
}
