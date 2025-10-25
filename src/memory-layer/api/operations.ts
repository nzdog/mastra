/**
 * Memory Layer API Operations
 * Phase 2: Memory Layer - APIs & Consent Families
 *
 * Implements all 5 memory operations: store, recall, distill, forget, export
 * Each operation includes:
 * - Consent family validation
 * - Audit event emission (before + after)
 * - Signed audit receipt generation
 * - Proper error handling with asyncHandler
 */

import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { aggregate, DEFAULT_K_ANONYMITY } from '../aggregation/simple-aggregator';
import { getAuditEmitter } from '../governance/audit-emitter';
import { ConsentContext } from '../middleware/consent-resolver';
import { asyncHandler, MemoryLayerError } from '../middleware/error-handler';
import { ErrorCode } from '../models/error-envelope';
import { MemoryRecord, ConsentFamily } from '../models/memory-record';
import {
  StoreRequest,
  RecallQuery,
  DistillRequest,
  ForgetRequest,
  ExportRequest,
  validateStoreRequest,
  validateRecallQuery,
  validateForgetRequest,
} from '../models/operation-requests';
import {
  StoreResponse,
  RecallResponse,
  DistillResponse,
  ForgetResponse,
  ExportResponse,
  createBaseResponse,
  createPaginationMetadata,
} from '../models/operation-responses';
import { getMemoryStore } from '../storage/in-memory-store';

/**
 * Extend Express Request to include consent context
 */
interface RequestWithConsent extends Request {
  consentContext: ConsentContext;
}

/**
 * Sanitize response to ensure no raw PII in hashed_pseudonym field
 * Validates format and checks for PII patterns before returning records
 */
function sanitizeResponse(record: MemoryRecord): MemoryRecord {
  // Validate hashed_pseudonym matches expected pattern
  // Accept 43+ characters for variable-length base64url encoding
  const hashedPattern = /^(hs_[A-Za-z0-9_-]{43,}|[a-f0-9]{64})$/;
  if (!hashedPattern.test(record.hashed_pseudonym)) {
    throw new MemoryLayerError(
      ErrorCode.INTERNAL_ERROR,
      'Invalid hashed_pseudonym format detected in response'
    );
  }

  // Check for PII patterns
  if (record.hashed_pseudonym.includes('@')) {
    throw new MemoryLayerError(
      ErrorCode.INTERNAL_ERROR,
      'Raw PII detected in response: hashed_pseudonym contains @ symbol'
    );
  }

  if (/\s/.test(record.hashed_pseudonym)) {
    throw new MemoryLayerError(
      ErrorCode.INTERNAL_ERROR,
      'Raw PII detected in response: hashed_pseudonym contains spaces'
    );
  }

  if (/^\d{3}-\d{2}-\d{4}$/.test(record.hashed_pseudonym)) {
    throw new MemoryLayerError(
      ErrorCode.INTERNAL_ERROR,
      'Raw PII detected in response: hashed_pseudonym matches SSN pattern'
    );
  }

  return record;
}

/**
 * Store Operation Handler
 * POST /v1/{family}/store
 *
 * Stores a new memory record with consent family validation.
 */
