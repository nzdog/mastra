/**
 * Error Envelope and Standard Error Codes
 * Phase 2: Memory Layer - APIs & Consent Families
 */

/**
 * Standard error codes for Memory Layer operations
 */
export enum ErrorCode {
  /** Request validation failed (400) */
  VALIDATION_ERROR = 'VALIDATION_ERROR',

  /** Authentication required or failed (401) */
  UNAUTHORIZED = 'UNAUTHORIZED',

  /** Authenticated but lacks permission (403) */
  FORBIDDEN = 'FORBIDDEN',

  /** Requested resource not found (404) */
  NOT_FOUND = 'NOT_FOUND',

  /** Resource conflict (e.g., duplicate ID) (409) */
  CONFLICT = 'CONFLICT',

  /** Service Level Objective violation (503) */
  SLO_VIOLATION = 'SLO_VIOLATION',

  /** Unexpected server error (500) */
  INTERNAL_ERROR = 'INTERNAL_ERROR',

  /** Service temporarily unavailable (503) */
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

/**
 * HTTP status code mapping for error codes
 */
export const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.SLO_VIOLATION]: 503,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
};

/**
 * Error detail structure within the error envelope
 */
export interface ErrorDetail {
  /** Machine-readable error code */
  code: ErrorCode;

  /** Human-readable error message */
  message: string;

  /** Optional additional details (e.g., validation errors) */
  details?: Record<string, unknown>;

  /** Trace ID for correlating logs and audit events */
  trace_id?: string;
}

/**
 * Standard error response envelope
 * All API errors return this structure for consistency
 */
export interface ErrorResponse {
  /** Error details */
  error: ErrorDetail;

  /** ISO timestamp when error occurred */
  timestamp: string;

  /** Request path that caused the error */
  path: string;

  /** HTTP method of the failed request */
  method: string;
}

/**
 * Helper function to create standardized error responses
 * @param code - The error code from ErrorCode enum
 * @param message - Human-readable error message
 * @param details - Optional additional error details
 * @param req - Express request object for path and method
 * @param traceId - Optional trace ID for correlation
 * @returns Formatted ErrorResponse object
 */
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  details: Record<string, unknown> | undefined,
  req: { path: string; method: string },
  traceId?: string
): ErrorResponse {
  return {
    error: {
      code,
      message,
      details,
      trace_id: traceId,
    },
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
  };
}

/**
 * Helper to get HTTP status code for an error code
 */
export function getStatusCode(code: ErrorCode): number {
  return ERROR_HTTP_STATUS[code] || 500;
}

/**
 * Type guard to check if an error is an ErrorResponse
 */
export function isErrorResponse(obj: unknown): obj is ErrorResponse {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'error' in obj &&
    'timestamp' in obj &&
    'path' in obj &&
    'method' in obj
  );
}
