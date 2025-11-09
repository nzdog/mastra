/**
 * Consent Family Resolver Middleware
 * Phase 2: Memory Layer - APIs & Consent Families
 *
 * Extracts consent family from URL path and validates authorization.
 * Fail-closed security: 401 if no auth, 403 if family not allowed.
 */

import { Request, Response, NextFunction } from 'express';
import { getAuditEmitter } from '../governance/audit-emitter';
import { createErrorResponse, ErrorCode, getStatusCode } from '../models/error-envelope';
import { ConsentFamily } from '../models/memory-record';

/**
 * Consent context attached to request
 */
export interface ConsentContext {
  family: ConsentFamily;
  /**
   * Hashed pseudonymous identifier extracted from auth token
   * Token MUST contain hashed value, never raw PII
   */
  hashed_pseudonym: string;
  scope: string[];
  trace_id: string;
}

/**
 * Extend Express Request with consent context
 */
declare global {
  namespace Express {
    interface Request {
      consentContext?: ConsentContext;
    }
  }
}

/**
 * Valid consent families
 */
const VALID_FAMILIES: ConsentFamily[] = ['personal', 'cohort', 'population'];

/**
 * Extract consent family from URL path: /v1/{family}/{operation}
 */
function extractConsentFamily(path: string): ConsentFamily | null {
  const match = path.match(/^\/v1\/([^/]+)\//);
  if (!match) {
    return null;
  }

  const family = match[1];
  if (VALID_FAMILIES.includes(family as ConsentFamily)) {
    return family as ConsentFamily;
  }

  return null;
}

/**
 * Mock user token validation
 * In production, this would validate JWT tokens and check user permissions
 * Token should contain hashed pseudonym, not raw email/PII
 */
function validateUserToken(authHeader: string | undefined): {
  valid: boolean;
  hashed_pseudonym?: string;
  error?: string;
} {
  if (!authHeader) {
    return { valid: false, error: 'Missing Authorization header' };
  }

  // Check Bearer token format
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return { valid: false, error: 'Invalid Authorization header format. Expected: Bearer <token>' };
  }

  const token = match[1];

  // Mock validation - in production, verify JWT signature
  if (token === 'invalid' || token.length < 10) {
    return { valid: false, error: 'Invalid or expired token' };
  }

  // Extract hashed_pseudonym from token (mock - in production, decode JWT payload)
  // Token should contain hashed value like 'hs_...' or SHA-256 hex
  // For dev/test, accept tokens like "hs_<base64>" or generate hashed format
  let hashedPseudonym: string;
  if (token.startsWith('hs_')) {
    hashedPseudonym = token;
  } else {
    // Generate a mock hashed pseudonym (hs_ prefix + base64-like string)
    hashedPseudonym = `hs_${Buffer.from(token.substring(0, 32)).toString('base64url')}`;
  }

  return { valid: true, hashed_pseudonym: hashedPseudonym };
}

/**
 * Check if user is authorized for consent family
 * In production, this would check user consent preferences and permissions
 */
function checkFamilyAuthorization(
  hashedPseudonym: string,
  family: ConsentFamily
): { authorized: boolean; scope: string[]; error?: string } {
  // Mock authorization - in production, check user consent preferences
  // For now, all users are authorized for all families (dev mode)

  // Define default scopes per family
  const scopes: Record<ConsentFamily, string[]> = {
    personal: ['read', 'write', 'delete', 'export'],
    cohort: ['read', 'aggregate'],
    population: ['aggregate'],
  };

  return {
    authorized: true,
    scope: scopes[family],
  };
}

/**
 * Consent Family Resolver Middleware
 *
 * Extracts consent family from URL, validates auth, and attaches consent context
 */