export const storeHandler = asyncHandler(async (req: Request, res: Response) => {
  const consentReq = req as RequestWithConsent;
  const { consentContext } = consentReq;
  const body = req.body as StoreRequest;

  // Validate request body
  if (!validateStoreRequest(body) || !body.metadata) {
    throw new MemoryLayerError(
      ErrorCode.VALIDATION_ERROR,
      'Invalid store request. Missing required fields: content, metadata.hashed_pseudonym, metadata.consent_family',
      { body }
    );
  }

  // Validate consent family matches URL
  if (body.metadata.consent_family !== consentContext.family) {
    throw new MemoryLayerError(
      ErrorCode.VALIDATION_ERROR,
      `Consent family mismatch. URL: ${consentContext.family}, body: ${body.metadata.consent_family}`,
      { url_family: consentContext.family, body_family: body.metadata.consent_family }
    );
  }

  // Validate hashed_pseudonym format BEFORE checking mismatch (to catch PII violations)
  const hashedPattern = /^(hs_[A-Za-z0-9_-]{43,}|[a-f0-9]{64})$/;
  if (!hashedPattern.test(body.metadata.hashed_pseudonym)) {
    throw new MemoryLayerError(
      ErrorCode.VALIDATION_ERROR,
      'Invalid hashed_pseudonym format. Expected: hs_<base64url> or SHA-256 hex (64 chars)',
      { hashed_pseudonym: body.metadata.hashed_pseudonym }
    );
  }

  // Check for PII patterns
  if (body.metadata.hashed_pseudonym.includes('@')) {
    throw new MemoryLayerError(
      ErrorCode.VALIDATION_ERROR,
      'Raw PII detected: hashed_pseudonym contains @ symbol (email addresses not allowed)',
      { hashed_pseudonym: body.metadata.hashed_pseudonym }
    );
  }

  if (/^\d{3}-\d{2}-\d{4}$/.test(body.metadata.hashed_pseudonym)) {
    throw new MemoryLayerError(
      ErrorCode.VALIDATION_ERROR,
      'Raw PII detected: hashed_pseudonym matches SSN pattern',
      { hashed_pseudonym: body.metadata.hashed_pseudonym }
    );
  }

  // Validate hashed_pseudonym matches auth
  if (body.metadata.hashed_pseudonym !== consentContext.hashed_pseudonym) {
    throw new MemoryLayerError(
      ErrorCode.FORBIDDEN,
      'Hashed pseudonym mismatch. Cannot store memories for another user',
      { auth_user: consentContext.hashed_pseudonym, request_user: body.metadata.hashed_pseudonym }
    );
  }

  // Emit audit event BEFORE operation
  const auditEmitter = getAuditEmitter();
  await auditEmitter.emit(
    'STORE',
    'memory_store_attempted',
    {
      consent_family: consentContext.family,
      content_type: body.content.type,
      has_expiry: !!body.expires_at,
    },
    {
      consent_level: consentContext.family,
      scope: consentContext.scope,
    },
    consentContext.hashed_pseudonym,
    body.metadata.session_id
  );

  // Generate UUID for memory record
  const recordId = randomUUID();
  const now = new Date().toISOString();

  // Create memory record
  const memoryRecord: MemoryRecord = {
    id: recordId,
    hashed_pseudonym: body.metadata.hashed_pseudonym,
    session_id: body.metadata.session_id,
    content: body.content,
    consent_family: body.metadata.consent_family,
    consent_timestamp: body.metadata.consent_timestamp,
    consent_version: body.metadata.consent_version,
    created_at: now,
    updated_at: now,
    expires_at: body.expires_at,
    access_count: 0,
    audit_receipt_id: '', // Will be set after audit receipt generation
  };

  // Store in memory store
  console.log('[StoreHandler] Attempting to store record:', {
    id: recordId,
    hashed_pseudonym: body.metadata.hashed_pseudonym,
    consent_family: body.metadata.consent_family,
  });
  const store = getMemoryStore();
  let storedRecord;
  try {
    storedRecord = await store.store(memoryRecord);
    console.log('[StoreHandler] Record stored successfully:', storedRecord.id);
  } catch (storeError) {
    console.error('[StoreHandler] STORE OPERATION FAILED:', storeError);
    console.error('[StoreHandler] Error stack:', (storeError as Error).stack);
    throw storeError;
  }

  // Emit audit event AFTER operation with success
  const receipt = await auditEmitter.emit(
    'STORE',
    'memory_store_success',
    {
      record_id: recordId,
      consent_family: consentContext.family,
      content_type: body.content.type,
      expires_at: body.expires_at,
    },
    {
      consent_level: consentContext.family,
      scope: consentContext.scope,
    },
    consentContext.hashed_pseudonym,
    body.metadata.session_id
  );

  // Update record with audit receipt ID
  storedRecord.audit_receipt_id = receipt.receipt_id;
  await store.store(storedRecord);

  // Build response
  const response: StoreResponse = {
    ...createBaseResponse(receipt.receipt_id),
    id: recordId,
    hashed_pseudonym: body.metadata.hashed_pseudonym,
    session_id: body.metadata.session_id,
    consent_family: body.metadata.consent_family,
    created_at: now,
    expires_at: body.expires_at,
  };

  // Set Location header with record URL
  res.setHeader('Location', `/v1/${consentContext.family}/recall?id=${recordId}`);

  res.status(201).json(response);
});

