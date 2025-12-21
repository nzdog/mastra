/**
 * Unit tests for validation utilities
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeStone,
  stoneToString,
  normalizeString,
  stonesMatch,
} from '../src/protocol/validation/utils';

describe('normalizeString', () => {
  it('should trim whitespace', () => {
    expect(normalizeString('  hello  ')).toBe('hello');
  });

  it('should collapse consecutive whitespace', () => {
    expect(normalizeString('hello    world')).toBe('hello world');
    expect(normalizeString('hello\t\tworld')).toBe('hello world');
    expect(normalizeString('hello\n\nworld')).toBe('hello world');
  });

  it('should convert to lowercase', () => {
    expect(normalizeString('HELLO World')).toBe('hello world');
  });

  it('should handle all transformations together', () => {
    expect(normalizeString('  Stone 4:  Clarity   Over Cleverness  ')).toBe(
      'stone 4: clarity over cleverness'
    );
  });
});

describe('normalizeStone', () => {
  it('should normalize string stones', () => {
    expect(normalizeStone('Stone 4: Clarity Over Cleverness')).toBe(
      'stone 4: clarity over cleverness'
    );
  });

  it('should handle extra whitespace in string stones', () => {
    expect(normalizeStone('  Stone 4:  Clarity   Over Cleverness  ')).toBe(
      'stone 4: clarity over cleverness'
    );
  });

  it('should convert object stones to normalized strings', () => {
    const stoneObject = { 'Stone 4': 'Clarity Over Cleverness' };
    expect(normalizeStone(stoneObject)).toBe('stone 4: clarity over cleverness');
  });

  it('should handle object stones with extra whitespace', () => {
    const stoneObject = { '  Stone 4 ': '  Clarity Over Cleverness  ' };
    expect(normalizeStone(stoneObject)).toBe('stone 4: clarity over cleverness');
  });

  it('should return null for invalid types', () => {
    expect(normalizeStone(123)).toBe(null);
    expect(normalizeStone(null)).toBe(null);
    expect(normalizeStone(undefined)).toBe(null);
    expect(normalizeStone([])).toBe(null);
  });

  it('should return null for objects with multiple entries', () => {
    const invalidObject = { Stone1: 'Title1', Stone2: 'Title2' };
    expect(normalizeStone(invalidObject)).toBe(null);
  });

  it('should return null for empty objects', () => {
    expect(normalizeStone({})).toBe(null);
  });
});

describe('stoneToString', () => {
  it('should return string stones as-is', () => {
    expect(stoneToString('Stone 4: Clarity Over Cleverness')).toBe(
      'Stone 4: Clarity Over Cleverness'
    );
  });

  it('should convert object stones to string format', () => {
    const stoneObject = { 'Stone 4': 'Clarity Over Cleverness' };
    expect(stoneToString(stoneObject)).toBe('Stone 4: Clarity Over Cleverness');
  });

  it('should handle invalid types by stringifying them', () => {
    expect(stoneToString(123)).toBe('123');
    expect(stoneToString(null)).toBe('null');
  });
});

describe('stonesMatch', () => {
  it('should match identical string stones', () => {
    expect(
      stonesMatch('Stone 4: Clarity Over Cleverness', 'Stone 4: Clarity Over Cleverness')
    ).toBe(true);
  });

  it('should match stones with different casing', () => {
    expect(
      stonesMatch('Stone 4: Clarity Over Cleverness', 'stone 4: clarity over cleverness')
    ).toBe(true);
  });

  it('should match stones with different whitespace', () => {
    expect(
      stonesMatch('  Stone 4:  Clarity   Over Cleverness  ', 'Stone 4: Clarity Over Cleverness')
    ).toBe(true);
  });

  it('should match object stone with string stone', () => {
    const stoneObject = { 'Stone 4': 'Clarity Over Cleverness' };
    expect(stonesMatch(stoneObject, 'Stone 4: Clarity Over Cleverness')).toBe(true);
  });

  it('should match two object stones with same content', () => {
    const stone1 = { 'Stone 4': 'Clarity Over Cleverness' };
    const stone2 = { 'Stone 4': 'Clarity Over Cleverness' };
    expect(stonesMatch(stone1, stone2)).toBe(true);
  });

  it('should match object and string with different casing and whitespace', () => {
    const stoneObject = { '  Stone 4 ': '  Clarity Over Cleverness  ' };
    expect(stonesMatch(stoneObject, 'stone 4: clarity over cleverness')).toBe(true);
  });

  it('should not match different stones', () => {
    expect(stonesMatch('Stone 4: Clarity Over Cleverness', 'Stone 7: Built for Wholeness')).toBe(
      false
    );
  });

  it('should not match when one stone is invalid', () => {
    expect(stonesMatch(123, 'Stone 4: Clarity Over Cleverness')).toBe(false);
    expect(stonesMatch('Stone 4: Clarity Over Cleverness', null)).toBe(false);
  });

  it('should not match when both stones are invalid', () => {
    expect(stonesMatch(123, null)).toBe(false);
  });
});

describe('Integration: Real-world YAML parsing scenarios', () => {
  it('should match stone from YAML object to theme reference string', () => {
    // This simulates what gray-matter returns when parsing:
    // stones:
    //   - Stone 4: Clarity Over Cleverness
    const yamlStone = { 'Stone 4': 'Clarity Over Cleverness' };
    const themeReference = 'Stone 4: Clarity Over Cleverness';

    expect(stonesMatch(yamlStone, themeReference)).toBe(true);
  });

  it('should match multiple real stone examples', () => {
    const yamlStones = [
      { 'Stone 4': 'Clarity Over Cleverness' },
      { 'Stone 7': 'Built for Wholeness' },
      { 'Stone 6': 'Nothing Forced, Nothing Withheld' },
      { 'Stone 8': 'Integrity Is the Growth Strategy' },
      { 'Stone 10': 'Stewardship, Not Ownership' },
      { 'Stone 1': 'Light Before Form' },
    ];

    const themeReferences = [
      'Stone 4: Clarity Over Cleverness',
      'Stone 7: Built for Wholeness',
      'Stone 6: Nothing Forced, Nothing Withheld',
      'Stone 8: Integrity Is the Growth Strategy',
      'Stone 10: Stewardship, Not Ownership',
      'Stone 1: Light Before Form',
    ];

    themeReferences.forEach((ref) => {
      const hasMatch = yamlStones.some((stone) => stonesMatch(stone, ref));
      expect(hasMatch).toBe(true);
    });
  });

  it('should handle quoted YAML strings correctly', () => {
    // This simulates what gray-matter returns when parsing:
    // stones:
    //   - "Stone 4: Clarity Over Cleverness"
    const quotedYamlStone = 'Stone 4: Clarity Over Cleverness'; // Already a string
    const themeReference = 'Stone 4: Clarity Over Cleverness';

    expect(stonesMatch(quotedYamlStone, themeReference)).toBe(true);
  });
});
