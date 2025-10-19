/**
 * Schema Alignment Tests
 * Phase 3.2: Validates JSON Schema matches TypeScript runtime validators
 */

import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import * as memorySchema from '../src/memory-layer/validation/memory-schema.json';
import { validateStoreRequest } from '../src/memory-layer/models/operation-requests';

describe('Schema Alignment', () => {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const storeRequestSchema = ajv.compile(memorySchema.definitions.StoreRequest);

  it('should accept valid StoreRequest in both Schema and TS', () => {
    const validRequest = {
      content: { type: 'text', data: 'Test' },
      metadata: {
        hashed_pseudonym: 'hs_dGVzdF91c2VyX2hhc2hlZF9wc2V1ZG9ueW0',
        consent_family: 'personal',
        consent_timestamp: '2025-01-15T12:00:00Z',
        consent_version: '1.0',
      },
    };

    const schemaValid = storeRequestSchema(validRequest);
    const tsValid = validateStoreRequest(validRequest);

    expect(schemaValid).toBe(true);
    expect(tsValid).toBe(true);
  });

  it('should reject invalid StoreRequest in both Schema and TS', () => {
    const invalidRequest = {
      content: { type: 'text', data: 'Test' },
      // Missing metadata field
    };

    const schemaValid = storeRequestSchema(invalidRequest);
    const tsValid = validateStoreRequest(invalidRequest);

    expect(schemaValid).toBe(false);
    expect(tsValid).toBe(false);
  });
});
