/**
 * JWKS (JSON Web Key Set) Manager
 *
 * Manages public key distribution for audit receipt verification
 * Phase 1.1: Ed25519 keys with rotation support
 * Phase 1.2: Uses SignerRegistry for unified key management
 */

import { getSignerRegistry } from './signer-registry';

export interface JWK {
  kty: string; // Key Type ('OKP' for Ed25519)
  use: string; // 'sig' for signing
  kid: string; // Key ID
  alg: string; // 'EdDSA' for Ed25519
  crv?: string; // Curve ('Ed25519')
  x?: string; // Public key (base64url)
}

export interface JWKS {
  keys: JWK[];
}

/**
 * JWKS Manager for public key distribution
 *
 * Provides JWKS endpoint for external verifiers
 * Supports key rotation with active + historical keys
 */
export class JWKSManager {
  /**
   * Get current JWKS (active keys only)
   * Phase 1.2: Returns current key + previous key (if within grace period)
   */
  async getJWKS(): Promise<JWKS> {
    const registry = await getSignerRegistry();
    const signers = registry.getVerificationSigners();

    // Get JWKs from all verification signers (current + previous if in grace)
    const keys = signers.map((signer) => signer.getPublicKeyJWK());

    return {
      keys,
    };
  }

  /**
   * Get full JWKS (active + historical keys)
   * Phase 1.2: Same as getJWKS() - includes grace period keys
   */
  async getFullJWKS(): Promise<JWKS> {
    // Phase 1.2: getJWKS() already includes rotation grace period keys
    return this.getJWKS();
  }

  /**
   * Get key by ID
   * Useful for signature verification
   */
  async getKeyById(kid: string): Promise<JWK | null> {
    const jwks = await this.getFullJWKS();
    return jwks.keys.find((key) => key.kid === kid) || null;
  }
}

// Singleton instance
let jwksManagerInstance: JWKSManager | null = null;

/**
 * Get global JWKS manager instance
 */
export async function getJWKSManager(): Promise<JWKSManager> {
  if (!jwksManagerInstance) {
    jwksManagerInstance = new JWKSManager();
  }
  return jwksManagerInstance;
}
