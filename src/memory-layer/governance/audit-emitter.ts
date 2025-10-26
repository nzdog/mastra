/**
 * Audit Emitter - Phase 1 Implementation
 *
 * Provides tamper-evident audit logging with Merkle chain and cryptographic signatures
 * Part of Memory Layer Specification - Phase 1
 */

import { auditEventsTotal } from '../../observability/metrics';
import {
  getLedgerSink,
  SignedAuditReceipt,
  AuditEvent as LedgerEvent,
} from '../storage/ledger-sink';

export type AuditEventType =
  | 'STORE'
  | 'RECALL'
  | 'DISTILL'
  | 'FORGET'
  | 'EXPORT'
  | 'HEALTH'
  | 'CONSENT_GRANT'
  | 'CONSENT_REVOKE'
  | 'AMBIGUITY_EVENT'
  | 'GOVERNANCE_OVERRIDE'
  | 'ETHICAL_DEVIATION';

export interface AuditEvent {
  event_id: string;
  event_type: AuditEventType;
  timestamp: string;
  operation: string;
  user_id?: string; // Pseudonymized
  session_id?: string;
  consent_context?: {
    consent_level: 'personal' | 'cohort' | 'population';
    scope: string[];
    expiry?: string;
    revocable: boolean;
  };
  payload: Record<string, unknown>;
}

export interface AuditReceipt {
  receipt_id: string;
  event_id: string;
  timestamp: string;
  signature: string;
  merkle_root: string;
  merkle_proof: unknown;
  ledger_height: number;
}

/**
 * Audit Emitter Class - Phase 1 Implementation
 *
 * Phase 1: Merkle-chained ledger with cryptographic signatures
 * Phase 1+: Persistent sink with database/S3 backend
 */
export class AuditEmitter {
  private initialized: boolean = false;

