/**
 * Validation Types for Protocol Schema v1
 *
 * Defines interfaces for validation results, errors, and schema components
 */

/**
 * Severity levels for validation issues
 */
export type ValidationSeverity = 'error' | 'warning' | 'info';

/**
 * Individual validation error/warning/info message
 */
export interface ValidationError {
  severity: ValidationSeverity;
  message: string;
  location?: string;
  suggestion?: string;
  field?: string;
}

/**
 * Validation result for a single protocol file
 */
export interface ValidationResult {
  filename: string;
  filePath: string;
  hasErrors: boolean;
  hasWarnings: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  info: ValidationError[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
}

/**
 * Protocol frontmatter schema (v1)
 */
export interface ProtocolFrontmatter {
  schema_version?: number;
  id?: string;
  title?: string;
  version?: string;
  entry_keys?: string[];
  entry_sections?: Array<{
    title: string;
    marker: string;
  }>;
  themes?: Array<{
    index: number;
    title: string;
  }>;
  stones?: string[];
}

/**
 * Theme structure extracted from markdown
 */
export interface ThemeStructure {
  index: number;
  title: string;
  headingLine: number;
  stoneReference?: string;
  hasPurpose: boolean;
  hasWhyMatters: boolean;
  hasOutcomes: boolean;
  outcomesTiers: string[];
  hasGuidingQuestions: boolean;
  guidingQuestionsCount: number;
  hasCompletionPrompt: boolean;
}

/**
 * Markdown structure analysis
 */
export interface MarkdownStructure {
  hasThemesSection: boolean;
  themesHeadingLine?: number;
  entrySectionsFound: string[];
  entrySectionsMissing: string[];
  duplicateEntrySections: string[];
  themes: ThemeStructure[];
  themeCount: number;
}
