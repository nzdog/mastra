/**
 * Shared test types for eliminating `any` in test helpers
 * Phase 3.3: Type safety improvements
 */

export type HttpHeaders = Record<string, string>;

export interface ApiResponse<T = unknown> {
  status: number;
  data: T;
  headers: HttpHeaders;
}

export type Json = Record<string, unknown>;

/**
 * Common API response types used in tests
 */
export interface ReadyzResponse {
  ready: boolean;
  message: string;
  ledger_initialized?: boolean;
  ledger_optional?: boolean;
}

export interface MemoryRecord {
  id: string;
  hashed_pseudonym: string;
  content: {
    type: string;
    data: unknown;
    metadata?: Record<string, unknown>;
  };
  consent_family: string;
  created_at: string;
  [key: string]: unknown;
}
