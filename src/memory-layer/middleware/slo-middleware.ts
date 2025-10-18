/**
 * SLO (Service Level Objective) Middleware
 * Phase 2: Memory Layer - APIs & Consent Families
 *
 * Tracks request latency, enforces SLO targets, and implements circuit breaker.
 */

import { Request, Response, NextFunction } from 'express';
import { Histogram, Counter } from 'prom-client';
import { createErrorResponse, ErrorCode, getStatusCode } from '../models/error-envelope';

/**
 * SLO targets (p99 latency in milliseconds)
 */
const SLO_TARGETS: Record<string, { p99: number }> = {
  store: { p99: 500 },
  recall: { p99: 1000 },
  distill: { p99: 5000 },
  forget: { p99: 500 },
  export: { p99: 10000 },
  health: { p99: 100 },
};

/**
 * Prometheus metrics
 */
const operationLatency = new Histogram({
  name: 'memory_operation_latency_ms',
  help: 'Memory operation latency in milliseconds',
  labelNames: ['operation', 'family', 'status'],
  buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000, 10000], // milliseconds
});

const sloViolationTotal = new Counter({
  name: 'slo_violation_total',
  help: 'Total number of SLO violations',
  labelNames: ['operation', 'slo'],
});

/**
 * Circuit breaker state
 */
class CircuitBreaker {
  private violations: Map<string, number[]> = new Map(); // operation -> [timestamps]
  private readonly windowMs = 60000; // 1 minute window
  private readonly maxViolationRate = 0.5; // 50% violation rate triggers circuit break
  private readonly minRequests = 10; // Minimum requests to consider circuit breaking

  /**
   * Record a violation for an operation
   */
  recordViolation(operation: string): void {
    const now = Date.now();
    if (!this.violations.has(operation)) {
      this.violations.set(operation, []);
    }

    const timestamps = this.violations.get(operation)!;
    timestamps.push(now);

    // Clean up old violations outside the window
    const cutoff = now - this.windowMs;
    this.violations.set(
      operation,
      timestamps.filter((ts) => ts > cutoff)
    );
  }

  /**
   * Check if circuit is open (too many violations)
   */
  isOpen(operation: string): boolean {
    const timestamps = this.violations.get(operation) || [];
    const now = Date.now();
    const cutoff = now - this.windowMs;

    // Count violations in the window
    const recentViolations = timestamps.filter((ts) => ts > cutoff);

    // Need minimum requests to trigger circuit breaker
    if (recentViolations.length < this.minRequests) {
      return false;
    }

    // Check violation rate
    const violationRate = recentViolations.length / this.minRequests;
    return violationRate > this.maxViolationRate;
  }

  /**
   * Get violation count for an operation
   */
  getViolationCount(operation: string): number {
    const timestamps = this.violations.get(operation) || [];
    const now = Date.now();
    const cutoff = now - this.windowMs;
    return timestamps.filter((ts) => ts > cutoff).length;
  }
}

const circuitBreaker = new CircuitBreaker();

/**
 * Extract operation name from path: /v1/{family}/{operation}
 */
function extractOperation(path: string): string | null {
  const match = path.match(/^\/v1\/[^/]+\/([^/?\s]+)/);
  if (match) {
    return match[1];
  }

  // Handle special routes
  if (path === '/v1/health') {
    return 'health';
  }

  return null;
}

/**
 * Extend Response to store start time
 */
interface ResponseWithStartTime extends Response {
  locals: {
    startTime?: number;
    operation?: string;
    family?: string;
  };
}

/**
 * SLO Middleware
 *
 * Tracks request latency, enforces SLO targets, and implements circuit breaker
 */
export function sloMiddleware(req: Request, res: Response, next: NextFunction): void {
  const operation = extractOperation(req.path);

  // Skip SLO tracking for non-operation routes
  if (!operation) {
    return next();
  }

  const extRes = res as ResponseWithStartTime;

  // Check circuit breaker before processing
  if (circuitBreaker.isOpen(operation)) {
    const traceId = req.get('X-Trace-ID') || 'unknown';
    const errorResponse = createErrorResponse(
      ErrorCode.SERVICE_UNAVAILABLE,
      `Service temporarily unavailable due to SLO violations. Operation: ${operation}`,
      {
        operation,
        violation_count: circuitBreaker.getViolationCount(operation),
        trace_id: traceId,
      },
      req,
      traceId
    );

    console.warn(`⚠️ SLO: Circuit breaker open for operation: ${operation}`);
    res.status(getStatusCode(ErrorCode.SERVICE_UNAVAILABLE)).json(errorResponse);
    return;
  }

  // Record start time
  const startTime = Date.now();
  extRes.locals.startTime = startTime;
  extRes.locals.operation = operation;
  extRes.locals.family = req.consentContext?.family || 'unknown';

  // Hook into response finish event
  const originalEnd = res.end;
  res.end = function (this: Response, ...args: any[]): Response {
    // Calculate latency
    const latency = Date.now() - startTime;

    // Get status
    const status = res.statusCode >= 200 && res.statusCode < 300 ? 'success' : 'error';

    // Record latency metric
    operationLatency.labels(operation, extRes.locals.family!, status).observe(latency);

    // Add SLO latency header
    res.setHeader('X-SLO-Latency', `${latency}ms`);

    // Check SLO violation
    const sloTarget = SLO_TARGETS[operation];
    if (sloTarget && latency > sloTarget.p99) {
      sloViolationTotal.labels(operation, 'p99').inc();
      circuitBreaker.recordViolation(operation);

      console.warn(
        `⚠️ SLO: p99 violation for ${operation}: ${latency}ms > ${sloTarget.p99}ms (violations: ${circuitBreaker.getViolationCount(operation)})`
      );
    }

    // Call original end
    return originalEnd.apply(this, args as any);
  };

  next();
}

/**
 * Export circuit breaker for testing
 */
export { circuitBreaker };
