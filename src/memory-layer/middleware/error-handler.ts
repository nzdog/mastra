/**
 * Error Envelope Middleware
 * Phase 2: Memory Layer - APIs & Consent Families
 *
 * Global error handler for Express that converts all errors to ErrorResponse format.
 * Includes structured logging and trace ID propagation.
 */

import { Request, Response, NextFunction } from 'express';
import {
  createErrorResponse,
  ErrorCode,
  getStatusCode,
  isErrorResponse,
} from '../models/error-envelope';

/**
 * Custom error class with error code
 */
export class MemoryLayerError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'MemoryLayerError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Map HTTP status codes to error codes
 */
function inferErrorCode(statusCode: number): ErrorCode {
  switch (statusCode) {
    case 400:
      return ErrorCode.VALIDATION_ERROR;
    case 401:
      return ErrorCode.UNAUTHORIZED;
    case 403:
      return ErrorCode.FORBIDDEN;
    case 404:
      return ErrorCode.NOT_FOUND;
    case 409:
      return ErrorCode.CONFLICT;
    case 429:
    case 503:
      return ErrorCode.SERVICE_UNAVAILABLE;
    case 500:
    default:
      return ErrorCode.INTERNAL_ERROR;
  }
}

/**
 * Structured error logging
 */
function logError(error: Error | MemoryLayerError, req: Request, traceId: string): void {
  const logData = {
    timestamp: new Date().toISOString(),
    trace_id: traceId,
    error_name: error.name,
    error_message: error.message,
    error_code: error instanceof MemoryLayerError ? error.code : 'INTERNAL_ERROR',
    path: req.path,
    method: req.method,
    user_agent: req.get('User-Agent'),
    stack: error.stack,
  };

  // Use structured logging (in production, send to logging service)
  console.error('='.repeat(80));
  console.error('ERROR CAUGHT:', error.name);
  console.error('Message:', error.message);
  console.error('Path:', req.method, req.path);
  console.error('Stack trace:');
  console.error(error.stack);
  console.error('='.repeat(80));
  console.error('Full error details:', JSON.stringify(logData, null, 2));
}

/**
 * Error Handler Middleware
 *
 * Catches all errors and converts to ErrorResponse format.
 * Must be registered after all routes.
 */
export function errorHandler(
  err: Error | MemoryLayerError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // If response already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(err);
  }

  // Extract or generate trace ID
  const traceId = (req.get('X-Trace-ID') ||
    `trace_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`) as string;

  // Log error with structured logging
  logError(err, req, traceId);

  // Check if error is already an ErrorResponse
  if (isErrorResponse(err)) {
    const errorResponse = err as { error: { code: ErrorCode } };
    res.status(getStatusCode(errorResponse.error.code)).json(err);
    return;
  }

  // Handle MemoryLayerError
  if (err instanceof MemoryLayerError) {
    const errorResponse = createErrorResponse(err.code, err.message, err.details, req, traceId);

    res.status(getStatusCode(err.code)).json(errorResponse);
    return;
  }

  // Handle standard HTTP errors (from express or middleware)
  if ('status' in err || 'statusCode' in err) {
    const httpError = err as { status?: number; statusCode?: number };
    const statusCode = httpError.status || httpError.statusCode || 500;
    const errorCode = inferErrorCode(statusCode);
    const errorResponse = createErrorResponse(
      errorCode,
      err.message || 'An error occurred',
      { original_error: err.name },
      req,
      traceId
    );

    res.status(statusCode).json(errorResponse);
    return;
  }

  // Handle unexpected errors (500 Internal Server Error)
  const errorResponse = createErrorResponse(
    ErrorCode.INTERNAL_ERROR,
    'An unexpected error occurred',
    {
      error_name: err.name,
      // Don't leak stack traces in production
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
    req,
    traceId
  );

  res.status(500).json(errorResponse);
}

/**
 * 404 Not Found Handler
 *
 * Handles requests to undefined routes.
 * Must be registered after all routes but before error handler.
 */
export function notFoundHandler(req: Request, res: Response): void {
  const traceId = (req.get('X-Trace-ID') ||
    `trace_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`) as string;

  const errorResponse = createErrorResponse(
    ErrorCode.NOT_FOUND,
    `Route not found: ${req.method} ${req.path}`,
    {
      available_routes: [
        'GET /v1/health',
        'POST /v1/{family}/store',
        'GET /v1/{family}/recall',
        'POST /v1/{family}/distill',
        'DELETE /v1/{family}/forget',
        'GET /v1/{family}/export',
      ],
    },
    req,
    traceId
  );

  res.status(404).json(errorResponse);
}

/**
 * Async error wrapper
 *
 * Wraps async route handlers to catch promise rejections
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
