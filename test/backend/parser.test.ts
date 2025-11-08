/**
 * Backend Tests - Protocol Parser
 * Tests for parsing markdown protocol files into structured data
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProtocolParser } from '../../src/protocol/parser';
import * as path from 'path';
import * as fs from 'fs';

describe('ProtocolParser', () => {
  const testProtocolPath = path.join(__dirname, '../../protocols/field_diagnostic.md');

  describe('parse()', () => {
    let parser: ProtocolParser;

    beforeEach(() => {
      parser = new ProtocolParser(testProtocolPath);
      // Clear cache before each test
      ProtocolParser.clearCacheForTesting();
    });

    it('should parse frontmatter metadata correctly', () => {
      const result = parser.parse();

      expect(result.metadata).toBeDefined();
      expect(result.metadata.id).toBe('field_diagnostic');
      expect(result.metadata.title).toBe('Field Diagnostic Protocol');
      expect(result.metadata.version).toBe('1.0.0');
    });

    it('should extract entry_keys from frontmatter', () => {
      const result = parser.parse();

      expect(result.metadata.entry_keys).toContain('purpose');
      expect(result.metadata.entry_keys).toContain('why');
      expect(result.metadata.entry_keys).toContain('use_when');
      expect(result.metadata.entry_keys).toContain('outcomes_overall');
    });

    it('should extract themes from frontmatter', () => {
      const result = parser.parse();

      expect(result.metadata.themes).toHaveLength(5);
      expect(result.metadata.themes[0]).toEqual({
        index: 1,
        title: 'Surface Behaviors',
      });
      expect(result.metadata.themes[4]).toEqual({
        index: 5,
        title: 'Pressure Points',
      });
    });

    it('should extract stones from frontmatter', () => {
      const result = parser.parse();

      // Stones are parsed as objects by gray-matter due to YAML format
      expect(result.metadata.stones).toHaveLength(3);
      expect(result.metadata.stones[0]).toEqual({ 'Stone 4': 'Clarity Over Cleverness' });
      expect(result.metadata.stones[1]).toEqual({ 'Stone 5': 'Presence Is Productivity' });
      expect(result.metadata.stones[2]).toEqual({ 'Stone 8': 'Integrity Is the Growth Strategy' });
    });

    it('should extract entry sections', () => {
      const result = parser.parse();

      expect(result.entry_sections).toBeDefined();
      expect(result.entry_sections.length).toBeGreaterThan(0);
    });

    it('should extract theme chunks', () => {
      const result = parser.parse();

      expect(result.theme_chunks).toBeDefined();
      expect(result.theme_chunks.size).toBe(5);
      expect(result.theme_chunks.has(1)).toBe(true);
      expect(result.theme_chunks.has(5)).toBe(true);
    });

    it('should extract summary instructions', () => {
      const result = parser.parse();

      // Summary instructions should exist in field_diagnostic.md
      expect(result.summary_instructions).toBeDefined();
      expect(typeof result.summary_instructions).toBe('string');
    });

    it('should cache parsed protocols', () => {
      const consoleSpy = vi.spyOn(console, 'log');

      // First call should parse from disk
      parser.parse();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('CACHE MISS'));

      consoleSpy.mockClear();

      // Second call should use cache
      parser.parse();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('CACHE HIT'));

      consoleSpy.mockRestore();
    });

    it('should re-parse after cache expiry', () => {
      vi.useFakeTimers();

      // First parse
      parser.parse();

      // Advance time by 5 minutes + 1 second (past TTL)
      vi.advanceTimersByTime(5 * 60 * 1000 + 1000);

      const consoleSpy = vi.spyOn(console, 'log');

      // Should re-parse
      parser.parse();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('CACHE MISS'));

      consoleSpy.mockRestore();
      vi.useRealTimers();
    });
  });

  describe('extractEntrySections()', () => {
    let parser: ProtocolParser;

    beforeEach(() => {
      parser = new ProtocolParser(testProtocolPath);
      ProtocolParser.clearCacheForTesting();
    });

    it('should extract configured entry sections from frontmatter', () => {
      const result = parser.parse();

      const sectionTitles = result.entry_sections.map((s) => s.title);
      expect(sectionTitles).toContain('Purpose');
      expect(sectionTitles).toContain('What Is a Field?');
      expect(sectionTitles).toContain('Examples of Common Fields');
      expect(sectionTitles).toContain('Why This Matters');
      expect(sectionTitles).toContain('Use This When');
      expect(sectionTitles).toContain('Outcomes');
    });

    it('should extract section content correctly', () => {
      const result = parser.parse();

      const purposeSection = result.entry_sections.find((s) => s.title === 'Purpose');
      expect(purposeSection).toBeDefined();
      expect(purposeSection!.content).toContain(
        'To surface the invisible field currently shaping the user'
      );
    });

    it('should stop parsing at ## Themes section', () => {
      const result = parser.parse();

      // Should not include content from Themes section
      const themesSection = result.entry_sections.find((s) => s.title === 'Themes');
      expect(themesSection).toBeUndefined();
    });

    it('should fall back to default sections if no frontmatter config', () => {
      // Create a test protocol without entry_sections config
      const testContent = `---
id: test_protocol
title: Test Protocol
version: 1.0.0
---

## Purpose

Test purpose content.

## Why This Matters

Test why content.

## Use This When

Test use when content.

## Outcomes

Test outcomes content.

## Themes

### 1. Theme One

Content here.
`;

      const testPath = path.join(__dirname, '../../test/test_protocol.md');
      fs.writeFileSync(testPath, testContent);

      try {
        const testParser = new ProtocolParser(testPath);
        const result = testParser.parse();

        const sectionTitles = result.entry_sections.map((s) => s.title);
        expect(sectionTitles).toContain('Purpose');
        expect(sectionTitles).toContain('Why This Matters');
        expect(sectionTitles).toContain('Use This When');
        expect(sectionTitles).toContain('Outcomes');
      } finally {
        fs.unlinkSync(testPath);
      }
    });
  });

  describe('extractThemeChunks()', () => {
    let parser: ProtocolParser;

    beforeEach(() => {
      parser = new ProtocolParser(testProtocolPath);
      ProtocolParser.clearCacheForTesting();
    });

    it('should find ## Themes section', () => {
      const result = parser.parse();

      expect(result.theme_chunks.size).toBeGreaterThan(0);
    });

    it('should parse themes by ### N. Title pattern', () => {
      const result = parser.parse();

      expect(result.theme_chunks.has(1)).toBe(true);
      expect(result.theme_chunks.has(2)).toBe(true);
      expect(result.theme_chunks.has(3)).toBe(true);
      expect(result.theme_chunks.has(4)).toBe(true);
      expect(result.theme_chunks.has(5)).toBe(true);
    });

    it('should stop at ## Completion Prompts', () => {
      const result = parser.parse();

      // Should have exactly 5 themes, not more
      expect(result.theme_chunks.size).toBe(5);
    });

    it('should return Map<number, string>', () => {
      const result = parser.parse();

      expect(result.theme_chunks).toBeInstanceOf(Map);
      for (const [key, value] of result.theme_chunks.entries()) {
        expect(typeof key).toBe('number');
        expect(typeof value).toBe('string');
      }
    });

    it('should include complete theme content', () => {
      const result = parser.parse();

      const theme1 = result.theme_chunks.get(1)!;
      expect(theme1).toContain('Surface Behaviors');
      expect(theme1).toContain('Stone 4: Clarity Over Cleverness');
    });
  });

  describe('parseThemeContent()', () => {
    let parser: ProtocolParser;

    beforeEach(() => {
      parser = new ProtocolParser(testProtocolPath);
      ProtocolParser.clearCacheForTesting();
    });

    it('should extract theme title', () => {
      const result = parser.parse();
      const theme1Chunk = result.theme_chunks.get(1)!;
      const parsed = parser.parseThemeContent(theme1Chunk);

      expect(parsed.title).toBe('Surface Behaviors');
    });

    it('should extract stone identifier from _(stone)_ notation', () => {
      const result = parser.parse();
      const theme1Chunk = result.theme_chunks.get(1)!;
      const parsed = parser.parseThemeContent(theme1Chunk);

      expect(parsed.stone).toBe('Stone 4: Clarity Over Cleverness');
    });

    it('should extract purpose', () => {
      const result = parser.parse();
      const theme1Chunk = result.theme_chunks.get(1)!;
      const parsed = parser.parseThemeContent(theme1Chunk);

      expect(parsed.purpose).toBeDefined();
      expect(parsed.purpose.length).toBeGreaterThan(0);
    });

    it('should extract why_matters', () => {
      const result = parser.parse();
      const theme1Chunk = result.theme_chunks.get(1)!;
      const parsed = parser.parseThemeContent(theme1Chunk);

      expect(parsed.why_matters).toBeDefined();
      expect(parsed.why_matters.length).toBeGreaterThan(0);
    });

    it('should extract outcomes', () => {
      const result = parser.parse();
      const theme1Chunk = result.theme_chunks.get(1)!;
      const parsed = parser.parseThemeContent(theme1Chunk);

      expect(parsed.outcomes).toBeDefined();
    });

    it('should extract questions array', () => {
      const result = parser.parse();
      const theme1Chunk = result.theme_chunks.get(1)!;
      const parsed = parser.parseThemeContent(theme1Chunk);

      expect(Array.isArray(parsed.questions)).toBe(true);
      expect(parsed.questions.length).toBeGreaterThan(0);
    });

    it('should extract completion_prompt', () => {
      const result = parser.parse();
      const theme1Chunk = result.theme_chunks.get(1)!;
      const parsed = parser.parseThemeContent(theme1Chunk);

      expect(parsed.completion_prompt).toBeDefined();
    });

    it('should handle inline bold sections on same line', () => {
      // Test parsing when multiple **Bold:** sections appear on one line
      const testChunk = `### 1. Test Theme _(Stone 1)_

**Purpose:** Test purpose. **Why this matters:** Test why.

**Guiding Questions:**
- Question 1
- Question 2

**Completion Prompt:**
Test completion.
`;

      const parsed = parser.parseThemeContent(testChunk);

      expect(parsed.purpose).toBe('Test purpose.');
      expect(parsed.why_matters).toContain('Test why');
    });

    it('should continue parsing across multiple lines', () => {
      const testChunk = `### 1. Test Theme _(Stone 1)_

**Purpose:** This is a long
purpose that spans
multiple lines.

**Why this matters:** This is why
it matters across lines.

**Guiding Questions:**
- Question 1

**Completion Prompt:**
Done.
`;

      const parsed = parser.parseThemeContent(testChunk);

      expect(parsed.purpose).toContain('This is a long purpose that spans multiple lines');
      expect(parsed.why_matters).toContain('This is why it matters across lines');
    });

    it('should handle bullet points in outcomes', () => {
      const testChunk = `### 1. Test Theme _(Stone 1)_

**Purpose:** Test.

**Why this matters:** Test.

**Outcomes:**
- Outcome 1
- Outcome 2
- Outcome 3

**Guiding Questions:**
- Question 1

**Completion Prompt:**
Done.
`;

      const parsed = parser.parseThemeContent(testChunk);

      expect(parsed.outcomes).toContain('Outcome 1');
      expect(parsed.outcomes).toContain('Outcome 2');
      expect(parsed.outcomes).toContain('Outcome 3');
    });
  });

  describe('extractSummaryInstructions()', () => {
    let parser: ProtocolParser;

    beforeEach(() => {
      parser = new ProtocolParser(testProtocolPath);
      ProtocolParser.clearCacheForTesting();
    });

    it('should find ## Summary Instructions marker', () => {
      const result = parser.parse();

      expect(result.summary_instructions).toBeDefined();
    });

    it('should collect all lines until EOF', () => {
      const result = parser.parse();

      expect(result.summary_instructions!.length).toBeGreaterThan(100);
    });

    it('should return undefined if section not found', () => {
      // Create a test protocol without Summary Instructions
      const testContent = `---
id: test_protocol
title: Test Protocol
version: 1.0.0
---

## Purpose

Test content.

## Themes

### 1. Theme One

Content here.
`;

      const testPath = path.join(__dirname, '../../test/test_no_summary.md');
      fs.writeFileSync(testPath, testContent);

      try {
        const testParser = new ProtocolParser(testPath);
        const result = testParser.parse();

        expect(result.summary_instructions).toBeUndefined();
      } finally {
        fs.unlinkSync(testPath);
      }
    });
  });
});
