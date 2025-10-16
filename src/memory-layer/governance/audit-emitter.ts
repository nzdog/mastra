/**
 * Audit Emitter Stub
 *
 * Provides tamper-evident audit logging with Merkle chain structure
 * Part of Memory Layer Specification - Phase 0 (Stub) / Phase 1 (Implementation)
 */

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
  consent_context: {
    family: 'personal' | 'cohort' | 'population';
    consent_status: 'active' | 'revoked' | 'contested' | 'ambiguous';
    consent_diffs?: Record<string, any>; // For ambiguity events
  };
  payload: Record<string, any>;
  previous_hash: string | null; // Merkle chain
  current_hash: string;
  signature?: string; // Cryptographic signature (Phase 1)
}

export interface AuditReceipt {
  receipt_id: string;
  event_id: string;
  timestamp: string;
  signature: string;
  merkle_proof: string[];
  ledger_height: number;
}

/**
 * Audit Emitter Class (Stub)
 *
 * Phase 0: In-memory logging with basic structure
 * Phase 1: Merkle chain with cryptographic signatures
 * Phase 1+: Persistent sink (database, S3, etc.)
 */
export class AuditEmitter {
  private events: AuditEvent[] = [];
  private lastHash: string | null = null;

  /**
   * Emit an audit event
   * Returns a signed receipt for the event
   */
  async emit(
    eventType: AuditEventType,
    operation: string,
    payload: Record<string, any>,
    consentContext?: Partial<AuditEvent['consent_context']>,
    userId?: string
  ): Promise<AuditReceipt> {
    const event: AuditEvent = {
      event_id: this.generateEventId(),
      event_type: eventType,
      timestamp: new Date().toISOString(),
      operation,
      user_id: userId,
      consent_context: {
        family: consentContext?.family || 'personal',
        consent_status: consentContext?.consent_status || 'active',
        consent_diffs: consentContext?.consent_diffs,
      },
      payload,
      previous_hash: this.lastHash,
      current_hash: '', // Will be computed
      signature: undefined, // Phase 1: Add cryptographic signature
    };

    // Compute hash (stub - will use proper Merkle tree in Phase 1)
    event.current_hash = this.computeHash(event);
    this.lastHash = event.current_hash;

    // Store event
    this.events.push(event);

    console.log(`📝 AUDIT: ${eventType} event emitted (event_id: ${event.event_id})`);

    // Generate receipt
    const receipt: AuditReceipt = {
      receipt_id: this.generateReceiptId(),
      event_id: event.event_id,
      timestamp: event.timestamp,
      signature: 'STUB_SIGNATURE', // Phase 1: Real cryptographic signature
      merkle_proof: [], // Phase 1: Merkle proof path
      ledger_height: this.events.length,
    };

    return receipt;
  }

  /**
   * Emit ambiguity event when consent is contested
   */
  async emitAmbiguityEvent(
    operation: string,
    consentDiffs: Record<string, any>,
    userId?: string
  ): Promise<AuditReceipt> {
    return this.emit(
      'AMBIGUITY_EVENT',
      operation,
      { reason: 'contested_consent', details: consentDiffs },
      {
        family: 'personal',
        consent_status: 'ambiguous',
        consent_diffs: consentDiffs,
      },
      userId
    );
  }

  /**
   * Emit governance override event
   */
  async emitGovernanceOverride(
    overrideType: 'policy_engine' | 'ethics_committee' | 'constitutional',
    rationale: string,
    policyDiffs: Record<string, any>,
    userId?: string
  ): Promise<AuditReceipt> {
    return this.emit(
      'GOVERNANCE_OVERRIDE',
      `governance_override_${overrideType}`,
      {
        override_type: overrideType,
        rationale,
        policy_diffs: policyDiffs,
      },
      { family: 'personal', consent_status: 'active' },
      userId
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
  getLedgerHeight(): number {
    return this.events.length;
  }

  /**
   * Get recent events (for debugging/monitoring)
   */
  getRecentEvents(limit: number = 10): AuditEvent[] {
    return this.events.slice(-limit);
  }

  /**
   * Verify chain integrity (stub - Phase 1 will do proper Merkle verification)
   */
  verifyChainIntegrity(): { valid: boolean; message: string } {
    if (this.events.length === 0) {
      return { valid: true, message: 'No events in chain' };
    }

    // Stub verification - just checks hash chain continuity
    for (let i = 1; i < this.events.length; i++) {
      if (this.events[i].previous_hash !== this.events[i - 1].current_hash) {
        return {
          valid: false,
          message: `Chain broken at event ${i}: ${this.events[i].event_id}`,
        };
      }
    }

    return { valid: true, message: 'Chain integrity verified (stub)' };
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Generate unique receipt ID
   */
  private generateReceiptId(): string {
    return `rcpt_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Compute hash for event (stub - Phase 1 will use proper cryptographic hash)
   */
  private computeHash(event: AuditEvent): string {
    // Stub: Simple string concatenation hash
    // Phase 1: Use SHA-256 or similar
    const payload = JSON.stringify({
      event_id: event.event_id,
      event_type: event.event_type,
      timestamp: event.timestamp,
      operation: event.operation,
      previous_hash: event.previous_hash,
    });

    return `hash_${Buffer.from(payload).toString('base64').substring(0, 32)}`;
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
