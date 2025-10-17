/**
 * Persistent Ledger Sink for Audit Events
 *
 * Integrates Merkle tree and cryptographic signing for tamper-evident audit logging
 * Phase 1: File-based persistence (dev)
 * Future: Database-backed for production
 */

import * as fs from 'fs';
import * as path from 'path';
import * as lockfile from 'proper-lockfile';
import {
  auditLedgerHeight,
  auditMerkleAppendDuration,
  auditFileLockWaitDuration,
  auditCrashRecoveryTempFilesRemoved,
  measureSync,
  measureAsync,
} from '../../observability/metrics';
import { CryptoSigner, SignatureResult } from '../governance/crypto-signer';
import { getSignerRegistry } from '../governance/signer-registry';
import { MerkleTree, MerkleNode, MerkleProof } from '../governance/merkle-tree';
import { canonicalStringify } from '../utils/canonical-json';

export interface AuditEvent {
  event_id: string;
  timestamp: string;
  event_type: string;
  operation: string;
  user_id?: string;
  session_id?: string;
  payload: Record<string, any>;
  consent_context?: {
    consent_level: 'personal' | 'cohort' | 'population';
    scope: string[];
    expiry?: string;
    revocable: boolean;
  };
  // Phase 1.1 fields
  schemaVersion?: string; // e.g., '1.1.0'
  policyVersion?: string; // e.g., '2025-01'
  consentScope?: string[]; // e.g., ['personal', 'audit']
}

export interface SignedAuditReceipt {
  event: AuditEvent;
  merkle: {
    leaf_hash: string;
    root_hash: string;
    proof: MerkleProof;
    index: number;
  };
  signature: SignatureResult;
  ledger_height: number;
  receipt_id: string;
  schemaVersion: string;     // e.g., "1.0.0"
  policyVersion: string;     // e.g., "2025-10-phase2"
  consentScope: string[];    // e.g., ["personal:read", "personal:write"]
}

export interface LedgerState {
  merkle_tree: {
    nodes: MerkleNode[];
    root: string;
    size: number;
    algorithm: string;
  };
  last_event_id: string;
  last_receipt_id: string;
  ledger_height: number;
  created_at: string;
  last_updated: string;
}

/**
 * Persistent ledger sink for audit events
 *
 * Combines Merkle chain + cryptographic signatures for tamper-evident logging
 * Provides signed audit receipts for all operations
 */
export class LedgerSink {
  private merkleTree: MerkleTree;
  private signer: CryptoSigner | null = null; // Phase 1.2: Initialized from SignerRegistry
  private ledgerPath: string;
  private ledgerHeight: number = 0;
  private initialized: boolean = false;

  constructor(ledgerDir?: string) {
    this.merkleTree = new MerkleTree();
    // Phase 1.2: Do NOT create CryptoSigner here - use SignerRegistry instead
    this.ledgerPath = ledgerDir || path.join(process.cwd(), '.ledger');

    // Create ledger directory if it doesn't exist
    if (!fs.existsSync(this.ledgerPath)) {
      fs.mkdirSync(this.ledgerPath, { recursive: true });
    }
  }

