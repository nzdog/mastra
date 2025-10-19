/**
 * Readiness Check - KMS Health Tests
 * Phase 3.2: Tests for KMS provider health check integration
 *
 * Tests cover:
 * 1. Production environment with memory provider → startup fails
 * 2. Missing AWS/GCP credentials → readiness fails with clear message
 * 3. Valid (mock) provider → readiness passes
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { assertKmsUsable } from '../src/memory-layer/security/encryption-service';

describe('Readiness Check - KMS Health', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should pass health check with valid memory KMS provider in test environment', async () => {
    process.env.NODE_ENV = 'test';
    process.env.KMS_PROVIDER = 'memory';
    process.env.DEV_KEK_BASE64 = Buffer.from('test-key-32-bytes-for-aes-256-gcm').toString('base64');

    // Should not throw
    await expect(assertKmsUsable()).resolves.toBeUndefined();
  });

  it('should fail health check with memory KMS provider in production environment', async () => {
    process.env.NODE_ENV = 'production';
    process.env.KMS_PROVIDER = 'memory';

    // Should throw with actionable error
    await expect(assertKmsUsable()).rejects.toThrow(/MemoryKMSProvider is for development\/testing only/);
  });

  it('should fail health check with unimplemented AWS provider', async () => {
    process.env.NODE_ENV = 'test';
    process.env.KMS_PROVIDER = 'aws';

    // Should throw with clear error about AWS not being implemented
    await expect(assertKmsUsable()).rejects.toThrow(/AWS KMS Provider not implemented/);
  });

  it('should fail health check with unimplemented GCP provider', async () => {
    process.env.NODE_ENV = 'test';
    process.env.KMS_PROVIDER = 'gcp';

    // Should throw with clear error about GCP not being implemented
    await expect(assertKmsUsable()).rejects.toThrow(/GCP KMS Provider not implemented/);
  });

  it('should fail health check if round-trip encryption fails', async () => {
    process.env.NODE_ENV = 'test';
    process.env.KMS_PROVIDER = 'memory';
    // Invalid KEK (too short)
    process.env.DEV_KEK_BASE64 = 'invalid';

    // Should throw with KMS usability error
    await expect(assertKmsUsable()).rejects.toThrow();
  });

  it('should provide actionable error message for production with memory KMS', async () => {
    process.env.NODE_ENV = 'production';
    process.env.KMS_PROVIDER = 'memory';

    try {
      await assertKmsUsable();
      expect.fail('Should have thrown error');
    } catch (err) {
      const errorMsg = (err as Error).message;
      expect(errorMsg).toContain('development');
      expect(errorMsg).toContain('production');
      expect(errorMsg).toContain('KMS_PROVIDER');
    }
  });

  it('should provide helpful error for AWS KMS in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.KMS_PROVIDER = 'aws';

    try {
      await assertKmsUsable();
      expect.fail('Should have thrown error');
    } catch (err) {
      const errorMsg = (err as Error).message;
      expect(errorMsg).toContain('AWS KMS');
      expect(errorMsg).toContain('not implemented');
      expect(errorMsg).toContain('production');
    }
  });
});