/**
 * Recall Operation Handler
 * GET /v1/{family}/recall
 *
 * Retrieves memory records with consent family enforcement.
 * Personal: full access
 * Cohort/Population: denied (403)
 */
export const recallHandler = asyncHandler(async (req: Request, res: Response) => {
  const consentReq = req as RequestWithConsent;
  const { consentContext } = consentReq;

  // Cohort and population families cannot recall individual records
  if (consentContext.family === 'cohort' || consentContext.family === 'population') {
    throw new MemoryLayerError(
      ErrorCode.FORBIDDEN,
      `Recall operation not allowed for ${consentContext.family} consent family. Use distill for aggregated data.`,
      { family: consentContext.family, allowed_families: ['personal'] }
    );
  }

  // Parse query parameters
  const query: RecallQuery = {
    hashed_pseudonym: consentContext.hashed_pseudonym, // Always use authenticated user
    session_id: req.query.session_id as string | undefined,
    since: req.query.since as string | undefined,
    until: req.query.until as string | undefined,
    type: req.query.type as 'text' | 'structured' | 'embedding' | undefined,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
    offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
    sort: (req.query.sort as 'asc' | 'desc') || 'desc',
  };

  // Validate query
  if (!validateRecallQuery(query)) {
    throw new MemoryLayerError(
      ErrorCode.VALIDATION_ERROR,
      'Invalid recall query. Missing required field: hashed_pseudonym',
      { query }
    );
  }

  // Emit audit event BEFORE operation
  const auditEmitter = getAuditEmitter();
  await auditEmitter.emit(
    'RECALL',
    'memory_recall_attempted',
    {
      query_params: {
        session_id: query.session_id,
        since: query.since,
        until: query.until,
        type: query.type,
        limit: query.limit,
        offset: query.offset,
      },
    },
    {
      consent_level: consentContext.family,
      scope: consentContext.scope,
    },
    consentContext.hashed_pseudonym,
    query.session_id
  );

  // Query memory store
  const store = getMemoryStore();
  let records = await store.recall(query);

  // Sanitize all records before returning
  records = records.map(sanitizeResponse);

  // Count total records matching query (without pagination)
  const totalCount = await store.count({
    hashed_pseudonym: query.hashed_pseudonym,
    session_id: query.session_id,
    since: query.since,
    until: query.until,
    type: query.type,
    consent_family: consentContext.family,
  });

  // Emit audit event AFTER operation with success
  const receipt = await auditEmitter.emit(
    'RECALL',
    'memory_recall_success',
    {
      records_returned: records.length,
      total_records: totalCount,
      query_params: {
        session_id: query.session_id,
        limit: query.limit,
        offset: query.offset,
      },
    },
    {
      consent_level: consentContext.family,
      scope: consentContext.scope,
    },
    consentContext.hashed_pseudonym,
    query.session_id
  );

  // Build response
  const response: RecallResponse = {
    ...createBaseResponse(receipt.receipt_id),
    records,
    pagination: createPaginationMetadata(
      totalCount,
      records.length,
      query.offset || 0,
      query.limit || 100
    ),
    query: {
      hashed_pseudonym: query.hashed_pseudonym,
      session_id: query.session_id,
      since: query.since,
      until: query.until,
    },
  };

  res.status(200).json(response);
});

/**
 * Distill Operation Handler
 * POST /v1/{family}/distill
 *
 * Aggregates data with consent family enforcement.
 * Personal: individual aggregation
 * Cohort: group aggregation (k-anonymity enforced)
 * Population: system-wide aggregation (k-anonymity enforced)
 */