  /**
   * Initialize audit emitter (lazy initialization)
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Initialize ledger sink (will load or create)
    const ledger = await getLedgerSink();
    console.log(
      `📝 AUDIT: Audit emitter initialized (Phase 1 - ledger height: ${ledger.getLedgerHeight()})`
    );

    this.initialized = true;
  }

  /**
   * Emit an audit event
   * Returns a signed receipt with Merkle proof
   */
  async emit(
    eventType: AuditEventType,
    operation: string,
    payload: Record<string, unknown>,
    consentContext?: {
      consent_level?: 'personal' | 'cohort' | 'population';
      scope?: string[];
      expiry?: string;
      revocable?: boolean;
    },
    userId?: string,
    sessionId?: string
  ): Promise<AuditReceipt> {
    // Check if ledger is enabled
    const ledgerEnabled = process.env.LEDGER_ENABLED !== 'false';

    if (!ledgerEnabled) {
      // Ledger disabled - return stub receipt without persisting
      const stubEventId = this.generateEventId();
      const stubReceiptId = `rcpt_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

      // Phase 1.2: Still emit audit events counter even when ledger is disabled
      auditEventsTotal.labels(eventType, operation).inc();

      console.log(
        `📝 AUDIT: ${eventType} event logged (stub mode - ledger disabled) (event_id: ${stubEventId})`
      );

      // Return stub receipt
      return {
        receipt_id: stubReceiptId,
        event_id: stubEventId,
        timestamp: new Date().toISOString(),
        signature: 'stub_signature_ledger_disabled',
        merkle_root: 'stub_root',
        merkle_proof: null,
        ledger_height: 0,
      };
    }

    // Ensure initialized
    await this.initialize();

    const ledger = await getLedgerSink();

    // Create ledger event
    const event: LedgerEvent = {
      event_id: this.generateEventId(),
      timestamp: new Date().toISOString(),
      event_type: eventType,
      operation,
      user_id: userId,
      session_id: sessionId,
      consent_context: consentContext
        ? {
            consent_level: consentContext.consent_level || 'personal',
            scope: consentContext.scope || [],
            expiry: consentContext.expiry,
            revocable: consentContext.revocable ?? true,
          }
        : undefined,
      payload,
      // Phase 1.1 fields (updated for Phase 2)
      schemaVersion: '1.0.0',
      policyVersion: '2025-10-phase2',
      consentScope: consentContext?.scope || ['audit'],
    };

    // Append to ledger - gets Merkle proof + signature
    const signedReceipt: SignedAuditReceipt = await ledger.append(event);

    // Phase 1.2: Emit audit events counter
    auditEventsTotal.labels(eventType, operation).inc();

    console.log(
      `📝 AUDIT: ${eventType} event emitted (event_id: ${event.event_id}, receipt_id: ${signedReceipt.receipt_id})`
    );

    // Convert to AuditReceipt interface
    const receipt: AuditReceipt = {
      receipt_id: signedReceipt.receipt_id,
      event_id: signedReceipt.event.event_id,
      timestamp: signedReceipt.event.timestamp,
      signature: signedReceipt.signature.signature,
      merkle_root: signedReceipt.merkle.root_hash,
      merkle_proof: signedReceipt.merkle.proof,
      ledger_height: signedReceipt.ledger_height,
    };

    return receipt;
  }

  /**
   * Emit ambiguity event when consent is contested
   */
  async emitAmbiguityEvent(
    operation: string,
    consentDiffs: Record<string, unknown>,
    userId?: string,
    sessionId?: string
  ): Promise<AuditReceipt> {
    return this.emit(
      'AMBIGUITY_EVENT',
      operation,
      { reason: 'contested_consent', details: consentDiffs },
      {
        consent_level: 'personal',
        scope: ['ambiguity_tracking'],
        revocable: true,
      },
      userId,
      sessionId
    );
  }

  /**
   * Emit governance override event
   */
  async emitGovernanceOverride(
    overrideType: 'policy_engine' | 'ethics_committee' | 'constitutional',
    rationale: string,
    policyDiffs: Record<string, unknown>,
    userId?: string,
    sessionId?: string
  ): Promise<AuditReceipt> {
    return this.emit(
      'GOVERNANCE_OVERRIDE',
      `governance_override_${overrideType}`,
      {
        override_type: overrideType,
        rationale,
        policy_diffs: policyDiffs,
      },
      {
        consent_level: 'personal',
        scope: ['governance_override'],
        revocable: false, // Overrides are not revocable
      },
      userId,
      sessionId
    );
  }

  /**
   * Emit ethical deviation report (public)
   */
  async emitEthicalDeviation(
    deviationType: string,
    description: string,
    impactAssessment: string
  ): Promise<AuditReceipt> {
    return this.emit('ETHICAL_DEVIATION', `ethical_deviation_${deviationType}`, {
      deviation_type: deviationType,
      description,
      impact_assessment: impactAssessment,
      public: true, // Marked for public reporting
    });
  }

  /**
   * Get ledger height (total events)
   */
  async getLedgerHeight(): Promise<number> {
    const ledger = await getLedgerSink();
    return ledger.getLedgerHeight();
  }

  /**
   * Get recent receipts (for debugging/monitoring)
   */
  async getRecentReceipts(limit: number = 10): Promise<SignedAuditReceipt[]> {
    const ledger = await getLedgerSink();
    return ledger.listReceipts(limit);
  }

  /**
   * Verify chain integrity using Merkle tree verification
   */
  async verifyChainIntegrity(): Promise<{ valid: boolean; message: string; brokenAt?: number }> {
    await this.initialize();
    const ledger = await getLedgerSink();
    return ledger.verifyChain();
  }

  /**
   * Verify a specific audit receipt
   */
  async verifyReceipt(receipt: SignedAuditReceipt): Promise<{
    valid: boolean;
    merkle_valid: boolean;
    signature_valid: boolean;
    message: string;
  }> {
    await this.initialize();
    const ledger = await getLedgerSink();
    return ledger.verifyReceipt(receipt);
  }

  /**
   * Get key rotation status
   */
  async getKeyRotationStatus(): Promise<{
    keyId: string;
    createdAt: string;
    ageDays: number;
    needsRotation: boolean;
    maxAgeDays: number;
  }> {
    await this.initialize();
    const ledger = await getLedgerSink();
    return ledger.getKeyRotationStatus();
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
}

// Singleton instance
let auditEmitterInstance: AuditEmitter | null = null;

/**
 * Get global audit emitter instance
 */
export function getAuditEmitter(): AuditEmitter {
  if (!auditEmitterInstance) {
    auditEmitterInstance = new AuditEmitter();
    console.log('📝 AUDIT: Audit emitter initialized (stub mode)');
  }
  return auditEmitterInstance;
}
