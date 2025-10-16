/**
 * Persistent Ledger Sink for Audit Events
 *
 * Integrates Merkle tree and cryptographic signing for tamper-evident audit logging
 * Phase 1: File-based persistence (dev)
 * Future: Database-backed for production
 */

import * as fs from 'fs';
import * as path from 'path';
import { MerkleTree, MerkleNode, MerkleProof } from '../governance/merkle-tree';
import { CryptoSigner, SignatureResult } from '../governance/crypto-signer';

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
  private signer: CryptoSigner;
  private ledgerPath: string;
  private ledgerHeight: number = 0;
  private initialized: boolean = false;

  constructor(ledgerDir?: string) {
    this.merkleTree = new MerkleTree();
    this.signer = new CryptoSigner();
    this.ledgerPath = ledgerDir || path.join(process.cwd(), '.ledger');

    // Create ledger directory if it doesn't exist
    if (!fs.existsSync(this.ledgerPath)) {
      fs.mkdirSync(this.ledgerPath, { recursive: true });
    }
  }

  /**
   * Initialize ledger sink
   * Loads existing ledger or creates new one
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Initialize crypto signer (loads or generates keys)
    await this.signer.initialize();

    // Try to load existing ledger state
    const statePath = path.join(this.ledgerPath, 'ledger-state.json');
    if (fs.existsSync(statePath)) {
      await this.loadState();
      console.log(`📚 Loaded existing ledger (height: ${this.ledgerHeight})`);
    } else {
      console.log('📚 Initialized new ledger');
    }

    this.initialized = true;
  }

  /**
   * Append audit event to ledger
   * Returns signed audit receipt with Merkle proof
   */
  async append(event: AuditEvent): Promise<SignedAuditReceipt> {
    if (!this.initialized) {
      throw new Error('LedgerSink not initialized. Call initialize() first.');
    }

    // Serialize event for Merkle tree
    const eventData = JSON.stringify(event);

    // Append to Merkle tree
    const { node, proof } = this.merkleTree.append(eventData);

    // Sign the Merkle root + event data
    const signaturePayload = JSON.stringify({
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
    };

    // Persist receipt to disk
    await this.persistReceipt(receipt);

    // Persist ledger state
    await this.persistState(event.event_id, receiptId);

    return receipt;
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
    // Verify Merkle proof
    const eventData = JSON.stringify(receipt.event);
    const merkleValid = this.merkleTree.verifyProof(receipt.merkle.proof, eventData);

    // Verify signature
    const signaturePayload = JSON.stringify({
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
   * Persist audit receipt to disk
   */
  private async persistReceipt(receipt: SignedAuditReceipt): Promise<void> {
    const receiptsDir = path.join(this.ledgerPath, 'receipts');
    if (!fs.existsSync(receiptsDir)) {
      fs.mkdirSync(receiptsDir, { recursive: true });
    }

    const receiptPath = path.join(receiptsDir, `${receipt.receipt_id}.json`);
    fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), 'utf8');
  }

  /**
   * Persist ledger state
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
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
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