export const distillHandler = asyncHandler(async (req: Request, res: Response) => {
  const consentReq = req as RequestWithConsent;
  const { consentContext } = consentReq;
  const body = req.body as DistillRequest;

  // Validate aggregation request
  if (!body.aggregation || !body.aggregation.type) {
    throw new MemoryLayerError(
      ErrorCode.VALIDATION_ERROR,
      'Invalid distill request. Missing required field: aggregation.type',
      { body }
    );
  }

  // Determine minimum k-anonymity threshold
  const minRecords = body.min_records || DEFAULT_K_ANONYMITY;

  // Emit audit event BEFORE operation
  const auditEmitter = getAuditEmitter();
  await auditEmitter.emit(
    'DISTILL',
    'memory_distill_attempted',
    {
      aggregation_type: body.aggregation.type,
      field: body.aggregation.field,
      consent_family: consentContext.family,
      cohort_id: body.cohort_id,
      min_records: minRecords,
    },
    {
      consent_level: consentContext.family,
      scope: consentContext.scope,
    },
    consentContext.hashed_pseudonym
  );

  // Build query filters based on consent family
  const store = getMemoryStore();
  let records: MemoryRecord[] = [];

  if (consentContext.family === 'personal') {
    // Personal: aggregate only user's own data
    const query: RecallQuery = {
      hashed_pseudonym: consentContext.hashed_pseudonym,
      since: body.filters?.since,
      until: body.filters?.until,
      type: body.filters?.content_type,
      limit: 10000, // High limit for aggregation
      offset: 0,
    };
    records = await store.recall(query);
  } else if (consentContext.family === 'cohort') {
    // Cohort: aggregate cohort-level data
    // For now, we query all cohort records (in production, filter by cohort_id)
    // DEFERRED(Phase 4): Cross-user cohort aggregation requires membership service.
    // Current implementation: Aggregates authenticated user's cohort records only.
    // This is intentionally scoped for privacy-first MVP approach.
    const _totalCount = await store.count({
      consent_family: 'cohort',
      since: body.filters?.since,
      until: body.filters?.until,
      type: body.filters?.content_type,
    });

    // For cohort queries, we need to query all records to aggregate
    const query: RecallQuery = {
      hashed_pseudonym: consentContext.hashed_pseudonym, // Still filter by user for cohort membership
      since: body.filters?.since,
      until: body.filters?.until,
      type: body.filters?.content_type,
      limit: 10000,
      offset: 0,
    };
    records = await store.recall(query);
  } else {
    // Population: aggregate system-wide data
    // Query all population-level records
    const _totalCount = await store.count({
      consent_family: 'population',
      since: body.filters?.since,
      until: body.filters?.until,
      type: body.filters?.content_type,
    });

    // For population, we still need user context for auth
    // In production, this would query across all users
    const query: RecallQuery = {
      hashed_pseudonym: consentContext.hashed_pseudonym,
      since: body.filters?.since,
      until: body.filters?.until,
      type: body.filters?.content_type,
      limit: 10000,
      offset: 0,
    };
    records = await store.recall(query);
  }

  // Perform aggregation
  const aggregationResult = aggregate(
    records,
    body.aggregation.type,
    body.aggregation.field,
    minRecords
  );

  // Check if privacy threshold met
  if (!aggregationResult.meets_k_anonymity) {
    throw new MemoryLayerError(
      ErrorCode.FORBIDDEN,
      `Insufficient data for aggregation. Privacy threshold not met (minimum ${minRecords} records required, found ${aggregationResult.record_count})`,
      {
        min_records: minRecords,
        actual_records: aggregationResult.record_count,
        consent_family: consentContext.family,
      }
    );
  }

  // Emit audit event AFTER operation with success
  const receipt = await auditEmitter.emit(
    'DISTILL',
    'memory_distill_success',
    {
      aggregation_type: body.aggregation.type,
      record_count: aggregationResult.record_count,
      consent_family: consentContext.family,
      privacy_threshold_met: true,
    },
    {
      consent_level: consentContext.family,
      scope: consentContext.scope,
    },
    consentContext.hashed_pseudonym
  );

  // Build response
  const response: DistillResponse = {
    ...createBaseResponse(receipt.receipt_id),
    cohort_id: body.cohort_id,
    consent_family: consentContext.family as 'cohort' | 'population',
    results: [
      {
        type: body.aggregation.type,
        value: aggregationResult.value,
        record_count: aggregationResult.record_count,
        time_bucket: body.aggregation.time_bucket,
      },
    ],
    metadata: {
      total_records: aggregationResult.record_count,
      filtered_records: aggregationResult.record_count,
      privacy_threshold_met: true,
      min_records: minRecords,
      time_range:
        body.filters?.since && body.filters?.until
          ? {
              start: body.filters.since,
              end: body.filters.until,
            }
          : undefined,
    },
  };

  res.status(200).json(response);
});

