/**
 * Audit types for Memory Layer Spec Phase 0
 */
export interface AuditEvent {
  id: string; // UUID
  type: string;
  payload: Record<string, unknown>;
  timestamp: string; // ISO
  source?: string;
}

export interface AuditReceipt {
  event_id: string;
  receipt_id: string; // UUID for receipt
  timestamp: string; // ISO
  hash: string; // placeholder for event hash
  signature?: string; // placeholder for signature
  status: 'stubbed' | 'signed' | 'failed';
}

export interface AuditSink {
  emit(event: AuditEvent): Promise<AuditReceipt>;
}

export const VERSION = '0.1.0-phase0';