  /**
   * Initialize ledger sink
   * Loads existing ledger or creates new one
   * Phase 1.1: Includes crash recovery
   * Phase 1.2: Uses SignerRegistry for unified key management
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Phase 1.2: Get signer from SignerRegistry (ensures same key as JWKS)
    const registry = await getSignerRegistry();
    this.signer = registry.getActiveSigner();
    console.log(`🔗 LedgerSink using SignerRegistry signer (kid: ${this.signer.getKeyId()})`);

    // Phase 1.1: Check for incomplete writes from crashes
    await this.recoverFromCrash();

    // Try to load existing ledger state
    const statePath = path.join(this.ledgerPath, 'ledger-state.json');
    if (fs.existsSync(statePath)) {
      await this.loadState();
      console.log(`📚 Loaded existing ledger (height: ${this.ledgerHeight})`);

      // Phase 1.1: Verify ledger integrity after crash recovery
      const verification = this.merkleTree.verifyChain();
      if (!verification.valid) {
        throw new Error(`Ledger corrupted: ${verification.message}`);
      }
    } else {
      console.log('📚 Initialized new ledger');
    }

    this.initialized = true;
  }

  /**
   * Recover from crash by removing incomplete writes
   * Phase 1.1: Removes .tmp files left by crashed atomic writes
   */
  private async recoverFromCrash(): Promise<void> {
    try {
      // Find and remove any .tmp files in ledger directory
      const files = await fs.promises.readdir(this.ledgerPath);
      const tempFiles = files.filter((f) => f.includes('.tmp.'));

      for (const tempFile of tempFiles) {
        const tempPath = path.join(this.ledgerPath, tempFile);
        await fs.promises.unlink(tempPath);
        console.log(`🔧 Removed incomplete write: ${tempFile}`);
        // Phase 1.2: Emit crash recovery metric
        auditCrashRecoveryTempFilesRemoved.inc();
      }

      // Check receipts directory
      const receiptsDir = path.join(this.ledgerPath, 'receipts');
      if (fs.existsSync(receiptsDir)) {
        const receiptFiles = await fs.promises.readdir(receiptsDir);
        const tempReceiptFiles = receiptFiles.filter((f) => f.includes('.tmp.'));

        for (const tempFile of tempReceiptFiles) {
          const tempPath = path.join(receiptsDir, tempFile);
          await fs.promises.unlink(tempPath);
          console.log(`🔧 Removed incomplete receipt write: ${tempFile}`);
        }
      }
    } catch (error) {
      // If directory doesn't exist yet, that's fine
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('⚠️  Crash recovery error:', error);
      }
    }
  }

  /**
   * Append audit event to ledger
   * Returns signed audit receipt with Merkle proof
   * Phase 1.1: With file locking for concurrent writes
   */
  async append(event: AuditEvent): Promise<SignedAuditReceipt> {
    if (!this.initialized) {
      throw new Error('LedgerSink not initialized. Call initialize() first.');
    }

    // Acquire lock for concurrent write protection
    // Phase 1.1: Prevents race conditions in multi-process environments
    // Phase 1.2: Measure lock wait time
    const release = await measureAsync(auditFileLockWaitDuration, undefined, async () => {
      // Note: Lock contention metrics would require wrapping retry logic separately
      // For Phase 1.2, we track lock wait time; contention tracking can be added in future phases
      return await lockfile.lock(this.ledgerPath, {
        stale: 10000, // 10 second stale timeout
        retries: {
          retries: 5,
          minTimeout: 100,
          maxTimeout: 1000,
        },
      });
    });

    try {
      // Serialize event for Merkle tree using canonical JSON
      // Phase 1.1: Ensures deterministic serialization for verification
      const eventData = canonicalStringify(event);

      // Append to Merkle tree
      // Phase 1.2: Measure Merkle append time
      const { node, proof } = measureSync(auditMerkleAppendDuration, undefined, () =>
        this.merkleTree.append(eventData)
      );

      // Sign the Merkle root + event data using canonical JSON
      // Phase 1.1: Canonical serialization prevents signature verification failures
      if (!this.signer) {
        throw new Error('Signer not initialized from SignerRegistry');
      }
      const signaturePayload = canonicalStringify({
        root: proof.root,
        leaf: proof.leaf,
        event_id: event.event_id,
        timestamp: event.timestamp,
      });
      const signature = this.signer.sign(signaturePayload);

      // Increment ledger height
      this.ledgerHeight++;

      // Generate receipt ID
      const receiptId = this.generateReceiptId(event.event_id, node.index);

      const receipt: SignedAuditReceipt = {
        event,
        merkle: {
          leaf_hash: node.hash,
          root_hash: proof.root,
          proof,
          index: node.index,
        },
        signature,
        ledger_height: this.ledgerHeight,
        receipt_id: receiptId,
        schemaVersion: event.schemaVersion || '1.0.0',
        policyVersion: event.policyVersion || '2025-10-phase2',
        consentScope: event.consentScope || [],
      };

      // Persist receipt to disk (with atomic writes)
      await this.persistReceipt(receipt);

      // Persist ledger state (with atomic writes)
      await this.persistState(event.event_id, receiptId);

      // Phase 1.2: Emit ledger height metric
      auditLedgerHeight.set(this.ledgerHeight);

      return receipt;
    } finally {
      // Always release lock
      await release();
    }
  }

  /**
   * Verify audit receipt
   * Checks Merkle proof and cryptographic signature
   */
  verifyReceipt(receipt: SignedAuditReceipt): {
    valid: boolean;
    merkle_valid: boolean;
    signature_valid: boolean;
    message: string;
  } {
    if (!this.signer) {
      throw new Error('Signer not initialized from SignerRegistry');
    }

    // Verify Merkle proof using canonical JSON
    // Phase 1.1: Must use same serialization as during signing
    const eventData = canonicalStringify(receipt.event);
    const merkleValid = this.merkleTree.verifyProof(receipt.merkle.proof, eventData);

    // Verify signature using canonical JSON
    // Phase 1.1: Must use same serialization as during signing
    const signaturePayload = canonicalStringify({
      root: receipt.merkle.root_hash,
      leaf: receipt.merkle.leaf_hash,
      event_id: receipt.event.event_id,
      timestamp: receipt.event.timestamp,
    });
    const signatureResult = this.signer.verify(signaturePayload, receipt.signature.signature);

    const valid = merkleValid && signatureResult.valid;

    let message = '';
    if (!merkleValid) {
      message += 'Merkle proof invalid. ';
    }
    if (!signatureResult.valid) {
      message += `Signature invalid: ${signatureResult.message}. `;
    }
    if (valid) {
      message = 'Receipt verified successfully';
    }

    return {
      valid,
      merkle_valid: merkleValid,
      signature_valid: signatureResult.valid,
      message: message.trim(),
    };
  }

  /**
   * Verify entire ledger chain integrity
   */
  verifyChain(): {
    valid: boolean;
    brokenAt?: number;
    message: string;
  } {
    return this.merkleTree.verifyChain();
  }

  /**
   * Get ledger height (total events)
   */
  getLedgerHeight(): number {
    return this.ledgerHeight;
  }

  /**
   * Get Merkle root hash
   */
  getRootHash(): string {
    return this.merkleTree.getRoot();
  }

  /**
   * Get key rotation status
   */
  getKeyRotationStatus() {
    if (!this.signer) {
      throw new Error('Signer not initialized from SignerRegistry');
    }
    return this.signer.getKeyRotationStatus();
  }

  /**
   * Load audit receipt by ID
   */
  async getReceipt(receiptId: string): Promise<SignedAuditReceipt | null> {
    const receiptPath = path.join(this.ledgerPath, 'receipts', `${receiptId}.json`);
    if (!fs.existsSync(receiptPath)) {
      return null;
    }

    const receiptData = fs.readFileSync(receiptPath, 'utf8');
    return JSON.parse(receiptData);
  }

  /**
   * List recent receipts (last N)
   */
  async listReceipts(limit: number = 10): Promise<SignedAuditReceipt[]> {
    const receiptsDir = path.join(this.ledgerPath, 'receipts');
    if (!fs.existsSync(receiptsDir)) {
      return [];
    }

    const files = fs
      .readdirSync(receiptsDir)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, limit);

    const receipts: SignedAuditReceipt[] = [];
    for (const file of files) {
      const filePath = path.join(receiptsDir, file);
      const data = fs.readFileSync(filePath, 'utf8');
      receipts.push(JSON.parse(data));
    }

    return receipts;
  }

  /**
   * Atomic write with fsync for durability
   * Phase 1.1: Prevents data loss from crashes
   */
  private async atomicWrite(filePath: string, data: string): Promise<void> {
    const tempPath = `${filePath}.tmp.${Date.now()}`;

    try {
      // Write to temp file
      await fs.promises.writeFile(tempPath, data, 'utf8');

      // Sync to disk (critical for durability)
      const fd = await fs.promises.open(tempPath, 'r');
      await fd.sync();
      await fd.close();

      // Atomic rename
      await fs.promises.rename(tempPath, filePath);
    } catch (error) {
      // Cleanup temp file on error
      try {
        await fs.promises.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  /**
   * Persist audit receipt to disk
   * Phase 1.1: Uses atomic writes with fsync
   */
  private async persistReceipt(receipt: SignedAuditReceipt): Promise<void> {
    const receiptsDir = path.join(this.ledgerPath, 'receipts');
    if (!fs.existsSync(receiptsDir)) {
      fs.mkdirSync(receiptsDir, { recursive: true });
    }

    const receiptPath = path.join(receiptsDir, `${receipt.receipt_id}.json`);
    await this.atomicWrite(receiptPath, JSON.stringify(receipt, null, 2));
  }

  /**
   * Persist ledger state
   * Phase 1.1: Uses atomic writes with fsync
   */
  private async persistState(lastEventId: string, lastReceiptId: string): Promise<void> {
    const state: LedgerState = {
      merkle_tree: this.merkleTree.export(),
      last_event_id: lastEventId,
      last_receipt_id: lastReceiptId,
      ledger_height: this.ledgerHeight,
      created_at: this.ledgerHeight === 1 ? new Date().toISOString() : this.getCreatedAt(),
      last_updated: new Date().toISOString(),
    };

    const statePath = path.join(this.ledgerPath, 'ledger-state.json');
    await this.atomicWrite(statePath, JSON.stringify(state, null, 2));
  }

  /**
   * Load ledger state from disk
   */
  private async loadState(): Promise<void> {
    const statePath = path.join(this.ledgerPath, 'ledger-state.json');
    if (!fs.existsSync(statePath)) {
      return;
    }

    const stateData = fs.readFileSync(statePath, 'utf8');
    const state: LedgerState = JSON.parse(stateData);

    // Import Merkle tree state
    this.merkleTree.import(state.merkle_tree);

    // Restore ledger height
    this.ledgerHeight = state.ledger_height;
  }

  /**
   * Get ledger creation timestamp
   */
  private getCreatedAt(): string {
    const statePath = path.join(this.ledgerPath, 'ledger-state.json');
    if (!fs.existsSync(statePath)) {
      return new Date().toISOString();
    }

    const stateData = fs.readFileSync(statePath, 'utf8');
    const state: LedgerState = JSON.parse(stateData);
    return state.created_at;
  }

  /**
   * Generate unique receipt ID
   */
  private generateReceiptId(eventId: string, merkleIndex: number): string {
    const timestamp = Date.now();
    return `rcpt_${timestamp}_${merkleIndex}_${eventId.substring(0, 8)}`;
  }

  /**
   * Export ledger for backup/migration
   */
  async exportLedger(): Promise<{
    state: LedgerState;
    receipts: SignedAuditReceipt[];
    key_info: {
      keyId: string;
      publicKey: string;
    };
  }> {
    if (!this.signer) {
      throw new Error('Signer not initialized from SignerRegistry');
    }

    const statePath = path.join(this.ledgerPath, 'ledger-state.json');
    const stateData = fs.readFileSync(statePath, 'utf8');
    const state: LedgerState = JSON.parse(stateData);

    const receipts = await this.listReceipts(this.ledgerHeight);

    return {
      state,
      receipts,
      key_info: {
        keyId: this.signer.getKeyId(),
        publicKey: this.signer.getPublicKeyPem(),
      },
    };
  }
}

// Singleton instance
let ledgerSinkInstance: LedgerSink | null = null;

/**
 * Get global ledger sink instance
 */
export async function getLedgerSink(): Promise<LedgerSink> {
  if (!ledgerSinkInstance) {
    ledgerSinkInstance = new LedgerSink();
    await ledgerSinkInstance.initialize();
  }
  return ledgerSinkInstance;
}
