/**
 * Theme Content Validator for Protocol Schema v1
 *
 * Validates theme semantic fields using line-based parsing
 */

import { ProtocolFrontmatter, ValidationError, ThemeStructure } from './types';

/**
 * Validate theme content and structure
 */
export function validateThemes(
  frontmatter: ProtocolFrontmatter,
  markdownContent: string
): { errors: ValidationError[]; themes: ThemeStructure[] } {
  const errors: ValidationError[] = [];
  const themes: ThemeStructure[] = [];
  const lines = markdownContent.split('\n');

  // Find Themes section first
  let themesStartIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s+Themes\s*$/i.test(lines[i])) {
      themesStartIndex = i;
      break;
    }
  }

  if (themesStartIndex === -1) {
    // No Themes section - error already reported by markdown validator
    return { errors, themes };
  }

  // Extract theme blocks
  const themeBlocks = extractThemeBlocks(lines, themesStartIndex);

  // Validate each theme
  themeBlocks.forEach((block, idx) => {
    const themeErrors = validateThemeBlock(block, idx, frontmatter);
    errors.push(...themeErrors.errors);
    themes.push(themeErrors.theme);
  });

  return { errors, themes };
}

/**
 * Extract theme blocks from markdown
 */
function extractThemeBlocks(
  lines: string[],
  themesStartIndex: number
): Array<{ startLine: number; endLine: number; lines: string[] }> {
  const blocks: Array<{ startLine: number; endLine: number; lines: string[] }> = [];
  const themeHeadingPattern = /^###\s+(\d+)[.\-—)]\s+(.+)$/;

  let currentBlockStart = -1;

  for (let i = themesStartIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();

    // Stop at next ## heading (end of Themes section)
    if (/^##\s+/.test(line)) {
      if (currentBlockStart !== -1) {
        blocks.push({
          startLine: currentBlockStart,
          endLine: i - 1,
          lines: lines.slice(currentBlockStart, i),
        });
      }
      break;
    }

    // Check for theme heading
    if (themeHeadingPattern.test(line)) {
      // Save previous block
      if (currentBlockStart !== -1) {
        blocks.push({
          startLine: currentBlockStart,
          endLine: i - 1,
          lines: lines.slice(currentBlockStart, i),
        });
      }
      currentBlockStart = i;
    }
  }

  // Save last block
  if (currentBlockStart !== -1) {
    blocks.push({
      startLine: currentBlockStart,
      endLine: lines.length - 1,
      lines: lines.slice(currentBlockStart),
    });
  }

  return blocks;
}

/**
 * Validate a single theme block
 */
