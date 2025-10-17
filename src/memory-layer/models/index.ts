/**
 * Memory Layer Models - Phase 2
 * Central export for all data models and types
 */

// Core memory record types
export type {
  MemoryRecord,
  MemoryContent,
  ConsentFamily,
  ContentType,
} from './memory-record';

export {
  allowsPII,
  requiresAggregation,
  createMemoryRecord,
} from './memory-record';

// Error handling types
export {
  ErrorCode,
  ERROR_HTTP_STATUS,
  type ErrorDetail,
  type ErrorResponse,
  createErrorResponse,
  getStatusCode,
  isErrorResponse,
} from './error-envelope';

// Request types
export type {
  StoreRequest,
  RecallQuery,
  DistillRequest,
  ForgetRequest,
  ExportRequest,
  AggregationType,
} from './operation-requests';

export {
  validateStoreRequest,
  validateRecallQuery,
  validateForgetRequest,
} from './operation-requests';

// Response types
export type {
  BaseResponse,
  StoreResponse,
  RecallResponse,
  DistillResponse,
  ForgetResponse,
  ExportResponse,
  AggregationResult,
  ExportMetadata,
} from './operation-responses';

export {
  createBaseResponse,
  createPaginationMetadata,
  isStoreResponse,
  isRecallResponse,
} from './operation-responses';
