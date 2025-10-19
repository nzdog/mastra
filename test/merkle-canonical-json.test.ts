/**
 * Merkle Tree - Canonical JSON Hashing Tests
 * Phase 3.2: Validates property-order independence
 */

import { describe, it, expect } from 'vitest';
import { canonicalStringify } from '../src/memory-layer/utils/canonical-json';
import * as crypto from 'crypto';

describe('Merkle Canonical JSON', () => {
  it('should hash identical objects with different property order to same value', () => {
    const obj1 = { a: 1, b: 2, c: 3 };
    const obj2 = { c: 3, a: 1, b: 2 };
    const obj3 = { b: 2, c: 3, a: 1 };

    const canonical1 = canonicalStringify(obj1);
    const canonical2 = canonicalStringify(obj2);
    const canonical3 = canonicalStringify(obj3);

    expect(canonical1).toBe(canonical2);
    expect(canonical2).toBe(canonical3);

    // All should produce same hash
    const hash1 = crypto.createHash('sha256').update(canonical1).digest('hex');
    const hash2 = crypto.createHash('sha256').update(canonical2).digest('hex');
    const hash3 = crypto.createHash('sha256').update(canonical3).digest('hex');

    expect(hash1).toBe(hash2);
    expect(hash2).toBe(hash3);
  });

  it('should handle nested objects with property-order independence', () => {
    const obj1 = { outer: { a: 1, b: 2 }, value: 'test' };
    const obj2 = { value: 'test', outer: { b: 2, a: 1 } };

    const canonical1 = canonicalStringify(obj1);
    const canonical2 = canonicalStringify(obj2);

    expect(canonical1).toBe(canonical2);
  });

  it('should produce different hashes for different data', () => {
    const obj1 = { a: 1, b: 2 };
    const obj2 = { a: 1, b: 3 };

    const canonical1 = canonicalStringify(obj1);
    const canonical2 = canonicalStringify(obj2);

    expect(canonical1).not.toBe(canonical2);
  });
});
