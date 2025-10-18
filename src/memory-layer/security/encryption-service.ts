/**
 * Encryption Service
 * Phase 3 Week 3: Envelope Encryption for Memory Records
 *
 * Implements envelope encryption pattern:
 * 1. Generate random DEK (Data Encryption Key) for each record
 * 2. Encrypt plaintext with DEK using AES-256-GCM
 * 3. Encrypt DEK with KEK (Key Encryption Key) from KMS
 * 4. Store encrypted data + encrypted DEK
 *
 * Supports multiple KMS providers:
 * - memory: In-memory KEK storage (dev/test only)
 * - aws: AWS KMS integration (production)
 * - gcp: Google Cloud KMS integration (production)
 */

import * as crypto from 'crypto';

// Encryption constants
const GCM_IV_LENGTH = 12; // 96-bit IV for GCM mode
const GCM_AUTH_TAG_LENGTH = 16; // 128-bit auth tag for GCM
const DEK_BYTES = 32; // 256-bit DEK for AES-256
const KEK_BYTES = 32; // 256-bit KEK for AES-256

/**
 * Encrypted envelope structure returned by encrypt()
 */
export interface EncryptedEnvelope {
  data_ciphertext: string; // Base64 encoded encrypted data
  dek_ciphertext: string; // Base64 encoded encrypted DEK
  dek_kid: string; // KEK ID used to encrypt the DEK
  encryption_version: string; // Version identifier for algorithm/format
  auth_tag: string; // Base64 encoded GCM auth tag
  iv: string; // Base64 encoded initialization vector
}

/**
 * KMS Provider interface
 */
interface KMSProvider {
  /**
   * Encrypt a DEK with a KEK
   * @param plainDek - Raw DEK bytes to encrypt
   * @param kekId - Key Encryption Key identifier
   * @returns Encrypted DEK (base64)
   */
  encryptDEK(plainDek: Buffer, kekId: string): Promise<string>;

  /**
   * Decrypt a DEK using a KEK
   * @param encryptedDek - Base64 encoded encrypted DEK
   * @param kekId - Key Encryption Key identifier used to encrypt
   * @returns Decrypted DEK bytes
   */
  decryptDEK(encryptedDek: string, kekId: string): Promise<Buffer>;
}

/**
 * In-Memory KMS Provider (DEV/TEST ONLY)
 * Stores KEKs in memory - NOT SUITABLE FOR PRODUCTION
 */
class MemoryKMSProvider implements KMSProvider {
  private keys: Map<string, Buffer> = new Map();

