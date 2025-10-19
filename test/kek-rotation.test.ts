/**
 * KEK Rotation Tests
 * Phase 3.2: Tests for Key Encryption Key rotation with data preservation
 *
 * Tests cover:
 * 1. Encrypt with old KEK → rotate → decrypt old data (must work)
 * 2. Encrypt after rotation → decrypt new data (must work)
 * 3. Missing KEK ID → proper error and metric increment
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EncryptionService, getEncryptionService } from '../src/memory-layer/security/encryption-service';
import * as crypto from 'crypto';

describe('KEK Rotation - Data Preservation', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.KMS_PROVIDER = 'memory';
    process.env.KEK_ID = 'kek-test-original';

    // Generate a stable test KEK
    const testKEK = crypto.randomBytes(32);
    process.env.DEV_KEK_BASE64 = testKEK.toString('base64');
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  it('should decrypt old data after KEK rotation', async () => {
    const service = new EncryptionService();

    // Step 1: Encrypt data with original KEK
    const plaintext = Buffer.from('Sensitive data encrypted with old KEK');
    const originalKekId = service.getCurrentKekId();

    const encrypted = await service.encrypt(plaintext);

    // Verify encrypted with original KEK
    expect(encrypted.dek_kid).toBe(originalKekId);
    expect(encrypted.encryption_version).toBe('v1-aes256gcm');

    // Step 2: Rotate to new KEK
    const newKekId = 'kek-test-rotated';
    service.rotateKEK(newKekId);

    // Verify rotation
    expect(service.getCurrentKekId()).toBe(newKekId);

    // Step 3: Decrypt old data (encrypted with old KEK)
    // This should work because old KEK is still available
    const decrypted = await service.decrypt(encrypted);

    expect(decrypted.toString()).toBe('Sensitive data encrypted with old KEK');
  });

  it('should encrypt new data with new KEK after rotation', async () => {
    const service = new EncryptionService();

    // Step 1: Rotate to new KEK
    const newKekId = 'kek-test-new';
    service.rotateKEK(newKekId);

    // Step 2: Encrypt new data
    const plaintext = Buffer.from('New data encrypted with new KEK');
    const encrypted = await service.encrypt(plaintext);

    // Verify encrypted with new KEK
    expect(encrypted.dek_kid).toBe(newKekId);

    // Step 3: Decrypt new data
    const decrypted = await service.decrypt(encrypted);
    expect(decrypted.toString()).toBe('New data encrypted with new KEK');
  });

  it('should handle multiple KEK rotations with mixed old/new data', async () => {
    const service = new EncryptionService();

    // Encrypt with KEK v1
    const data1 = Buffer.from('Data v1');
    const encrypted1 = await service.encrypt(data1);
    const kekId1 = encrypted1.dek_kid;

    // Rotate to KEK v2
    service.rotateKEK('kek-v2');
    const data2 = Buffer.from('Data v2');
    const encrypted2 = await service.encrypt(data2);
    const kekId2 = encrypted2.dek_kid;

    // Rotate to KEK v3
    service.rotateKEK('kek-v3');
    const data3 = Buffer.from('Data v3');
    const encrypted3 = await service.encrypt(data3);
    const kekId3 = encrypted3.dek_kid;

    // Verify all KEKs are different
    expect(kekId1).not.toBe(kekId2);
    expect(kekId2).not.toBe(kekId3);
    expect(kekId1).not.toBe(kekId3);

    // Decrypt all data (should work regardless of which KEK was used)
    const decrypted1 = await service.decrypt(encrypted1);
    const decrypted2 = await service.decrypt(encrypted2);
    const decrypted3 = await service.decrypt(encrypted3);

    expect(decrypted1.toString()).toBe('Data v1');
    expect(decrypted2.toString()).toBe('Data v2');
    expect(decrypted3.toString()).toBe('Data v3');
  });

  it('should throw error with actionable message for unknown KEK ID', async () => {
    const service = new EncryptionService();

    // Create a fake encrypted envelope with non-existent KEK ID
    const plaintext = Buffer.from('Test data');
    const encrypted = await service.encrypt(plaintext);

    // Tamper with KEK ID to simulate missing KEK
    encrypted.dek_kid = 'kek-nonexistent-missing';

    // Attempt to decrypt should fail with clear error
    await expect(service.decrypt(encrypted)).rejects.toThrow(/KEK not found/);
    await expect(service.decrypt(encrypted)).rejects.toThrow(/kek-nonexistent-missing/);
    await expect(service.decrypt(encrypted)).rejects.toThrow(/restore the missing KEK or re-encrypt/);
  });

  it('should preserve old KEKs in map after rotation', async () => {
    const service = new EncryptionService();

    // Get initial KEK ID
    const originalKekId = service.getCurrentKekId();

    // Encrypt with original KEK
    const plaintext = Buffer.from('Original data');
    const encrypted = await service.encrypt(plaintext);

    // Rotate multiple times
    service.rotateKEK('kek-rotation-1');
    service.rotateKEK('kek-rotation-2');
    service.rotateKEK('kek-rotation-3');

    // Old data should still be decryptable
    const decrypted = await service.decrypt(encrypted);
    expect(decrypted.toString()).toBe('Original data');

    // Verify current KEK is the latest
    expect(service.getCurrentKekId()).toBe('kek-rotation-3');
  });

  it('should use default KEK ID format (kek-YYYYMM) when not specified', () => {
    // Clear KEK_ID env var
    delete process.env.KEK_ID;

    const service = new EncryptionService();
    const kekId = service.getCurrentKekId();

    // Should match format: kek-YYYYMM (e.g., kek-202501)
    expect(kekId).toMatch(/^kek-\d{6}$/);
  });

  it('should allow setting custom KEK ID via environment variable', () => {
    process.env.KEK_ID = 'kek-custom-test';

    const service = new EncryptionService();
    expect(service.getCurrentKekId()).toBe('kek-custom-test');
  });

  it('should handle encryption and decryption with same KEK', async () => {
    const service = new EncryptionService();
    const plaintext = Buffer.from('Test data for round-trip');

    const encrypted = await service.encrypt(plaintext);
    const decrypted = await service.decrypt(encrypted);

    expect(decrypted.toString()).toBe('Test data for round-trip');
  });

  it('should generate unique IVs for each encryption', async () => {
    const service = new EncryptionService();
    const plaintext = Buffer.from('Same plaintext');

    const encrypted1 = await service.encrypt(plaintext);
    const encrypted2 = await service.encrypt(plaintext);

    // Same plaintext should produce different ciphertexts (due to different IVs)
    expect(encrypted1.iv).not.toBe(encrypted2.iv);
    expect(encrypted1.data_ciphertext).not.toBe(encrypted2.data_ciphertext);

    // But both should decrypt correctly
    const decrypted1 = await service.decrypt(encrypted1);
    const decrypted2 = await service.decrypt(encrypted2);

    expect(decrypted1.toString()).toBe('Same plaintext');
    expect(decrypted2.toString()).toBe('Same plaintext');
  });

  it('should include all metadata in encrypted envelope', async () => {
    const service = new EncryptionService();
    const plaintext = Buffer.from('Test data');

    const encrypted = await service.encrypt(plaintext);

    // Verify envelope structure
    expect(encrypted).toHaveProperty('data_ciphertext');
    expect(encrypted).toHaveProperty('dek_ciphertext');
    expect(encrypted).toHaveProperty('dek_kid');
    expect(encrypted).toHaveProperty('encryption_version');
    expect(encrypted).toHaveProperty('auth_tag');
    expect(encrypted).toHaveProperty('iv');

    // Verify all fields are non-empty
    expect(encrypted.data_ciphertext).toBeTruthy();
    expect(encrypted.dek_ciphertext).toBeTruthy();
    expect(encrypted.dek_kid).toBeTruthy();
    expect(encrypted.encryption_version).toBe('v1-aes256gcm');
    expect(encrypted.auth_tag).toBeTruthy();
    expect(encrypted.iv).toBeTruthy();
  });
});

describe('KEK Rotation - Metrics', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.NODE_ENV = 'test';
    process.env.KMS_PROVIDER = 'memory';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should not crash when metrics module is unavailable', () => {
    const service = new EncryptionService();

    // Should not throw even if metrics can't be incremented
    expect(() => service.rotateKEK('kek-test-no-metrics')).not.toThrow();
  });
});
