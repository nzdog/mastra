/**
 * Whitespace Normalizer
 *
 * Mechanical whitespace fixes (idempotent)
 */

import { NormalizationChange } from './types';

/**
 * Normalize whitespace in protocol content
 * - Trim trailing whitespace
 * - Collapse multiple consecutive blank lines to single blank
 * - Normalize heading spacing (1 space after ##)
 */
export function normalizeWhitespace(content: string): {
  normalized: string;
  changes: NormalizationChange[];
} {
  const lines = content.split('\n');
  const normalized: string[] = [];
  const changes: NormalizationChange[] = [];

  let previousBlank = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const lineNumber = i + 1;
    let changed = false;
    let description = '';

    // 1. Trim trailing whitespace
    const trimmedLine = line.replace(/\s+$/, '');
    if (trimmedLine !== line) {
      changed = true;
      description = 'trailing whitespace';
      line = trimmedLine;
    }

    // 2. Normalize heading spacing (##<space>Title -> ## Title)
    const headingMatch = line.match(/^(#{2,})\s*(.+)$/);
    if (headingMatch) {
      const hashes = headingMatch[1];
      const title = headingMatch[2];
      const normalized = `${hashes} ${title}`;
      if (normalized !== line) {
        changes.push({
          lineNumber,
          original: lines[i],
          normalized,
          description: 'heading spacing',
        });
        line = normalized;
        changed = true;
      }
    }

    // 3. Collapse multiple consecutive blank lines
    const isBlank = line.trim() === '';
    if (isBlank && previousBlank) {
      // Skip this blank line (collapse)
      changes.push({
        lineNumber,
        original: lines[i],
        normalized: '(removed)',
        description: 'extra blank line',
      });
      continue;
    }

    previousBlank = isBlank;

    // Record change if line was modified
    if (changed && description) {
      changes.push({
        lineNumber,
        original: lines[i],
        normalized: line,
        description,
      });
    }

    normalized.push(line);
  }

  return {
    normalized: normalized.join('\n'),
    changes,
  };
}

/**
 * Normalize bullet spacing (- <space>content)
 */
export function normalizeBulletSpacing(content: string): {
  normalized: string;
  changes: NormalizationChange[];
} {
  const lines = content.split('\n');
  const normalized: string[] = [];
  const changes: NormalizationChange[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const lineNumber = i + 1;

    // Match bullet points: -<whitespace>content
    const bulletMatch = line.match(/^(\s*)-\s*(.*)$/);
    if (bulletMatch) {
      const indent = bulletMatch[1];
      const content = bulletMatch[2];
      const normalized = `${indent}- ${content}`;

      if (normalized !== line) {
        changes.push({
          lineNumber,
          original: line,
          normalized,
          description: 'bullet spacing',
        });
        line = normalized;
      }
    }

    normalized.push(line);
  }

  return {
    normalized: normalized.join('\n'),
    changes,
  };
}

/**
 * Normalize outcomes tier casing (- poor: -> - Poor:)
 * Only normalizes tier labels at start of bullet, preserves rest of content
 */
export function normalizeOutcomesCasing(content: string): {
  normalized: string;
  changes: NormalizationChange[];
} {
  const lines = content.split('\n');
  const normalized: string[] = [];
  const changes: NormalizationChange[] = [];

  const tiers = ['poor', 'expected', 'excellent', 'transcendent'];
  let inOutcomesSection = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const lineNumber = i + 1;
    const trimmed = line.trim().toLowerCase();

    // Detect outcomes section start
    if (trimmed.startsWith('outcomes:') || trimmed === 'outcomes') {
      inOutcomesSection = true;
      normalized.push(line);
      continue;
    }

    // Detect outcomes section end
    if (
      inOutcomesSection &&
      (trimmed.startsWith('guiding questions:') ||
        trimmed.startsWith('completion prompt:') ||
        trimmed === '---')
    ) {
      inOutcomesSection = false;
    }

    // Normalize tier labels in outcomes section
    if (inOutcomesSection && line.trim().startsWith('-')) {
      const bulletMatch = line.match(/^(\s*-\s*)(\*\*)?([a-zA-Z]+)(\*\*)?:(.*)$/i);
      if (bulletMatch) {
        const prefix = bulletMatch[1]; // "- "
        const boldStart = bulletMatch[2] || ''; // "**" or ""
        const tier = bulletMatch[3]; // tier name
        const boldEnd = bulletMatch[4] || ''; // "**" or ""
        const rest = bulletMatch[5]; // rest of content

        const tierLower = tier.toLowerCase();
        if (tiers.includes(tierLower)) {
          // Capitalize tier
          const capitalizedTier = tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase();
          const normalizedLine = `${prefix}${boldStart}${capitalizedTier}${boldEnd}:${rest}`;

          if (normalizedLine !== line) {
            changes.push({
              lineNumber,
              original: line,
              normalized: normalizedLine,
              description: 'outcomes tier casing',
            });
            line = normalizedLine;
          }
        }
      }
    }

    normalized.push(line);
  }

  return {
    normalized: normalized.join('\n'),
    changes,
  };
}