function validateThemeBlock(
  block: { startLine: number; endLine: number; lines: string[] },
  expectedIndex: number,
  frontmatter: ProtocolFrontmatter
): { errors: ValidationError[]; theme: ThemeStructure } {
  const errors: ValidationError[] = [];
  const themeNum = expectedIndex + 1;

  // Initialize theme structure
  const theme: ThemeStructure = {
    index: themeNum,
    title: '',
    headingLine: block.startLine + 1,
    hasPurpose: false,
    hasWhyMatters: false,
    hasOutcomes: false,
    outcomesTiers: [],
    hasGuidingQuestions: false,
    guidingQuestionsCount: 0,
    hasCompletionPrompt: false,
  };

  if (block.lines.length === 0) {
    errors.push({
      severity: 'error',
      message: `Theme ${themeNum}: Empty theme block`,
      location: `Line ${block.startLine + 1}`,
    });
    return { errors, theme };
  }

  // Parse heading
  const headingLine = block.lines[0].trim();
  const themeHeadingPattern = /^###\s+(\d+)[.\-—)]\s+(.+)$/;
  const headingMatch = headingLine.match(themeHeadingPattern);

  if (!headingMatch) {
    errors.push({
      severity: 'error',
      message: `Theme ${themeNum}: Invalid heading format`,
      location: `Line ${block.startLine + 1}`,
      suggestion: 'Use format: "### N. Theme Title" or "### N - Theme Title"',
    });
    return { errors, theme };
  }

  const parsedIndex = parseInt(headingMatch[1], 10);
  const titleWithStone = headingMatch[2];

  // ERROR: Sequential numbering
  if (parsedIndex !== themeNum) {
    errors.push({
      severity: 'error',
      message: `Theme ${themeNum}: Non-sequential index (expected ${themeNum}, got ${parsedIndex})`,
      location: `Line ${block.startLine + 1}`,
      suggestion: `Change theme number to ${themeNum}`,
    });
  }

  theme.index = parsedIndex;

  // Extract title and stone reference
  const stonePattern = /^(.+?)\s*_\((.+?)\)_\s*$/;
  const stoneMatch = titleWithStone.match(stonePattern);

  if (stoneMatch) {
    theme.title = stoneMatch[1].trim();
    theme.stoneReference = stoneMatch[2].trim();

    // WARNING: Stone reference should match stones array
    if (frontmatter.stones && Array.isArray(frontmatter.stones) && frontmatter.stones.length > 0) {
      const stoneReferenceNormalized = theme.stoneReference.toLowerCase();
      const stonesMatch = frontmatter.stones.some((stone) => {
        // Type guard: ensure stone is a string
        if (typeof stone !== 'string') {
          return false;
        }
        return stone.toLowerCase().includes(stoneReferenceNormalized);
      });

      if (!stonesMatch) {
        errors.push({
          severity: 'warning',
          message: `Theme ${themeNum}: Stone reference "${theme.stoneReference}" does not match any stone in frontmatter`,
          location: `Line ${block.startLine + 1}`,
          suggestion: 'Add matching stone to frontmatter stones array',
        });
      }
    }
  } else {
    theme.title = titleWithStone.trim();
    // INFO: Stone reference missing (optional)
    errors.push({
      severity: 'info',
      message: `Theme ${themeNum}: No stone reference in heading (optional)`,
      location: `Line ${block.startLine + 1}`,
    });
  }

  // Parse theme content (semantic fields)
  const content = block.lines.slice(1); // Skip heading
  const semanticFields = parseSemanticFields(content);

  // Validate required semantic fields
  theme.hasPurpose = semanticFields.has('purpose');
  theme.hasWhyMatters = semanticFields.has('why_matters');
  theme.hasOutcomes = semanticFields.has('outcomes');
  theme.hasGuidingQuestions = semanticFields.has('guiding_questions');
  theme.hasCompletionPrompt = semanticFields.has('completion_prompt');

  // ERROR: Purpose required
  if (!theme.hasPurpose) {
    errors.push({
      severity: 'error',
      message: `Theme ${themeNum}: Missing semantic field "Purpose"`,
      location: `After line ${block.startLine + 1}`,
      suggestion: 'Add Purpose field (flexible formatting accepted)',
    });
  }

  // ERROR: Why this matters required
  if (!theme.hasWhyMatters) {
    errors.push({
      severity: 'error',
      message: `Theme ${themeNum}: Missing semantic field "Why this matters"`,
      location: `After line ${block.startLine + 1}`,
      suggestion: 'Add "Why this matters" field (flexible formatting accepted)',
    });
  }

  // ERROR: Outcomes required
  if (!theme.hasOutcomes) {
    errors.push({
      severity: 'error',
      message: `Theme ${themeNum}: Missing semantic field "Outcomes"`,
      location: `After line ${block.startLine + 1}`,
      suggestion: 'Add Outcomes field with 4 tiers (Poor, Expected, Excellent, Transcendent)',
    });
  } else {
    // Parse outcomes tiers
    const outcomesTiers = parseOutcomesTiers(content);
    theme.outcomesTiers = outcomesTiers;

    // ERROR: Must have exactly 4 tiers
    if (outcomesTiers.length !== 4) {
      errors.push({
        severity: 'error',
        message: `Theme ${themeNum}: Outcomes must have exactly 4 tiers (found ${outcomesTiers.length})`,
        location: `After line ${block.startLine + 1}`,
        suggestion: 'Add tiers: Poor, Expected, Excellent, Transcendent',
      });
    } else {
      // INFO: Validate tier names (case-insensitive)
      const expectedTiers = ['poor', 'expected', 'excellent', 'transcendent'];
      const normalizedTiers = outcomesTiers.map((t) => t.toLowerCase());

      expectedTiers.forEach((expected) => {
        if (!normalizedTiers.includes(expected)) {
          errors.push({
            severity: 'info',
            message: `Theme ${themeNum}: Missing outcomes tier: "${expected}" (case-insensitive matching)`,
            suggestion: `Add tier: ${expected.charAt(0).toUpperCase() + expected.slice(1)}`,
          });
        }
      });
    }
  }

  // ERROR: Guiding Questions required
  if (!theme.hasGuidingQuestions) {
    errors.push({
      severity: 'error',
      message: `Theme ${themeNum}: Missing semantic field "Guiding Questions"`,
      location: `After line ${block.startLine + 1}`,
      suggestion: 'Add Guiding Questions field with at least 3 questions',
    });
  } else {
    // Count guiding questions
    const questionsCount = countGuidingQuestions(content);
    theme.guidingQuestionsCount = questionsCount;

    // ERROR: At least 3 questions required
    if (questionsCount < 3) {
      errors.push({
        severity: 'error',
        message: `Theme ${themeNum}: Guiding Questions must have at least 3 questions (found ${questionsCount})`,
        location: `After line ${block.startLine + 1}`,
        suggestion: 'Add more guiding questions (minimum 3)',
      });
    }
  }

  // ERROR: Completion Prompt required
  if (!theme.hasCompletionPrompt) {
    errors.push({
      severity: 'error',
      message: `Theme ${themeNum}: Missing semantic field "Completion Prompt"`,
      location: `After line ${block.startLine + 1}`,
      suggestion: 'Add Completion Prompt field (flexible formatting accepted)',
    });
  }

  return { errors, theme };
}