  constructor() {
    // CRITICAL-2: Block MemoryKMS in production entirely
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'FATAL: MemoryKMSProvider is for development/testing only. ' +
          'Production deployments MUST use KMS_PROVIDER=aws or KMS_PROVIDER=gcp with proper cloud KMS integration.'
      );
    }

    // Initialize KEK for development
    // Use DEV_KEK_BASE64 env var for persistence across restarts
    const base64KEK = process.env.DEV_KEK_BASE64;
    let devKEK: Buffer;

    if (base64KEK) {
      try {
        devKEK = Buffer.from(base64KEK, 'base64');
        if (devKEK.length !== KEK_BYTES) {
          throw new Error(
            `Invalid DEV_KEK_BASE64 length: ${devKEK.length} bytes (expected ${KEK_BYTES})`
          );
        }
        console.log('[MemoryKMSProvider] Using persistent KEK from DEV_KEK_BASE64');
      } catch (err) {
        console.error('[MemoryKMSProvider] Failed to parse DEV_KEK_BASE64:', err);
        throw new Error(
          `Invalid DEV_KEK_BASE64: must be base64-encoded ${KEK_BYTES * 8}-bit key (${KEK_BYTES} bytes)`
        );
      }
    } else {
      // Generate ephemeral KEK
      devKEK = crypto.randomBytes(KEK_BYTES);
      console.warn(
        '[MemoryKMSProvider] ⚠️  Using ephemeral KEK (DEV_KEK_BASE64 not set) – encrypted data will be lost on restart.'
      );
      console.warn(
        `[MemoryKMSProvider] To persist KEK, set: DEV_KEK_BASE64=${devKEK.toString('base64')}`
      );
    }

    this.keys.set('kek-default', devKEK);
  }

  async encryptDEK(plainDek: Buffer, kekId: string): Promise<string> {
    const kek = this.keys.get(kekId);
    if (!kek) {
      throw new Error(`KEK not found: ${kekId}`);
    }

    // Encrypt DEK with KEK using AES-256-GCM
    const iv = crypto.randomBytes(GCM_IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', kek, iv);

    const encrypted = Buffer.concat([cipher.update(plainDek), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Return base64: iv || authTag || ciphertext
    const combined = Buffer.concat([iv, authTag, encrypted]);
    return combined.toString('base64');
  }

  async decryptDEK(encryptedDek: string, kekId: string): Promise<Buffer> {
    const kek = this.keys.get(kekId);
    if (!kek) {
      throw new Error(`KEK not found: ${kekId}`);
    }

    // Parse base64: iv || authTag || ciphertext
    const combined = Buffer.from(encryptedDek, 'base64');
    const iv = combined.subarray(0, GCM_IV_LENGTH);
    const authTag = combined.subarray(GCM_IV_LENGTH, GCM_IV_LENGTH + GCM_AUTH_TAG_LENGTH);
    const ciphertext = combined.subarray(GCM_IV_LENGTH + GCM_AUTH_TAG_LENGTH);

    // Decrypt DEK with KEK
    const decipher = crypto.createDecipheriv('aes-256-gcm', kek, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }
}

/**
 * AWS KMS Provider (NOT IMPLEMENTED - DO NOT USE)
 *
 * ⚠️  CRITICAL: This is a stub. AWS KMS integration is NOT implemented.
 *
 * To implement:
 * 1. Install @aws-sdk/client-kms package
 * 2. Implement encryptDEK/decryptDEK using AWS KMS API
 * 3. Configure: AWS_KMS_KEY_ARN, AWS_REGION, AWS credentials
 * 4. Remove the constructor guard below
 *
 * For development/testing: Use KMS_PROVIDER=memory (not for production)
 */
class AWSKMSProvider implements KMSProvider {
  constructor() {
    // CRITICAL-1: Explicit startup guard
    throw new Error(
      '[AWSKMSProvider] NOT IMPLEMENTED. Do not use KMS_PROVIDER=aws.\n' +
        'For development: Set KMS_PROVIDER=memory (with DEV_KEK_BASE64)\n' +
        'For production: Implement AWS KMS integration first (see class docstring)'
    );
  }

  async encryptDEK(_plainDek: Buffer, _kekId: string): Promise<string> {
    throw new Error('AWS KMS not implemented');
  }

  async decryptDEK(_encryptedDek: string, _kekId: string): Promise<Buffer> {
    throw new Error('AWS KMS not implemented');
  }
}

/**
 * GCP KMS Provider (NOT IMPLEMENTED - DO NOT USE)
 *
 * ⚠️  CRITICAL: This is a stub. GCP KMS integration is NOT implemented.
 *
 * To implement:
 * 1. Install @google-cloud/kms package
 * 2. Implement encryptDEK/decryptDEK using Cloud KMS API
 * 3. Configure: GCP_KMS_KEY_NAME, GCP_PROJECT_ID, GCP credentials
 * 4. Remove the constructor guard below
 *
 * For development/testing: Use KMS_PROVIDER=memory (not for production)
 */
class GCPKMSProvider implements KMSProvider {
  constructor() {
    // CRITICAL-1: Explicit startup guard (all environments)
    throw new Error(
      '[GCPKMSProvider] NOT IMPLEMENTED. Do not use KMS_PROVIDER=gcp.\n' +
        'For development: Set KMS_PROVIDER=memory (with DEV_KEK_BASE64)\n' +
        'For production: Implement GCP KMS integration first (see class docstring)'
    );
  }

  async encryptDEK(_plainDek: Buffer, _kekId: string): Promise<string> {
    throw new Error(
      'GCP KMS not implemented. This is a stub provider. ' +
        'Set KMS_PROVIDER=memory for development or KMS_PROVIDER=aws for production.'
    );
  }

  async decryptDEK(_encryptedDek: string, _kekId: string): Promise<Buffer> {
    throw new Error(
      'GCP KMS not implemented. This is a stub provider. ' +
        'Set KMS_PROVIDER=memory for development or KMS_PROVIDER=aws for production.'
    );
  }
}

/**
 * Encryption Service - Main entry point for envelope encryption
 *
 * Provides envelope encryption using Data Encryption Keys (DEKs) wrapped by
 * Key Encryption Keys (KEKs) from a KMS provider.
 *
 * Supports KEK rotation: new encryptions use current KEK ID, while decryption
 * works with any KEK ID stored in the envelope.
 */
export class EncryptionService {
  private kmsProvider: KMSProvider;
  private readonly ENCRYPTION_VERSION = 'v1-aes256gcm';
  private currentKekId: string;

  constructor(kmsProvider?: KMSProvider) {
    // Select KMS provider based on env var
    const provider = kmsProvider || this.selectKMSProvider();
    this.kmsProvider = provider;

    // Initialize KEK ID (format: kek-YYYYMM for monthly rotation)
    this.currentKekId = process.env.KEK_ID || this.generateKekId();
  }

  /**
   * Generate a KEK ID based on current year-month
   * Format: kek-YYYYMM (e.g., kek-202501 for January 2025)
   */
  private generateKekId(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `kek-${year}${month}`;
  }

  /**
   * Rotate to a new KEK for future encryptions
   *
   * This does NOT re-encrypt existing data. Old KEKs remain valid for decryption.
   * To rewrap existing data with the new KEK, run a separate rewrap job.
   *
   * @param newKekId - New KEK ID to use (e.g., 'kek-202502')
   */
  rotateKEK(newKekId: string): void {
    console.log(`[EncryptionService] Rotating KEK from ${this.currentKekId} to ${newKekId}`);
    this.currentKekId = newKekId;
  }

  /**
   * Get the current KEK ID being used for new encryptions
   */
  getCurrentKekId(): string {
    return this.currentKekId;
  }

  /**
   * Select KMS provider based on KMS_PROVIDER env var
   */
  private selectKMSProvider(): KMSProvider {
    const provider = process.env.KMS_PROVIDER || 'memory';

    // Production guard: fail early if AWS provider selected
    if (process.env.NODE_ENV === 'production' && provider === 'aws') {
      throw new Error(
        'FATAL: AWS KMS Provider not implemented. ' +
          'Set KMS_PROVIDER=memory (non-prod only) or KMS_PROVIDER=gcp (testing only). ' +
          'Production deployments require full KMS integration.'
      );
    }

    switch (provider) {
      case 'memory':
        return new MemoryKMSProvider();
      case 'aws':
        return new AWSKMSProvider();
      case 'gcp':
        return new GCPKMSProvider();
      default:
        console.warn(`Unknown KMS_PROVIDER: ${provider}. Using memory provider.`);
        return new MemoryKMSProvider();
    }
  }

  /**
   * Encrypt plaintext using envelope encryption
   *
   * Encrypts data using a randomly generated DEK, then wraps the DEK with the
   * current KEK from the KMS provider. The result is an encrypted envelope
   * containing the ciphertext and wrapped DEK.
   *
   * @param plaintext - Raw data to encrypt (sensitive content)
   * @param kekId - Optional KEK ID override (defaults to current KEK)
   * @returns Encrypted envelope with data_ciphertext, dek_ciphertext, dek_kid, iv, auth_tag
   *
   * @example
   * const service = getEncryptionService();
   * const plaintext = Buffer.from(JSON.stringify({ secret: 'data' }));
   * const envelope = await service.encrypt(plaintext);
   * // envelope.dek_kid will be current KEK (e.g., 'kek-202501')
   */
  async encrypt(plaintext: Buffer, kekId?: string): Promise<EncryptedEnvelope> {
    const useKekId = kekId || this.currentKekId;

    // Step 1: Generate random DEK
    const dek = crypto.randomBytes(DEK_BYTES);

    try {
      // Step 2: Encrypt plaintext with DEK using AES-256-GCM
      const iv = crypto.randomBytes(GCM_IV_LENGTH);
      const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv);

      const dataCiphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
      const authTag = cipher.getAuthTag();

      // Step 3: Encrypt DEK with KEK via KMS
      const dekCiphertext = await this.kmsProvider.encryptDEK(dek, useKekId);

      // Step 4: Return envelope
      return {
        data_ciphertext: dataCiphertext.toString('base64'),
        dek_ciphertext: dekCiphertext,
        dek_kid: useKekId,
        encryption_version: this.ENCRYPTION_VERSION,
        auth_tag: authTag.toString('base64'),
        iv: iv.toString('base64'),
      };
    } finally {
      // Security: Zeroize DEK buffer to prevent memory exposure
      dek.fill(0);
    }
  }

  /**
   * Decrypt envelope back to plaintext
   *
   * Unwraps the DEK using the KEK ID stored in the envelope, then decrypts
   * the data ciphertext. Works with any KEK ID, enabling seamless key rotation.
   *
   * @param envelope - Encrypted envelope from encrypt()
   * @returns Decrypted plaintext buffer
   * @throws Error if encryption version is unsupported or decryption fails
   *
   * @example
   * const service = getEncryptionService();
   * const plaintext = await service.decrypt(envelope);
   * const data = JSON.parse(plaintext.toString());
   */
  async decrypt(envelope: EncryptedEnvelope): Promise<Buffer> {
    // Validate encryption version
    if (envelope.encryption_version !== this.ENCRYPTION_VERSION) {
      throw new Error(
        `Unsupported encryption version: ${envelope.encryption_version}. Expected: ${this.ENCRYPTION_VERSION}`
      );
    }

    // Step 1: Decrypt DEK using KEK via KMS (uses envelope's dek_kid, not current)
    const dek = await this.kmsProvider.decryptDEK(envelope.dek_ciphertext, envelope.dek_kid);

    try {
      // Step 2: Decrypt data using DEK
      const iv = Buffer.from(envelope.iv, 'base64');
      const authTag = Buffer.from(envelope.auth_tag, 'base64');
      const ciphertext = Buffer.from(envelope.data_ciphertext, 'base64');

      const decipher = crypto.createDecipheriv('aes-256-gcm', dek, iv);
      decipher.setAuthTag(authTag);

      return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    } finally {
      // Security: Zeroize DEK buffer to prevent memory exposure
      dek.fill(0);
    }
  }
}

/**
 * Singleton instance
 */
let encryptionServiceInstance: EncryptionService | null = null;

/**
 * Get or create the singleton EncryptionService instance
 */
export function getEncryptionService(): EncryptionService {
  if (!encryptionServiceInstance) {
    encryptionServiceInstance = new EncryptionService();
  }
  return encryptionServiceInstance;
}

/**
 * Health check: Verify KMS provider can encrypt/decrypt round-trip
 *
 * This function should be called at server startup to ensure the KMS provider
 * is properly configured and functional. For memory provider, it verifies
 * DEK encryption/decryption works. For AWS/GCP, it should be extended to
 * verify real KMS connectivity.
 *
 * @throws Error if KMS provider is not usable
 */
export async function assertKmsUsable(): Promise<void> {
  const provider = process.env.KMS_PROVIDER || 'memory';

  // Block production usage of unimplemented providers
  if (process.env.NODE_ENV === 'production') {
    if (provider === 'aws') {
      throw new Error(
        'FATAL: AWS KMS Provider not implemented in this release. ' +
          'Production deployments must:\n' +
          '  - Implement AWS KMS integration (see TODO in encryption-service.ts)\n' +
          '  - OR use alternative KMS provider\n' +
          'For development only: Set KMS_PROVIDER=memory with DEV_KEK_BASE64'
      );
    }
    if (provider === 'gcp') {
      throw new Error(
        'FATAL: GCP KMS Provider not implemented for production use. ' +
          'Production deployments must:\n' +
          '  - Implement GCP KMS integration (see TODO in encryption-service.ts)\n' +
          '  - OR use AWS KMS (when implemented)\n' +
          'For development only: Set KMS_PROVIDER=memory with DEV_KEK_BASE64'
      );
    }
  }

  try {
    const service = getEncryptionService();
    const testData = Buffer.from('kms-health-check-test-data');

    // Round-trip test: encrypt then decrypt
    const encrypted = await service.encrypt(testData);
    const decrypted = await service.decrypt(encrypted);

    if (!testData.equals(decrypted)) {
      throw new Error('Round-trip decryption failed: data mismatch');
    }

    console.log(`[EncryptionService] KMS health check passed (provider=${provider})`);
  } catch (err) {
    console.error('[EncryptionService] KMS health check failed:', err);
    throw new Error(`KMS provider '${provider}' is not usable: ${(err as Error).message}`);
  }
}
