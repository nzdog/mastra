/**
 * Cryptographic Signing for Audit Receipts
 *
 * Provides digital signatures for tamper-proof audit receipts
 * Phase 1: RSA-based signing with key management
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface SignatureResult {
  signature: string; // Base64-encoded signature
  algorithm: string;
  keyId: string; // Identifier for the signing key
  timestamp: string;
}

export interface VerificationResult {
  valid: boolean;
  keyId: string;
  algorithm: string;
  message?: string;
}

/**
 * Cryptographic signer for audit receipts
 *
 * Uses RSA-SHA256 for digital signatures
 * Supports key rotation and verification
 */
export class CryptoSigner {
  private privateKey: crypto.KeyObject | null = null;
  private publicKey: crypto.KeyObject | null = null;
  private keyId: string;
  private algorithm: string = 'RSA-SHA256';
  private keyDir: string;

  constructor(keyId?: string, keyDir?: string) {
    this.keyId = keyId || this.generateKeyId();
    this.keyDir = keyDir || path.join(process.cwd(), '.keys');

    // Create key directory if it doesn't exist
    if (!fs.existsSync(this.keyDir)) {
      fs.mkdirSync(this.keyDir, { recursive: true });
    }
  }

  /**
   * Initialize signing keys
   * Loads existing keys or generates new ones
   */
  async initialize(): Promise<void> {
    const privateKeyPath = path.join(this.keyDir, `${this.keyId}-private.pem`);
    const publicKeyPath = path.join(this.keyDir, `${this.keyId}-public.pem`);

    if (fs.existsSync(privateKeyPath) && fs.existsSync(publicKeyPath)) {
      // Load existing keys
      const privateKeyPem = fs.readFileSync(privateKeyPath, 'utf8');
      const publicKeyPem = fs.readFileSync(publicKeyPath, 'utf8');

      this.privateKey = crypto.createPrivateKey(privateKeyPem);
      this.publicKey = crypto.createPublicKey(publicKeyPem);

      console.log(`🔑 Loaded existing signing keys (keyId: ${this.keyId})`);
    } else {
      // Generate new key pair
      await this.generateKeys();
    }
  }

  /**
   * Generate new RSA key pair
   */
  private async generateKeys(): Promise<void> {
    console.log(`🔑 Generating new RSA key pair (keyId: ${this.keyId})...`);

    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    this.privateKey = crypto.createPrivateKey(privateKey);
    this.publicKey = crypto.createPublicKey(publicKey);

    // Save keys to disk
    const privateKeyPath = path.join(this.keyDir, `${this.keyId}-private.pem`);
    const publicKeyPath = path.join(this.keyDir, `${this.keyId}-public.pem`);

    fs.writeFileSync(privateKeyPath, privateKey, { mode: 0o600 }); // Private key: owner read/write only
    fs.writeFileSync(publicKeyPath, publicKey, { mode: 0o644 }); // Public key: world readable

    console.log(`✅ RSA key pair generated and saved (keyId: ${this.keyId})`);
  }