/**
 * Parse semantic fields from theme content
 * Returns a set of field names found (normalized)
 */
function parseSemanticFields(content: string[]): Set<string> {
  const fields = new Set<string>();

  for (const line of content) {
    const trimmed = line.trim();
    const normalized = trimmed.toLowerCase();

    // Remove bold/italic markers
    const clean = normalized.replace(/\*\*/g, '').replace(/\*/g, '').replace(/_/g, '');

    // Check for field labels (case-insensitive, flexible formatting)
    if (clean.startsWith('purpose:') || clean === 'purpose') {
      fields.add('purpose');
    } else if (
      clean.startsWith('why this matters:') ||
      clean === 'why this matters' ||
      clean.startsWith('why it matters:')
    ) {
      fields.add('why_matters');
    } else if (clean.startsWith('outcomes:') || clean === 'outcomes') {
      fields.add('outcomes');
    } else if (
      clean.startsWith('guiding questions:') ||
      clean === 'guiding questions' ||
      clean.startsWith('questions:')
    ) {
      fields.add('guiding_questions');
    } else if (
      clean.startsWith('completion prompt:') ||
      clean === 'completion prompt' ||
      clean.startsWith('prompt:')
    ) {
      fields.add('completion_prompt');
    }
  }

  return fields;
}

/**
 * Parse outcomes tiers from theme content
 * Returns array of tier names found
 */
function parseOutcomesTiers(content: string[]): string[] {
  const tiers: string[] = [];
  let inOutcomesSection = false;

  for (const line of content) {
    const trimmed = line.trim();
    const normalized = trimmed.toLowerCase();
    const clean = normalized.replace(/\*\*/g, '').replace(/\*/g, '').replace(/_/g, '');

    // Start of outcomes section
    if (clean.startsWith('outcomes:') || clean === 'outcomes') {
      inOutcomesSection = true;
      continue;
    }

    // End of outcomes section (next field or separator)
    if (
      inOutcomesSection &&
      (clean.startsWith('guiding questions:') ||
        clean.startsWith('completion prompt:') ||
        clean === '---')
    ) {
      inOutcomesSection = false;
      break;
    }

    // Parse tier bullets (e.g., "- Poor:", "- poor:", "- **Poor:**")
    if (inOutcomesSection && trimmed.startsWith('-')) {
      const bulletContent = trimmed.substring(1).trim();
      const tierMatch = bulletContent.match(/^(\*\*)?([a-zA-Z]+)(\*\*)?:/);
      if (tierMatch) {
        tiers.push(tierMatch[2]);
      }
    }
  }

  return tiers;
}

/**
 * Count guiding questions bullets
 */
function countGuidingQuestions(content: string[]): number {
  let count = 0;
  let inQuestionsSection = false;

  for (const line of content) {
    const trimmed = line.trim();
    const normalized = trimmed.toLowerCase();
    const clean = normalized.replace(/\*\*/g, '').replace(/\*/g, '').replace(/_/g, '');

    // Start of guiding questions section
    if (
      clean.startsWith('guiding questions:') ||
      clean === 'guiding questions' ||
      clean.startsWith('questions:')
    ) {
      inQuestionsSection = true;
      continue;
    }

    // End of guiding questions section
    if (
      inQuestionsSection &&
      (clean.startsWith('completion prompt:') || clean === '---')
    ) {
      inQuestionsSection = false;
      break;
    }

    // Count bullet points
    if (inQuestionsSection && trimmed.startsWith('-')) {
      count++;
    }
  }

  return count;
}
