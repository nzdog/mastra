/**
 * Memory Layer Router
 * Phase 2: Memory Layer - APIs & Consent Families
 *
 * Express router for memory operations with full middleware stack.
 * Handles routes: /v1/{family}/*
 */

import { Router } from 'express';
import { consentResolver } from '../middleware/consent-resolver';
import { compatShim } from '../middleware/compat-shim';
import { schemaValidator } from '../middleware/schema-validator';
import { sloMiddleware } from '../middleware/slo-middleware';
import {
  storeHandler,
  recallHandler,
  distillHandler,
  forgetHandler,
  exportHandler,
} from './operations';

/**
 * Create memory layer router with middleware stack
 *
 * Middleware order:
 * 1. Consent resolver - extracts family, validates auth
 * 2. Compat shim - transforms legacy requests (Phase 3.2)
 * 3. Schema validator - validates request schemas
 * 4. SLO middleware - tracks latency, enforces SLO
 * 5. Operation handlers - execute memory operations
 */
export function createMemoryRouter(): Router {
  const router = Router({ mergeParams: true });

  // Apply middleware stack to all routes
  router.use(consentResolver);
  router.use(compatShim); // Phase 3.2: Backward compatibility
  router.use(schemaValidator);
  router.use(sloMiddleware);

  /**
   * Store Operation
   * POST /v1/{family}/store
   *
   * Stores a new memory record with consent family validation.
   * Request body: StoreRequest
   * Response: StoreResponse (201 Created)
   */
  router.post('/store', storeHandler);

  /**
   * Recall Operation
   * GET /v1/{family}/recall
   *
   * Retrieves memory records with consent family enforcement.
   * Query params: RecallQuery (user_id, session_id, since, until, type, limit, offset, sort)
   * Response: RecallResponse (200 OK)
   */
  router.get('/recall', recallHandler);

  /**
   * Distill Operation
   * POST /v1/{family}/distill
   *
   * Aggregates data with consent family enforcement and k-anonymity.
   * Request body: DistillRequest
   * Response: DistillResponse (200 OK)
   */
  router.post('/distill', distillHandler);

  /**
   * Forget Operation
   * DELETE /v1/{family}/forget
   *
   * Deletes memory records with consent family enforcement.
   * Query params: ForgetRequest (id, user_id, session_id, reason, hard_delete)
   * Response: ForgetResponse (200 OK)
   */
  router.delete('/forget', forgetHandler);

  /**
   * Export Operation
   * GET /v1/{family}/export
   *
   * Exports user data with consent family enforcement.
   * Query params: ExportRequest (user_id, format, filters, include_audit)
   * Response: ExportResponse (200 OK)
   */
  router.get('/export', exportHandler);

  return router;
}

/**
 * Export default router instance
 */
export default createMemoryRouter();
