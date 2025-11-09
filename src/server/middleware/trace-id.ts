import { Request, Response, NextFunction } from 'express';

/**
 * Trace ID Middleware
 *
 * Generates or extracts a unique trace ID for each request.
 * This middleware MUST run before any rate limiting or error handling
 * to ensure all responses (including errors) have a trace ID.
 *
 * The trace ID is:
 * 1. Extracted from X-Trace-ID header if present
 * 2. Generated if not present
 * 3. Set in both request headers and response headers
 */
export function traceIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Extract existing trace ID or generate new one
  const traceId =
    req.get('X-Trace-ID') || `trace_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

  // Store in request headers for downstream middleware
  req.headers['x-trace-id'] = traceId;

  // Set in response header so client receives it
  res.setHeader('X-Trace-ID', traceId);

  next();
}
