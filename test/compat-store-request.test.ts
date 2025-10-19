/**
 * Backward Compatibility Tests for StoreRequest
 * Phase 3.2: Tests for compat shim middleware
 *
 * Tests cover:
 * 1. Legacy requests without metadata field (when COMPAT_ALLOW_LEGACY_METADATA=true/false)
 * 2. Legacy consent_family aliases (when COMPAT_ALLOW_LEGACY_FAMILY=true/false)
 * 3. Metric emission for compat cases
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { compatShim, incrementCompatMetric } from '../src/memory-layer/middleware/compat-shim';
import { Request, Response, NextFunction } from 'express';

describe('Backward Compatibility - StoreRequest', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  /**
   * Helper to create mock Express request/response/next
   */
  function createMocks(
    method: string,
    path: string,
    body: any,
    consentContext?: any
  ): { req: Partial<Request>; res: Partial<Response>; next: NextFunction } {
    const req: Partial<Request> = {
      method,
      path,
      body,
    };

    // Add consent context if provided
    if (consentContext) {
      (req as any).consentContext = consentContext;
    }

    const res: Partial<Response> = {
      status: () => res as Response,
      json: () => res as Response,
    };

    let _nextCalled = false;
    const next: NextFunction = () => {
      _nextCalled = true;
    };

    return { req, res, next };
  }

  describe('Legacy metadata synthesis', () => {
    it('should synthesize metadata when missing and COMPAT_ALLOW_LEGACY_METADATA=true', () => {
      process.env.COMPAT_ALLOW_LEGACY_METADATA = 'true';

      const body = {
        content: { type: 'text', data: 'test' },
        // No metadata field (legacy format)
      };

      const consentContext = {
        hashed_pseudonym: 'hs_dGVzdF91c2VyX2hhc2hlZF9wc2V1ZG9ueW0',
        family: 'personal',
      };

      const { req, res, next } = createMocks('POST', '/v1/personal/store', body, consentContext);

      compatShim(req as Request, res as Response, next);

      // Should synthesize metadata
      expect(req.body.metadata).toBeDefined();
      expect(req.body.metadata.hashed_pseudonym).toBe('hs_dGVzdF91c2VyX2hhc2hlZF9wc2V1ZG9ueW0');
      expect(req.body.metadata.consent_family).toBe('personal');
      expect(req.body.metadata.consent_version).toBe('legacy-compat');
      expect(req.body.metadata.consent_timestamp).toBeDefined();
    });

    it('should NOT synthesize metadata when missing and COMPAT_ALLOW_LEGACY_METADATA=false', () => {
      process.env.COMPAT_ALLOW_LEGACY_METADATA = 'false';

      const body = {
        content: { type: 'text', data: 'test' },
        // No metadata field (legacy format)
      };

      const consentContext = {
        hashed_pseudonym: 'hs_dGVzdF91c2VyX2hhc2hlZF9wc2V1ZG9ueW0',
        family: 'personal',
      };

      const { req, res, next } = createMocks('POST', '/v1/personal/store', body, consentContext);

      compatShim(req as Request, res as Response, next);

      // Should NOT synthesize metadata
      expect(req.body.metadata).toBeUndefined();
    });

    it('should NOT modify request if metadata already exists', () => {
      process.env.COMPAT_ALLOW_LEGACY_METADATA = 'true';

      const body = {
        content: { type: 'text', data: 'test' },
        metadata: {
          hashed_pseudonym: 'hs_b3JpZ2luYWxfaGFzaGVkX3BzZXVkb255bQ',
          consent_family: 'personal',
          consent_timestamp: '2025-01-15T12:00:00Z',
          consent_version: '1.0',
        },
      };

      const { req, res, next } = createMocks('POST', '/v1/personal/store', body);

      compatShim(req as Request, res as Response, next);

      // Should keep original metadata
      expect(req.body.metadata.hashed_pseudonym).toBe('hs_b3JpZ2luYWxfaGFzaGVkX3BzZXVkb255bQ');
      expect(req.body.metadata.consent_version).toBe('1.0');
    });
  });

  describe('Legacy consent_family mapping', () => {
    it('should map "Personal" (capitalized) to "personal" when COMPAT_ALLOW_LEGACY_FAMILY=true', () => {
      process.env.COMPAT_ALLOW_LEGACY_FAMILY = 'true';

      const body = {
        content: { type: 'text', data: 'test' },
        metadata: {
          hashed_pseudonym: 'hs_dGVzdF91c2VyX2hhc2hlZF9wc2V1ZG9ueW0',
          consent_family: 'Personal', // Legacy capitalized variant
          consent_timestamp: '2025-01-15T12:00:00Z',
          consent_version: '1.0',
        },
      };

      const { req, res, next } = createMocks('POST', '/v1/personal/store', body);

      compatShim(req as Request, res as Response, next);

      // Should map to canonical lowercase
      expect(req.body.metadata.consent_family).toBe('personal');
    });

    it('should map "individual" alias to "personal" when COMPAT_ALLOW_LEGACY_FAMILY=true', () => {
      process.env.COMPAT_ALLOW_LEGACY_FAMILY = 'true';

      const body = {
        content: { type: 'text', data: 'test' },
        metadata: {
          hashed_pseudonym: 'hs_dGVzdF91c2VyX2hhc2hlZF9wc2V1ZG9ueW0',
          consent_family: 'individual', // Legacy alias
          consent_timestamp: '2025-01-15T12:00:00Z',
          consent_version: '1.0',
        },
      };

      const { req, res, next } = createMocks('POST', '/v1/personal/store', body);

      compatShim(req as Request, res as Response, next);

      // Should map alias to canonical
      expect(req.body.metadata.consent_family).toBe('personal');
    });

    it('should map "group" alias to "cohort" when COMPAT_ALLOW_LEGACY_FAMILY=true', () => {
      process.env.COMPAT_ALLOW_LEGACY_FAMILY = 'true';

      const body = {
        content: { type: 'text', data: 'test' },
        metadata: {
          hashed_pseudonym: 'hs_dGVzdF91c2VyX2hhc2hlZF9wc2V1ZG9ueW0',
          consent_family: 'group', // Legacy alias
          consent_timestamp: '2025-01-15T12:00:00Z',
          consent_version: '1.0',
        },
      };

      const { req, res, next } = createMocks('POST', '/v1/cohort/store', body);

      compatShim(req as Request, res as Response, next);

      // Should map alias to canonical
      expect(req.body.metadata.consent_family).toBe('cohort');
    });

    it('should NOT map legacy alias when COMPAT_ALLOW_LEGACY_FAMILY=false', () => {
      process.env.COMPAT_ALLOW_LEGACY_FAMILY = 'false';

      const body = {
        content: { type: 'text', data: 'test' },
        metadata: {
          hashed_pseudonym: 'hs_dGVzdF91c2VyX2hhc2hlZF9wc2V1ZG9ueW0',
          consent_family: 'individual', // Legacy alias
          consent_timestamp: '2025-01-15T12:00:00Z',
          consent_version: '1.0',
        },
      };

      const { req, res, next } = createMocks('POST', '/v1/personal/store', body);

      compatShim(req as Request, res as Response, next);

      // Should NOT map (leave as-is for schema validator to reject)
      expect(req.body.metadata.consent_family).toBe('individual');
    });

    it('should pass through canonical values unchanged', () => {
      process.env.COMPAT_ALLOW_LEGACY_FAMILY = 'false';

      const body = {
        content: { type: 'text', data: 'test' },
        metadata: {
          hashed_pseudonym: 'hs_dGVzdF91c2VyX2hhc2hlZF9wc2V1ZG9ueW0',
          consent_family: 'personal', // Already canonical
          consent_timestamp: '2025-01-15T12:00:00Z',
          consent_version: '1.0',
        },
      };

      const { req, res, next } = createMocks('POST', '/v1/personal/store', body);

      compatShim(req as Request, res as Response, next);

      // Should remain unchanged
      expect(req.body.metadata.consent_family).toBe('personal');
    });
  });

  describe('Non-store operations', () => {
    it('should NOT apply shim to recall operations', () => {
      process.env.COMPAT_ALLOW_LEGACY_METADATA = 'true';

      const body = {};

      const { req, res, next } = createMocks('GET', '/v1/personal/recall', body);

      compatShim(req as Request, res as Response, next);

      // Should not modify non-store requests
      expect(req.body.metadata).toBeUndefined();
    });

    it('should NOT apply shim to forget operations', () => {
      process.env.COMPAT_ALLOW_LEGACY_METADATA = 'true';

      const body = {};

      const { req, res, next } = createMocks('DELETE', '/v1/personal/forget', body);

      compatShim(req as Request, res as Response, next);

      // Should not modify non-store requests
      expect(req.body.metadata).toBeUndefined();
    });
  });

  describe('Combined scenarios', () => {
    it('should synthesize metadata AND map legacy family when both flags enabled', () => {
      process.env.COMPAT_ALLOW_LEGACY_METADATA = 'true';
      process.env.COMPAT_ALLOW_LEGACY_FAMILY = 'true';

      const body = {
        content: { type: 'text', data: 'test' },
        hashed_pseudonym: 'hs_dGVzdF91c2VyX2hhc2hlZF9wc2V1ZG9ueW0',
        consent_family: 'individual', // Legacy alias at top level
        consent_timestamp: '2025-01-15T12:00:00Z',
        consent_version: '1.0',
        // No metadata field
      };

      const consentContext = {
        hashed_pseudonym: 'hs_dGVzdF91c2VyX2hhc2hlZF9wc2V1ZG9ueW0',
        family: 'personal',
      };

      const { req, res, next } = createMocks('POST', '/v1/personal/store', body, consentContext);

      compatShim(req as Request, res as Response, next);

      // Should synthesize metadata AND map family
      expect(req.body.metadata).toBeDefined();
      expect(req.body.metadata.consent_family).toBe('personal');
      expect(req.body.metadata.hashed_pseudonym).toBe('hs_dGVzdF91c2VyX2hhc2hlZF9wc2V1ZG9ueW0');
    });
  });

  describe('Metric increment', () => {
    it('should export incrementCompatMetric function', () => {
      expect(typeof incrementCompatMetric).toBe('function');
    });

    it('should allow manual metric increment for missing_metadata', () => {
      expect(() => incrementCompatMetric('missing_metadata')).not.toThrow();
    });

    it('should allow manual metric increment for legacy_family', () => {
      expect(() => incrementCompatMetric('legacy_family')).not.toThrow();
    });
  });
});