/**
 * Forget Operation Handler
 * DELETE /v1/{family}/forget
 *
 * Deletes memory records with consent family enforcement.
 * Personal: hard delete allowed
 * Cohort: soft delete (anonymize) only
 * Population: denied (403)
 */
export const forgetHandler = asyncHandler(async (req: Request, res: Response) => {
  const consentReq = req as RequestWithConsent;
  const { consentContext } = consentReq;

  // Population family cannot delete records
  if (consentContext.family === 'population') {
    throw new MemoryLayerError(
      ErrorCode.FORBIDDEN,
      'Forget operation not allowed for population consent family',
      { family: consentContext.family, allowed_families: ['personal', 'cohort'] }
    );
  }

  // Parse query parameters (DELETE can have body or query params)
  const forgetRequest: ForgetRequest = {
    id: req.query.id as string | undefined,
    hashed_pseudonym:
      (req.query.hashed_pseudonym as string | undefined) || consentContext.hashed_pseudonym,
    session_id: req.query.session_id as string | undefined,
    reason: req.query.reason as string | undefined,
    hard_delete: consentContext.family === 'personal', // Only personal can hard delete
  };

  // Validate request
  if (!validateForgetRequest(forgetRequest)) {
    throw new MemoryLayerError(
      ErrorCode.VALIDATION_ERROR,
      'Invalid forget request. Must provide at least one of: id, hashed_pseudonym, session_id',
      { request: forgetRequest }
    );
  }

  // Validate user can only delete own records
  if (
    forgetRequest.hashed_pseudonym &&
    forgetRequest.hashed_pseudonym !== consentContext.hashed_pseudonym
  ) {
    throw new MemoryLayerError(ErrorCode.FORBIDDEN, 'Cannot delete records for another user', {
      auth_user: consentContext.hashed_pseudonym,
      request_user: forgetRequest.hashed_pseudonym,
    });
  }

  // Emit audit event BEFORE operation
  const auditEmitter = getAuditEmitter();
  await auditEmitter.emit(
    'FORGET',
    'memory_forget_attempted',
    {
      delete_params: {
        id: forgetRequest.id,
        hashed_pseudonym: forgetRequest.hashed_pseudonym,
        session_id: forgetRequest.session_id,
      },
      hard_delete: forgetRequest.hard_delete,
      reason: forgetRequest.reason,
    },
    {
      consent_level: consentContext.family,
      scope: consentContext.scope,
    },
    consentContext.hashed_pseudonym,
    forgetRequest.session_id
  );

  // Delete from memory store
  const store = getMemoryStore();
  const deletedIds = await store.forget(forgetRequest);

  // Emit audit event AFTER operation with success
  const receipt = await auditEmitter.emit(
    'FORGET',
    'memory_forget_success',
    {
      deleted_count: deletedIds.length,
      deleted_ids: deletedIds,
      hard_delete: forgetRequest.hard_delete,
      reason: forgetRequest.reason,
    },
    {
      consent_level: consentContext.family,
      scope: consentContext.scope,
    },
    consentContext.hashed_pseudonym,
    forgetRequest.session_id
  );

  // Build response
  const response: ForgetResponse = {
    ...createBaseResponse(receipt.receipt_id),
    deleted_count: deletedIds.length,
    deleted_ids: deletedIds,
    hard_delete: forgetRequest.hard_delete || false,
    metadata: {
      hashed_pseudonym: forgetRequest.hashed_pseudonym,
      session_id: forgetRequest.session_id,
      reason: forgetRequest.reason,
    },
  };

  res.status(200).json(response);
});

/**
 * Export Operation Handler
 * GET /v1/{family}/export
 *
 * Exports user data with consent family enforcement.
 * Personal: full export
 * Cohort: anonymized export
 * Population: denied (403)
 */
