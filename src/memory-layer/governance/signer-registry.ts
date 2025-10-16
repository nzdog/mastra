/**
 * Signer Registry - Process-wide CryptoSigner Management
 *
 * Ensures LedgerSink and JWKS endpoint use the SAME signing key.
 * Implements RFC 7638 JWK thumbprint for stable kid generation.
 * Supports key rotation with grace period for verification.
 *
 * Phase 1.2: Unified signer to prevent key divergence
 */

import * as crypto from 'crypto';
import { CryptoSigner } from './crypto-signer';

export interface SignerRotationState {
  current: CryptoSigner;
  previous: CryptoSigner | null;
  rotatedAt: string | null;
  gracePeriodHours: number;
}

/**
 * Process-wide signer registry
 * Ensures all components use the same signing key
 */
export class SignerRegistry {
  private current: CryptoSigner | null = null;
  private previous: CryptoSigner | null = null;
  private rotatedAt: Date | null = null;
  private readonly gracePeriodHours: number = 48; // 48-hour grace period for key rotation

  /**
   * Initialize the registry with the active signer
   * @param keyId Optional key ID to load specific key
   * @param keyDir Optional key directory path
   */
  async initialize(keyId?: string, keyDir?: string): Promise<void> {
    if (this.current) {
      console.log('⚠️ SignerRegistry already initialized, skipping');
      return;
    }

    this.current = new CryptoSigner(keyId, keyDir);
    await this.current.initialize();

    console.log(`✅ SignerRegistry initialized with keyId: ${this.current.getKeyId()}`);
  }

  /**
   * Get the active signer for signing operations
   * All signing MUST use this instance
   */
  getActiveSigner(): CryptoSigner {
    if (!this.current) {
      throw new Error('SignerRegistry not initialized. Call initialize() first.');
    }
    return this.current;
  }

  /**
   * Get all signers (current + previous) for verification
   * Used by JWKS endpoint to publish both keys during rotation grace period
   */
  getVerificationSigners(): CryptoSigner[] {
    if (!this.current) {
      throw new Error('SignerRegistry not initialized. Call initialize() first.');
    }

    const signers = [this.current];

    // Include previous key if within grace period
    if (this.previous && this.isWithinGracePeriod()) {
      signers.push(this.previous);
    }

    return signers;
  }

  /**
   * Rotate signing keys
   * Archives current key as previous and generates new current key
   */
  async rotateKeys(): Promise<string> {
    if (!this.current) {
      throw new Error('SignerRegistry not initialized. Call initialize() first.');
    }

    console.log(`🔄 SignerRegistry: Rotating keys...`);

    // Archive current as previous
    this.previous = this.current;
    this.rotatedAt = new Date();

    // Generate new current key
    const newKeyId = await this.current.rotateKeys();

    console.log(`✅ SignerRegistry: Key rotation complete`);
    console.log(`   Previous: ${this.previous.getKeyId()} (grace period active)`);
    console.log(`   Current:  ${newKeyId}`);

    return newKeyId;
  }

  /**
   * Check if previous key is within grace period
   */
  private isWithinGracePeriod(): boolean {
    if (!this.rotatedAt) {
      return false;
    }

    const hoursSinceRotation = (Date.now() - this.rotatedAt.getTime()) / (1000 * 60 * 60);
    return hoursSinceRotation < this.gracePeriodHours;
  }

  /**
   * Get rotation state for monitoring/health checks
   */
  getRotationState(): SignerRotationState {
    if (!this.current) {
      throw new Error('SignerRegistry not initialized');
    }

    return {
      current: this.current,
      previous: this.previous,
      rotatedAt: this.rotatedAt?.toISOString() || null,
      gracePeriodHours: this.gracePeriodHours,
    };
  }

  /**
   * Get the current signing kid (key ID)
   * Used for health checks and monitoring
   */
  getCurrentKid(): string {
    if (!this.current) {
      throw new Error('SignerRegistry not initialized');
    }
    return this.current.getKeyId();
  }

  /**
   * Get all active kids (current + previous if in grace period)
   */
  getActiveKids(): string[] {
    const signers = this.getVerificationSigners();
    return signers.map(s => s.getKeyId());
  }
}

// Process-wide singleton instance
let registryInstance: SignerRegistry | null = null;

/**
 * Get the global signer registry
 * All components MUST use this to get signers
 */
export async function getSignerRegistry(): Promise<SignerRegistry> {
  if (!registryInstance) {
    registryInstance = new SignerRegistry();
    await registryInstance.initialize();
  }
  return registryInstance;
}

/**
 * Compute RFC 7638 JWK thumbprint for a public key
 * Ensures stable kid across restarts
 *
 * @param jwk JSON Web Key (public key)
 * @returns Base64url-encoded SHA-256 thumbprint
 */
export function computeJwkThumbprint(jwk: Record<string, unknown>): string {
  // RFC 7638: Required members only, in lexicographic order
  const requiredMembers: Record<string, unknown> = {};

  if (jwk.kty === 'OKP') {
    // Ed25519: crv, kty, x
    requiredMembers.crv = jwk.crv;
    requiredMembers.kty = jwk.kty;
    requiredMembers.x = jwk.x;
  } else if (jwk.kty === 'RSA') {
    // RSA: e, kty, n
    requiredMembers.e = jwk.e;
    requiredMembers.kty = jwk.kty;
    requiredMembers.n = jwk.n;
  } else {
    throw new Error(`Unsupported key type for thumbprint: ${jwk.kty}`);
  }

  // Canonicalize JSON (lexicographic order, no whitespace)
  const canonicalJson = JSON.stringify(requiredMembers, Object.keys(requiredMembers).sort());

  // SHA-256 hash
  const hash = crypto.createHash('sha256').update(canonicalJson, 'utf8').digest();

  // Base64url encode (replace + with -, / with _, remove padding =)
  return hash.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}
