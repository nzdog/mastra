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
    // Initialize default KEK for development
    this.keys.set('kek-default', crypto.randomBytes(32)); // 256-bit KEK
  }

  async encryptDEK(plainDek: Buffer, kekId: string): Promise<string> {
    const kek = this.keys.get(kekId);
    if (!kek) {
      throw new Error(`KEK not found: ${kekId}`);
    }

    // Encrypt DEK with KEK using AES-256-GCM
    const iv = crypto.randomBytes(12); // 96-bit IV for GCM
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
    const iv = combined.subarray(0, 12);
    const authTag = combined.subarray(12, 28); // GCM auth tag is 16 bytes
    const ciphertext = combined.subarray(28);

    // Decrypt DEK with KEK
    const decipher = crypto.createDecipheriv('aes-256-gcm', kek, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }
}

/**
 * AWS KMS Provider (TODO: Implement in production)
 */
class AWSKMSProvider implements KMSProvider {
  async encryptDEK(plainDek: Buffer, kekId: string): Promise<string> {
    throw new Error('AWS KMS not implemented yet. Set KMS_PROVIDER=memory for development.');
  }

  async decryptDEK(encryptedDek: string, kekId: string): Promise<Buffer> {
    throw new Error('AWS KMS not implemented yet. Set KMS_PROVIDER=memory for development.');
  }
}

/**
 * GCP KMS Provider (TODO: Implement in production)
 */
class GCPKMSProvider implements KMSProvider {
  async encryptDEK(plainDek: Buffer, kekId: string): Promise<string> {
    throw new Error('GCP KMS not implemented yet. Set KMS_PROVIDER=memory for development.');
  }

  async decryptDEK(encryptedDek: string, kekId: string): Promise<Buffer> {
    throw new Error('GCP KMS not implemented yet. Set KMS_PROVIDER=memory for development.');
  }
}

/**
 * Encryption Service - Main entry point
 */
export class EncryptionService {
  private kmsProvider: KMSProvider;
  private readonly ENCRYPTION_VERSION = 'v1-aes256gcm';

  constructor(kmsProvider?: KMSProvider) {
    // Select KMS provider based on env var
    const provider = kmsProvider || this.selectKMSProvider();
    this.kmsProvider = provider;
  }

  /**
   * Select KMS provider based on KMS_PROVIDER env var
   */
  private selectKMSProvider(): KMSProvider {
    const provider = process.env.KMS_PROVIDER || 'memory';

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
   * @param plaintext - Raw data to encrypt
   * @param kekId - Key Encryption Key ID (e.g., 'kek-default')
   * @returns Encrypted envelope with all components
   */
  async encrypt(plaintext: Buffer, kekId: string): Promise<EncryptedEnvelope> {
    // Step 1: Generate random DEK (256-bit for AES-256)
    const dek = crypto.randomBytes(32);

    // Step 2: Encrypt plaintext with DEK using AES-256-GCM
    const iv = crypto.randomBytes(12); // 96-bit IV for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv);

    const dataCiphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Step 3: Encrypt DEK with KEK via KMS
    const dekCiphertext = await this.kmsProvider.encryptDEK(dek, kekId);

    // Step 4: Return envelope
    return {
      data_ciphertext: dataCiphertext.toString('base64'),
      dek_ciphertext: dekCiphertext,
      dek_kid: kekId,
      encryption_version: this.ENCRYPTION_VERSION,
      auth_tag: authTag.toString('base64'),
      iv: iv.toString('base64'),
    };
  }

  /**
   * Decrypt envelope back to plaintext
   * @param envelope - Encrypted envelope from encrypt()
   * @returns Decrypted plaintext
   */
  async decrypt(envelope: EncryptedEnvelope): Promise<Buffer> {
    // Validate encryption version
    if (envelope.encryption_version !== this.ENCRYPTION_VERSION) {
      throw new Error(
        `Unsupported encryption version: ${envelope.encryption_version}. Expected: ${this.ENCRYPTION_VERSION}`
      );
    }

    // Step 1: Decrypt DEK using KEK via KMS
    const dek = await this.kmsProvider.decryptDEK(envelope.dek_ciphertext, envelope.dek_kid);

    // Step 2: Decrypt data using DEK
    const iv = Buffer.from(envelope.iv, 'base64');
    const authTag = Buffer.from(envelope.auth_tag, 'base64');
    const ciphertext = Buffer.from(envelope.data_ciphertext, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', dek, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
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
