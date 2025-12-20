/**
 * Frontmatter Validator for Protocol Schema v1
 *
 * Validates YAML frontmatter against required schema
 */

import { ProtocolFrontmatter, ValidationError } from './types';
import { normalizeStone, stoneToString } from './utils';
import * as path from 'path';

/**
 * Validate protocol frontmatter (YAML)
 */
export function validateFrontmatter(
  frontmatter: ProtocolFrontmatter,
  filePath: string,
  markdownContent: string
): ValidationError[] {
  const errors: ValidationError[] = [];
  const filename = path.basename(filePath, '.md');

  // ERROR: schema_version required and must be 1
  if (!frontmatter.schema_version) {
    errors.push({
      severity: 'error',
      message: 'Missing required field: schema_version',
      field: 'schema_version',
      suggestion: 'Add "schema_version: 1" to YAML frontmatter',
    });
  } else if (frontmatter.schema_version !== 1) {
    errors.push({
      severity: 'error',
      message: `Invalid schema_version: ${frontmatter.schema_version} (expected: 1)`,
      field: 'schema_version',
      suggestion: 'Change to "schema_version: 1"',
    });
  }

  // ERROR: id required and must be lowercase_with_underscores
  if (!frontmatter.id) {
    errors.push({
      severity: 'error',
      message: 'Missing required field: id',
      field: 'id',
      suggestion: 'Add "id: your_protocol_name" to YAML frontmatter',
    });
  } else {
    // Check format: lowercase_with_underscores
    const validIdPattern = /^[a-z][a-z0-9_]*$/;
    if (!validIdPattern.test(frontmatter.id)) {
      errors.push({
        severity: 'error',
        message: `Invalid id format: "${frontmatter.id}" (must be lowercase_with_underscores)`,
        field: 'id',
        suggestion:
          'Use lowercase letters, numbers, and underscores only (e.g., "my_protocol_name")',
      });
    }

    // WARNING: id should match filename
    if (frontmatter.id !== filename) {
      errors.push({
        severity: 'warning',
        message: `ID mismatch: frontmatter id="${frontmatter.id}" but filename="${filename}"`,
        field: 'id',
        suggestion: `Consider renaming file to "${frontmatter.id}.md" or updating id to "${filename}"`,
      });
    }
  }

  // ERROR: title required and non-empty
  if (!frontmatter.title) {
    errors.push({
      severity: 'error',
      message: 'Missing required field: title',
      field: 'title',
      suggestion: 'Add "title: Your Protocol Title" to YAML frontmatter',
    });
  } else if (frontmatter.title.trim() === '') {
    errors.push({
      severity: 'error',
      message: 'Title cannot be empty',
      field: 'title',
      suggestion: 'Provide a meaningful protocol title',
    });
  }

  // ERROR: version required and must follow semver (X.Y.Z)
  if (!frontmatter.version) {
    errors.push({
      severity: 'error',
      message: 'Missing required field: version',
      field: 'version',
      suggestion: 'Add "version: 1.0.0" to YAML frontmatter',
    });
  } else {
    const semverPattern = /^\d+\.\d+\.\d+$/;
    if (!semverPattern.test(frontmatter.version)) {
      errors.push({
        severity: 'error',
        message: `Invalid version format: "${frontmatter.version}" (must be X.Y.Z)`,
        field: 'version',
        suggestion: 'Use semantic versioning format (e.g., "1.0.0")',
      });
    }
  }

  // WARNING: entry_keys (legacy field, informational)
  if (!frontmatter.entry_keys || frontmatter.entry_keys.length === 0) {
    errors.push({
      severity: 'warning',
      message: 'Missing legacy field: entry_keys',
      field: 'entry_keys',
      suggestion: 'Add entry_keys array (informational only)',
    });
  }

  // ERROR: entry_sections required with valid structure
  if (!frontmatter.entry_sections || frontmatter.entry_sections.length === 0) {
    errors.push({
      severity: 'error',
      message: 'Missing required field: entry_sections',
      field: 'entry_sections',
      suggestion: 'Add entry_sections array defining required top-level sections',
    });
  } else {
    // Validate each entry section has title and marker
    frontmatter.entry_sections.forEach((section, idx) => {
      if (!section.title) {
        errors.push({
          severity: 'error',
          message: `entry_sections[${idx}]: Missing title`,
          field: 'entry_sections',
          suggestion: 'Each entry section must have a title field',
        });
      }
      if (!section.marker) {
        errors.push({
          severity: 'error',
          message: `entry_sections[${idx}]: Missing marker`,
          field: 'entry_sections',
          suggestion: 'Each entry section must have a marker field (e.g., "## Purpose")',
        });
      } else {
        // ERROR: Verify marker exists in markdown (case-insensitive)
        const markerRegex = new RegExp(
          `^${section.marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`,
          'im'
        );
        if (!markerRegex.test(markdownContent)) {
          errors.push({
            severity: 'error',
            message: `entry_sections[${idx}]: Marker "${section.marker}" not found in markdown`,
            field: 'entry_sections',
            suggestion: `Add "${section.marker}" heading to markdown or update marker in frontmatter`,
          });
        }
      }
    });
  }

  // WARNING: themes (optional metadata; markdown is authoritative)
  if (!frontmatter.themes || frontmatter.themes.length === 0) {
    errors.push({
      severity: 'warning',
      message: 'Missing optional field: themes',
      field: 'themes',
      suggestion: 'Add themes array for metadata (markdown structure is authoritative)',
    });
  } else {
    // INFO: Check sequential indexing (1, 2, 3...)
    frontmatter.themes.forEach((theme, idx) => {
      const expectedIndex = idx + 1;
      if (theme.index !== expectedIndex) {
        errors.push({
          severity: 'info',
          message: `themes[${idx}]: Non-sequential index (expected ${expectedIndex}, got ${theme.index})`,
          field: 'themes',
          suggestion: 'Theme indices should be sequential (1, 2, 3...)',
        });
      }
    });
  }

  // INFO: stones (optional; stone references informational)
  if (
    !frontmatter.stones ||
    !Array.isArray(frontmatter.stones) ||
    frontmatter.stones.length === 0
  ) {
    errors.push({
      severity: 'info',
      message: 'Missing optional field: stones',
      field: 'stones',
      suggestion: 'Add stones array if protocol references stones (format: "Stone N: Title")',
    });
  } else {
    // INFO: Check format "Stone N: Title"
    const stonePattern = /^Stone\s+\d+:\s+.+$/;
    frontmatter.stones.forEach((stone, idx) => {
      // Normalize stone (handles both strings and objects from YAML parsing)
      const normalized = normalizeStone(stone);

      if (normalized === null) {
        // Truly invalid stone type
        errors.push({
          severity: 'info',
          message: `stones[${idx}]: Invalid type (expected string or valid stone object)`,
          field: 'stones',
          suggestion:
            'Each stone should be a string in format "Stone N: Title" (use quotes in YAML to ensure proper parsing)',
        });
        return;
      }

      // Convert to display format for validation
      const stoneString = stoneToString(stone);

      if (!stonePattern.test(stoneString)) {
        errors.push({
          severity: 'info',
          message: `stones[${idx}]: Non-standard format: "${stoneString}"`,
          field: 'stones',
          suggestion:
            'Recommended format: "Stone N: Title" (use quotes in YAML: - "Stone N: Title")',
        });
      }
    });
  }

  return errors;
}