export const exportHandler = asyncHandler(async (req: Request, res: Response) => {
  const consentReq = req as RequestWithConsent;
  const { consentContext } = consentReq;

  // Population family cannot export records
  if (consentContext.family === 'population') {
    throw new MemoryLayerError(
      ErrorCode.FORBIDDEN,
      'Export operation not allowed for population consent family',
      { family: consentContext.family, allowed_families: ['personal', 'cohort'] }
    );
  }

  // Parse query parameters
  const exportRequest: ExportRequest = {
    hashed_pseudonym: consentContext.hashed_pseudonym, // Always use authenticated user
    format: (req.query.format as 'json' | 'csv' | 'jsonlines') || 'json',
    filters: {
      consent_families: req.query.consent_families
        ? ((req.query.consent_families as string).split(',') as ConsentFamily[])
        : undefined,
      since: req.query.since as string | undefined,
      until: req.query.until as string | undefined,
      include_deleted: req.query.include_deleted === 'true',
    },
    include_audit: req.query.include_audit === 'true',
  };

  // Emit audit event BEFORE operation
  const auditEmitter = getAuditEmitter();
  await auditEmitter.emit(
    'EXPORT',
    'memory_export_attempted',
    {
      format: exportRequest.format,
      consent_families: exportRequest.filters?.consent_families,
      include_audit: exportRequest.include_audit,
    },
    {
      consent_level: consentContext.family,
      scope: consentContext.scope,
    },
    consentContext.hashed_pseudonym
  );

  // Query all records for user
  const store = getMemoryStore();
  const query: RecallQuery = {
    hashed_pseudonym: consentContext.hashed_pseudonym,
    since: exportRequest.filters?.since,
    until: exportRequest.filters?.until,
    limit: 10000, // High limit for export
    offset: 0,
  };

  let records = await store.recall(query);

  // Sanitize all records before exporting
  records = records.map(sanitizeResponse);

  // Filter by consent families if specified
  if (exportRequest.filters?.consent_families) {
    records = records.filter((r) =>
      exportRequest.filters!.consent_families!.includes(r.consent_family)
    );
  }

  // For cohort family, anonymize exported data
  if (consentContext.family === 'cohort') {
    records = records.map((r) => ({
      ...r,
      hashed_pseudonym: 'anonymized',
      session_id: undefined,
    }));
  }

  // Determine time range
  const sortedRecords = records.sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const timeRange =
    sortedRecords.length > 0
      ? {
          start: sortedRecords[0].created_at,
          end: sortedRecords[sortedRecords.length - 1].created_at,
        }
      : { start: new Date().toISOString(), end: new Date().toISOString() };

  // Format export data based on format
  let exportData: unknown;

  switch (exportRequest.format) {
    case 'json':
      exportData = records;
      break;
    case 'jsonlines':
      exportData = records.map((r) => JSON.stringify(r)).join('\n');
      break;
    case 'csv':
      // Simple CSV export (flatten records)
      const csvHeaders =
        'id,hashed_pseudonym,consent_family,created_at,content_type,access_count\n';
      const csvRows = records
        .map(
          (r) =>
            `${r.id},${r.hashed_pseudonym},${r.consent_family},${r.created_at},${r.content.type},${r.access_count}`
        )
        .join('\n');
      exportData = csvHeaders + csvRows;
      break;
    default:
      exportData = records;
  }

  // Calculate export size
  const exportString = typeof exportData === 'string' ? exportData : JSON.stringify(exportData);
  const sizeBytes = Buffer.byteLength(exportString, 'utf8');

  // Emit audit event AFTER operation with success
  const receipt = await auditEmitter.emit(
    'EXPORT',
    'memory_export_success',
    {
      format: exportRequest.format,
      record_count: records.length,
      size_bytes: sizeBytes,
      consent_family: consentContext.family,
    },
    {
      consent_level: consentContext.family,
      scope: consentContext.scope,
    },
    consentContext.hashed_pseudonym
  );

  // Build response
  const response: ExportResponse = {
    ...createBaseResponse(receipt.receipt_id),
    data: exportData,
    metadata: {
      hashed_pseudonym:
        consentContext.family === 'personal' ? consentContext.hashed_pseudonym : 'anonymized',
      format: exportRequest.format,
      record_count: records.length,
      size_bytes: sizeBytes,
      time_range: timeRange,
      consent_families: [...new Set(records.map((r) => r.consent_family))],
      includes_deleted: exportRequest.filters?.include_deleted || false,
      includes_audit: exportRequest.include_audit || false,
    },
  };

  // Set Content-Disposition header for download
  const filename = `memory_export_${consentContext.hashed_pseudonym}_${Date.now()}.${exportRequest.format === 'jsonlines' ? 'jsonl' : exportRequest.format}`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  // Note: Always send JSON response (export data is in response.data field)
  // Express will automatically set Content-Type: application/json

  res.status(200).json(response);
});
