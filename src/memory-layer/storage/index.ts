/**
 * Memory Layer Storage - Index
 * Phase 2: Memory Layer - APIs & Consent Families
 * Phase 3.2: Added barrel exports for all storage constructs
 *
 * Exports storage interfaces and implementations
 */

// Core interfaces
export { MemoryStore, QueryFilters, isMemoryRecord } from './memory-store-interface';

// Store implementations
export { InMemoryStore, getMemoryStore } from './in-memory-store';
export { PostgresStore } from './postgres-store';
export { DualStore } from './dual-store';

// Ledger
export { LedgerSink, getLedgerSink, SignedAuditReceipt, AuditEvent } from './ledger-sink';

// Adapter selector
export { getStorageAdapter, PersistenceMode } from './adapter-selector';
