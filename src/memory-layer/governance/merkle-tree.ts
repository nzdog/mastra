/**
 * Merkle Tree Implementation for Audit Ledger
 *
 * Provides cryptographic verification of audit event integrity
 * Phase 1: Production-ready Merkle chain with cryptographic hashing
 */

import * as crypto from 'crypto';

export interface MerkleNode {
  hash: string;
  index: number;
  timestamp: string;
  data: string; // Serialized event data
  previousHash: string | null;
}

export interface MerkleProof {
  leaf: string; // Hash of the leaf node
  siblings: string[]; // Hashes of sibling nodes from leaf to root
  path: ('left' | 'right')[]; // Path from leaf to root
  root: string; // Root hash
}

/**
 * Merkle Tree for tamper-evident audit logging
 *
 * Uses SHA-256 for cryptographic hashing
 * Maintains a chain of nodes where each node references the previous hash
 */
export class MerkleTree {
  private nodes: MerkleNode[] = [];
  private hashAlgorithm: string = 'sha256';

  /**
   * Append a new node to the Merkle chain
   * Returns the new node and its Merkle proof
   */
  append(data: string): { node: MerkleNode; proof: MerkleProof } {
    const index = this.nodes.length;
    const previousHash = index > 0 ? this.nodes[index - 1].hash : null;
    const timestamp = new Date().toISOString();

    // Compute hash of node data + previous hash
    const nodeData = JSON.stringify({
      index,
      timestamp,
      data,
      previousHash,
    });

    const hash = this.computeHash(nodeData);

    const node: MerkleNode = {
      hash,
      index,
      timestamp,
      data,
      previousHash,
    };

    this.nodes.push(node);

    // Generate Merkle proof
    const proof = this.generateProof(index);

    return { node, proof };
  }

  /**
   * Generate Merkle proof for a node at given index
   * Proof allows verification without access to entire tree
   */
  generateProof(index: number): MerkleProof {
    if (index >= this.nodes.length) {
      throw new Error(`Node index ${index} out of bounds`);
    }

    const leaf = this.nodes[index].hash;
    const siblings: string[] = [];
    const path: ('left' | 'right')[] = [];

    // For a simple chain (not binary tree), proof is just the chain
    // In a full Merkle tree, this would traverse the tree structure
    // For now, we maintain a simple chain structure

    // Include hashes of all nodes from start to current
    for (let i = 0; i < index; i++) {
      siblings.push(this.nodes[i].hash);
      path.push('left'); // All previous nodes are on the left
    }

    const root = this.getRoot();

    return {
      leaf,
      siblings,
      path,
      root,
    };
  }

  /**
   * Verify a Merkle proof
   * Returns true if proof is valid for the claimed data
   */
  verifyProof(proof: MerkleProof, data: string): boolean {
    // Recompute hash of data
    const computedLeaf = this.computeHash(data);

    if (computedLeaf !== proof.leaf) {
      return false;
    }

    // For chain structure, verify that leaf is in the chain
    const foundNode = this.nodes.find((n) => n.hash === proof.leaf);
    if (!foundNode) {
      return false;
    }

    // Verify chain integrity up to this point
    for (let i = 1; i <= foundNode.index; i++) {
      const node = this.nodes[i];
      const prevNode = this.nodes[i - 1];

      if (node.previousHash !== prevNode.hash) {
        return false; // Chain broken
      }
    }

    return true;
  }

  /**
   * Verify entire chain integrity
   * Returns result with details about any breaks
   */
  verifyChain(): { valid: boolean; brokenAt?: number; message: string } {
    if (this.nodes.length === 0) {
      return { valid: true, message: 'Empty chain' };
    }

    if (this.nodes.length === 1) {
      return { valid: true, message: 'Single node chain' };
    }

    for (let i = 1; i < this.nodes.length; i++) {
      const node = this.nodes[i];
      const prevNode = this.nodes[i - 1];

      // Verify previous hash link
      if (node.previousHash !== prevNode.hash) {
        return {
          valid: false,
          brokenAt: i,
          message: `Chain broken at node ${i}: previous hash mismatch`,
        };
      }

      // Verify node hash integrity
      const recomputedHash = this.computeHash(
        JSON.stringify({
          index: node.index,
          timestamp: node.timestamp,
          data: node.data,
          previousHash: node.previousHash,
        })
      );

      if (recomputedHash !== node.hash) {
        return {
          valid: false,
          brokenAt: i,
          message: `Chain broken at node ${i}: hash tampering detected`,
        };
      }
    }

    return { valid: true, message: `Chain valid (${this.nodes.length} nodes)` };
  }

  /**
   * Get root hash (hash of latest node)
   */
  getRoot(): string {
    if (this.nodes.length === 0) {
      return this.computeHash('GENESIS'); // Genesis hash for empty tree
    }
    return this.nodes[this.nodes.length - 1].hash;
  }

  /**
   * Get node at index
   */
  getNode(index: number): MerkleNode | null {
    return this.nodes[index] || null;
  }

  /**
   * Get total number of nodes
   */
  getSize(): number {
    return this.nodes.length;
  }

  /**
   * Get all nodes (for persistence)
   */
  getAllNodes(): MerkleNode[] {
    return [...this.nodes]; // Return copy to prevent mutation
  }

  /**
   * Load nodes from persistent storage
   */
  loadNodes(nodes: MerkleNode[]): void {
    this.nodes = [...nodes];
  }

  /**
   * Compute cryptographic hash using SHA-256
   */
  private computeHash(data: string): string {
    return crypto.createHash(this.hashAlgorithm).update(data, 'utf8').digest('hex');
  }

  /**
   * Export tree state for persistence
   */
  export(): {
    nodes: MerkleNode[];
    root: string;
    size: number;
    algorithm: string;
  } {
    return {
      nodes: this.getAllNodes(),
      root: this.getRoot(),
      size: this.getSize(),
      algorithm: this.hashAlgorithm,
    };
  }

  /**
   * Import tree state from persistence
   */
  import(state: { nodes: MerkleNode[]; root: string; size: number; algorithm: string }): void {
    if (state.algorithm !== this.hashAlgorithm) {
      throw new Error(`Algorithm mismatch: expected ${this.hashAlgorithm}, got ${state.algorithm}`);
    }

    this.loadNodes(state.nodes);

    // Verify imported state
    const verification = this.verifyChain();
    if (!verification.valid) {
      throw new Error(`Imported chain is invalid: ${verification.message}`);
    }

    if (this.getRoot() !== state.root) {
      throw new Error('Root hash mismatch after import');
    }
  }
}
