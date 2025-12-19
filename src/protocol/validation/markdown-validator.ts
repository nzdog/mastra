/**
 * Markdown Structure Validator for Protocol Schema v1
 *
 * Validates markdown structure and extracts themes
 */

import { ProtocolFrontmatter, ValidationError, MarkdownStructure } from './types';

/**
 * Validate markdown structure and extract theme information
 */
export function validateMarkdownStructure(
  frontmatter: ProtocolFrontmatter,
  markdownContent: string
): { errors: ValidationError[]; structure: MarkdownStructure } {
  const errors: ValidationError[] = [];
  const lines = markdownContent.split('\n');

  // Initialize structure
  const structure: MarkdownStructure = {
    hasThemesSection: false,
    entrySectionsFound: [],
    entrySectionsMissing: [],
    duplicateEntrySections: [],
    themes: [],
    themeCount: 0,
  };

  // Find Themes section
  let themesLineIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s+Themes\s*$/i.test(lines[i])) {
      structure.hasThemesSection = true;
      structure.themesHeadingLine = i + 1;
      themesLineIndex = i;
      break;
    }
  }

  // ERROR: Themes section must exist
  if (!structure.hasThemesSection) {
    errors.push({
      severity: 'error',
      message: 'Missing required section: ## Themes',
      suggestion: 'Add "## Themes" section to markdown',
    });
  }

  // Validate entry_sections markers exist and appear before Themes
  if (frontmatter.entry_sections && frontmatter.entry_sections.length > 0) {
    const sectionCounts = new Map<string, number>();

    for (const section of frontmatter.entry_sections) {
      const marker = section.marker;
      const normalizedMarker = marker.toLowerCase().trim();

      // Find occurrences of this marker (case-insensitive)
      let found = false;
      let foundLineIndex = -1;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const normalizedLine = line.toLowerCase();

        if (normalizedLine === normalizedMarker) {
          found = true;
          foundLineIndex = i;

          // Count occurrences
          const count = sectionCounts.get(normalizedMarker) || 0;
          sectionCounts.set(normalizedMarker, count + 1);

          break; // Only check first occurrence for ordering
        }
      }

      if (found) {
        structure.entrySectionsFound.push(marker);

        // ERROR: Entry sections must appear before Themes
        if (themesLineIndex !== -1 && foundLineIndex > themesLineIndex) {
          errors.push({
            severity: 'error',
            message: `Entry section "${marker}" appears after "## Themes" (line ${foundLineIndex + 1})`,
            location: `Line ${foundLineIndex + 1}`,
            suggestion: 'Move entry sections before "## Themes"',
          });
        }
      } else {
        structure.entrySectionsMissing.push(marker);
        errors.push({
          severity: 'error',
          message: `Required entry section not found: "${marker}"`,
          suggestion: `Add "${marker}" heading to markdown`,
        });
      }
    }

    // ERROR: Check for duplicates
    for (const [marker, count] of sectionCounts.entries()) {
      if (count > 1) {
        const originalMarker =
          frontmatter.entry_sections.find((s) => s.marker.toLowerCase().trim() === marker)
            ?.marker || marker;
        structure.duplicateEntrySections.push(originalMarker);
        errors.push({
          severity: 'error',
          message: `Duplicate entry section: "${originalMarker}" appears ${count} times`,
          suggestion: 'Each entry section should appear exactly once',
        });
      }
    }
  }

  // Extract theme count from markdown (theme headings after ## Themes)
  if (structure.hasThemesSection && themesLineIndex !== -1) {
    // Theme heading pattern: ### N. Title, ### N - Title, ### N — Title, ### N) Title
    const themeHeadingPattern = /^###\s+(\d+)[.\-—)]\s+(.+)$/;

    for (let i = themesLineIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();

      // Stop at next ## heading (end of Themes section)
      if (/^##\s+/.test(line)) {
        break;
      }

      const match = line.match(themeHeadingPattern);
      if (match) {
        structure.themeCount++;
      }
    }
  }

  // INFO: Log actual theme count
  if (structure.themeCount > 0) {
    errors.push({
      severity: 'info',
      message: `Found ${structure.themeCount} theme(s) in markdown`,
    });
  }

  // WARNING: Theme count mismatch
  if (
    frontmatter.themes &&
    frontmatter.themes.length > 0 &&
    structure.themeCount !== frontmatter.themes.length
  ) {
    errors.push({
      severity: 'warning',
      message: `Theme count mismatch: frontmatter=${frontmatter.themes.length}, markdown=${structure.themeCount}`,
      suggestion: 'Update frontmatter themes array to match markdown (markdown is authoritative)',
    });
  }

  return { errors, structure };
}
