/**
 * Audit Emitter (stub)
 *
 * This is a minimal, no-op implementation used by CI policy gates and to
 * scaffold later Merkle-chained audit ledger integration.
 */
export interface AuditEvent {
  type: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

export class AuditEmitter {
  constructor(private readonly sink?: string) {}

  async emit(event: AuditEvent): Promise<void> {
    // No-op for now. Later: write to Merkle ledger, sign receipts, etc.
    // Keep lightweight and synchronous for tests.
    console.log('AUDIT STUB:', JSON.stringify(event));
    return Promise.resolve();
  }
}

export default new AuditEmitter();
