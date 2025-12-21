/**
 * Protocol Validator - Main Orchestrator
 *
 * Validates protocol files against Schema v1
 */

import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import { ProtocolFrontmatter, ValidationResult, ValidationError } from './types';
import { validateFrontmatter } from './frontmatter-validator';
import { validateMarkdownStructure } from './markdown-validator';
import { validateThemes } from './theme-validator';

export class ProtocolValidator {
  /**
   * Validate a single protocol file by path
   * Returns validation result with errors/warnings/info
   * Used by ProtocolLoader to filter protocols at discovery time
   */
  public validateFile(filePath: string): ValidationResult {
    const filename = path.basename(filePath);
    const result: ValidationResult = {
      filename,
      filePath,
      hasErrors: false,
      hasWarnings: false,
      errors: [],
      warnings: [],
      info: [],
      errorCount: 0,
      warningCount: 0,
      infoCount: 0,
    };

    try {
      // Read file
      if (!fs.existsSync(filePath)) {
        result.errors.push({
          severity: 'error',
          message: `File not found: ${filePath}`,
        });
        result.hasErrors = true;
        result.errorCount = 1;
        return result;
      }

      const fileContent = fs.readFileSync(filePath, 'utf-8').trim();

      // Check for empty files
      if (fileContent.length === 0) {
        result.errors.push({
          severity: 'error',
          message: 'File is empty',
          suggestion: 'Add protocol content with YAML frontmatter and markdown sections',
        });
        result.hasErrors = true;
        result.errorCount = 1;
        return result;
      }

      // Parse frontmatter
      let frontmatter: ProtocolFrontmatter;
      let markdownContent: string;

      try {
        const parsed = matter(fileContent);

        // Runtime type validation for frontmatter
        const data = parsed.data;
        if (data.schema_version !== undefined && typeof data.schema_version !== 'number') {
          throw new Error('schema_version must be a number');
        }
        if (data.id !== undefined && typeof data.id !== 'string') {
          throw new Error('id must be a string');
        }
        if (data.title !== undefined && typeof data.title !== 'string') {
          throw new Error('title must be a string');
        }
        if (data.version !== undefined && typeof data.version !== 'string') {
          throw new Error('version must be a string');
        }
        if (data.entry_keys !== undefined && !Array.isArray(data.entry_keys)) {
          throw new Error('entry_keys must be an array');
        }
        if (data.entry_sections !== undefined && !Array.isArray(data.entry_sections)) {
          throw new Error('entry_sections must be an array');
        }
        if (data.themes !== undefined && !Array.isArray(data.themes)) {
          throw new Error('themes must be an array');
        }
        if (data.stones !== undefined && !Array.isArray(data.stones)) {
          throw new Error('stones must be an array');
        }

        frontmatter = data as ProtocolFrontmatter;
        markdownContent = parsed.content;
      } catch (error) {
        result.errors.push({
          severity: 'error',
          message: `Failed to parse YAML frontmatter: ${error instanceof Error ? error.message : String(error)}`,
          suggestion: 'Check YAML syntax and data types in frontmatter',
        });
        result.hasErrors = true;
        result.errorCount = 1;
        return result;
      }

      // Run validators
      const allErrors: ValidationError[] = [];

      // 1. Frontmatter validation
      const frontmatterErrors = validateFrontmatter(frontmatter, filePath, markdownContent);
      allErrors.push(...frontmatterErrors);

      // 2. Markdown structure validation
      const { errors: markdownErrors, structure } = validateMarkdownStructure(
        frontmatter,
        markdownContent
      );
      allErrors.push(...markdownErrors);

      // 3. Theme validation (only if Themes section exists)
      if (structure.hasThemesSection) {
        const { errors: themeErrors } = validateThemes(frontmatter, markdownContent);
        allErrors.push(...themeErrors);
      }

      // Categorize errors by severity
      for (const error of allErrors) {
        if (error.severity === 'error') {
          result.errors.push(error);
        } else if (error.severity === 'warning') {
          result.warnings.push(error);
        } else if (error.severity === 'info') {
          result.info.push(error);
        }
      }

      // Set counts and flags
      result.errorCount = result.errors.length;
      result.warningCount = result.warnings.length;
      result.infoCount = result.info.length;
      result.hasErrors = result.errorCount > 0;
      result.hasWarnings = result.warningCount > 0;
    } catch (error) {
      // Unexpected error during validation
      result.errors.push({
        severity: 'error',
        message: `Unexpected validation error: ${error instanceof Error ? error.message : String(error)}`,
      });
      result.hasErrors = true;
      result.errorCount = 1;
    }

    return result;
  }

  /**
   * Validate all protocols in a directory
   * Returns array of results (for CLI and startup validation)
   */
  public validateDirectory(dirPath: string): ValidationResult[] {
    const results: ValidationResult[] = [];

    try {
      if (!fs.existsSync(dirPath)) {
        throw new Error(`Directory not found: ${dirPath}`);
      }

      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        // Only process regular files (not directories or symlinks)
        if (!entry.isFile()) {
          continue;
        }

        // Only process .md files, skip template and README
        if (
          !entry.name.endsWith('.md') ||
          entry.name === 'PROTOCOL_TEMPLATE.md' ||
          entry.name === 'README.md'
        ) {
          continue;
        }

        const filePath = path.join(dirPath, entry.name);
        const result = this.validateFile(filePath);
        results.push(result);
      }
    } catch (error) {
      // Error reading directory
      results.push({
        filename: 'DIRECTORY_ERROR',
        filePath: dirPath,
        hasErrors: true,
        hasWarnings: false,
        errors: [
          {
            severity: 'error',
            message: `Failed to read directory: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        warnings: [],
        info: [],
        errorCount: 1,
        warningCount: 0,
        infoCount: 0,
      });
    }

    return results;
  }
}