  /**
   * Sign data with private key
   * Returns signature result with metadata
   */
  sign(data: string): SignatureResult {
    if (!this.privateKey) {
      throw new Error('Private key not initialized. Call initialize() first.');
    }

    const signer = crypto.createSign('RSA-SHA256');
    signer.update(data, 'utf8');
    signer.end();

    const signature = signer.sign(this.privateKey, 'base64');

    return {
      signature,
      algorithm: this.algorithm,
      keyId: this.keyId,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Verify signature with public key
   */
  verify(data: string, signature: string): VerificationResult {
    if (!this.publicKey) {
      return {
        valid: false,
        keyId: this.keyId,
        algorithm: this.algorithm,
        message: 'Public key not initialized',
      };
    }

    try {
      const verifier = crypto.createVerify('RSA-SHA256');
      verifier.update(data, 'utf8');
      verifier.end();

      const valid = verifier.verify(this.publicKey, signature, 'base64');

      return {
        valid,
        keyId: this.keyId,
        algorithm: this.algorithm,
        message: valid ? 'Signature verified' : 'Signature verification failed',
      };
    } catch (error) {
      return {
        valid: false,
        keyId: this.keyId,
        algorithm: this.algorithm,
        message: error instanceof Error ? error.message : 'Verification error',
      };
    }
  }

  /**
   * Get public key in PEM format (for sharing)
   */
  getPublicKeyPem(): string {
    if (!this.publicKey) {
      throw new Error('Public key not initialized');
    }

    return this.publicKey.export({
      type: 'spki',
      format: 'pem',
    }) as string;
  }

  /**
   * Get key ID
   */
  getKeyId(): string {
    return this.keyId;
  }

  /**
   * Generate unique key ID
   */
  private generateKeyId(): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    return `key_${timestamp}_${random}`;
  }

  /**
   * Rotate keys (generate new key pair)
   * Archives old keys with timestamp
   */
  async rotateKeys(): Promise<string> {
    console.log(`🔄 Rotating signing keys (current keyId: ${this.keyId})...`);

    // Archive old keys
    if (this.privateKey && this.publicKey) {
      const archiveTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const oldPrivateKeyPath = path.join(this.keyDir, `${this.keyId}-private.pem`);
      const oldPublicKeyPath = path.join(this.keyDir, `${this.keyId}-public.pem`);

      const archivedPrivatePath = path.join(
        this.keyDir,
        `${this.keyId}-private-${archiveTimestamp}.pem`
      );
      const archivedPublicPath = path.join(
        this.keyDir,
        `${this.keyId}-public-${archiveTimestamp}.pem`
      );

      if (fs.existsSync(oldPrivateKeyPath)) {
        fs.renameSync(oldPrivateKeyPath, archivedPrivatePath);
      }
      if (fs.existsSync(oldPublicKeyPath)) {
        fs.renameSync(oldPublicKeyPath, archivedPublicPath);
      }

      console.log(`📦 Archived old keys with timestamp: ${archiveTimestamp}`);
    }

    // Generate new key ID and keys
    const oldKeyId = this.keyId;
    this.keyId = this.generateKeyId();
    await this.generateKeys();

    console.log(`✅ Key rotation complete: ${oldKeyId} → ${this.keyId}`);

    return this.keyId;
  }

  /**
   * Check if keys need rotation based on age
   * Returns true if keys are older than maxAge (in days)
   */
  needsRotation(maxAgeDays: number = 90): boolean {
    const privateKeyPath = path.join(this.keyDir, `${this.keyId}-private.pem`);

    if (!fs.existsSync(privateKeyPath)) {
      return true; // Keys don't exist, need to generate
    }

    const stats = fs.statSync(privateKeyPath);
    const keyAgeDays = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24);

    return keyAgeDays >= maxAgeDays;
  }

  /**
   * Get key rotation status
   */
  getKeyRotationStatus(): {
    keyId: string;
    createdAt: string;
    ageDays: number;
    needsRotation: boolean;
    maxAgeDays: number;
  } {
    const maxAgeDays = 90;
    const privateKeyPath = path.join(this.keyDir, `${this.keyId}-private.pem`);

    if (!fs.existsSync(privateKeyPath)) {
      return {
        keyId: this.keyId,
        createdAt: 'N/A',
        ageDays: 0,
        needsRotation: true,
        maxAgeDays,
      };
    }

    const stats = fs.statSync(privateKeyPath);
    const createdAt = stats.mtime.toISOString();
    const ageDays = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24);

    return {
      keyId: this.keyId,
      createdAt,
      ageDays: Math.round(ageDays * 10) / 10,
      needsRotation: this.needsRotation(maxAgeDays),
      maxAgeDays,
    };
  }
}

// Singleton instance
let signerInstance: CryptoSigner | null = null;

/**
 * Get global crypto signer instance
 */
export async function getCryptoSigner(): Promise<CryptoSigner> {
  if (!signerInstance) {
    signerInstance = new CryptoSigner();
    await signerInstance.initialize();
  }
  return signerInstance;
}
