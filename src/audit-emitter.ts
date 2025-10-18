import { randomUUID } from 'crypto';
import { AuditEvent, AuditReceipt, AuditSink } from './audit-types';

/**
 * Audit Emitter (typed stub)
 * Implements AuditSink but performs no external writes. Returns a stubbed receipt.
 */
export class AuditEmitter implements AuditSink {
  constructor(private readonly sink?: string) {}

  async emit(event: AuditEvent): Promise<AuditReceipt> {
    // Compute a simple placeholder hash for the event (not cryptographically secure)
    const payloadString = JSON.stringify(event.payload || {});
    const hash = Buffer.from(payloadString).toString('base64').slice(0, 32);

    const receipt: AuditReceipt = {
      event_id: event.id,
      receipt_id: randomUUID(),
      timestamp: new Date().toISOString(),
      hash,
      signature: undefined,
      status: 'stubbed',
    };

    // Log the audit event and receipt for visibility in Phase 0
    console.log('AUDIT EVENT:', JSON.stringify(event));
    console.log('AUDIT RECEIPT (stub):', JSON.stringify(receipt));

    return Promise.resolve(receipt);
  }
}

export default new AuditEmitter();