export function consentResolver(req: Request, res: Response, next: NextFunction): void {
  // Use existing trace ID (should be set by trace ID middleware)
  // Only generate as fallback if somehow missing
  const traceId = (req.get('X-Trace-ID') ||
    `trace_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`) as string;

  // Only set if not already set by earlier middleware
  if (!req.get('X-Trace-ID')) {
    req.headers['x-trace-id'] = traceId;
  }

  // Extract consent family from path
  // Use originalUrl for full path or params.family if mounted with :family parameter
  const family = (req.params.family as ConsentFamily) || extractConsentFamily(req.originalUrl);

  // Skip consent resolution for non-family routes (health, metrics, etc.)
  if (!family) {
    const url = req.originalUrl || req.path;
    // Allow these routes to pass through without consent context
    if (
      url === '/v1/health' ||
      url === '/metrics' ||
      url.startsWith('/v1/ledger') ||
      url.startsWith('/v1/keys') ||
      url.startsWith('/v1/receipts')
    ) {
      return next();
    }

    // Unknown family in /v1/* path - reject
    if (url.startsWith('/v1/')) {
      const errorResponse = createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        `Invalid consent family in path. Must be one of: ${VALID_FAMILIES.join(', ')}`,
        { path: url, valid_families: VALID_FAMILIES },
        req,
        traceId
      );
      res.status(getStatusCode(ErrorCode.VALIDATION_ERROR)).json(errorResponse);
      return;
    }

    // Not a memory layer route - pass through
    return next();
  }

  // Validate authorization header
  const authHeader = req.get('Authorization');
  const tokenValidation = validateUserToken(authHeader);

  if (!tokenValidation.valid) {
    // Fail closed: 401 Unauthorized
    const errorResponse = createErrorResponse(
      ErrorCode.UNAUTHORIZED,
      tokenValidation.error || 'Authentication required',
      { trace_id: traceId },
      req,
      traceId
    );

    // Emit audit event for failed auth (async, don't block response)
    getAuditEmitter()
      .emit('CONSENT_GRANT', 'consent_resolution_failed', {
        reason: 'unauthorized',
        family,
        path: req.originalUrl || req.path,
        trace_id: traceId,
      })
      .catch((err) => console.error('Failed to emit audit event:', err));

    res.status(getStatusCode(ErrorCode.UNAUTHORIZED)).json(errorResponse);
    return;
  }

  const hashedPseudonym = tokenValidation.hashed_pseudonym!;

  // Check family authorization
  const authCheck = checkFamilyAuthorization(hashedPseudonym, family);

  if (!authCheck.authorized) {
    // Fail closed: 403 Forbidden
    const errorResponse = createErrorResponse(
      ErrorCode.FORBIDDEN,
      authCheck.error || `Access denied for consent family: ${family}`,
      { family, hashed_pseudonym: hashedPseudonym, trace_id: traceId },
      req,
      traceId
    );

    // Emit audit event for failed authorization (async)
    getAuditEmitter()
      .emit('CONSENT_GRANT', 'consent_resolution_failed', {
        reason: 'forbidden',
        family,
        hashed_pseudonym: hashedPseudonym,
        path: req.originalUrl || req.path,
        trace_id: traceId,
      })
      .catch((err) => console.error('Failed to emit audit event:', err));

    res.status(getStatusCode(ErrorCode.FORBIDDEN)).json(errorResponse);
    return;
  }

  // Success: Attach consent context to request
  req.consentContext = {
    family,
    hashed_pseudonym: hashedPseudonym,
    scope: authCheck.scope,
    trace_id: traceId,
  };

  // Emit audit event for successful consent resolution (async)
  getAuditEmitter()
    .emit(
      'CONSENT_GRANT',
      'consent_resolution_success',
      {
        family,
        hashed_pseudonym: hashedPseudonym,
        scope: authCheck.scope,
        path: req.originalUrl || req.path,
        method: req.method,
      },
      {
        consent_level: family,
        scope: authCheck.scope,
      },
      hashedPseudonym
    )
    .catch((err) => console.error('Failed to emit audit event:', err));

  next();
}
