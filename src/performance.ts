/**
 * Performance Monitoring Utilities
 *
 * Provides tools to track and analyze performance metrics:
 * - Request timing
 * - Cache hit rates
 * - API call costs
 * - Memory usage
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Performance metrics for a single request
 *
 * Captures timing, caching, cost, and resource usage data.
 */
export interface PerformanceMetrics {
  /** ISO timestamp when the request was recorded */
  timestamp: string;
  /** API endpoint path (e.g., '/api/walk/start') */
  endpoint: string;
  /** Request duration in milliseconds */
  duration_ms: number;
  /** Number of cache hits during this request */
  cache_hits: number;
  /** Number of cache misses during this request */
  cache_misses: number;
  /** Number of API calls made to Claude */
  api_calls: number;
  /** Total cost in USD for this request */
  total_cost: number;
  /** Memory usage in megabytes (optional) */
  memory_usage_mb?: number;
}

/**
 * Performance Monitor - Tracks and analyzes request performance
 *
 * Collects metrics for API requests including timing, caching effectiveness,
 * API usage, and costs. Provides statistical summaries for monitoring.
 *
 * @example
 * ```typescript
 * const monitor = new PerformanceMonitor();
 *
 * // Time a request
 * const stopTimer = monitor.startTimer();
 * await doWork();
 * const duration = stopTimer();
 *
 * // Record metrics
 * monitor.recordRequest({
 *   endpoint: '/api/walk/start',
 *   duration_ms: duration,
 *   cache_hits: 1,
 *   cache_misses: 0,
 *   api_calls: 2,
 *   total_cost: 0.0164
 * });
 *
 * // Get summary
 * const summary = monitor.getSummary('/api/walk/start');
 * console.log(`Avg duration: ${summary.avg_duration_ms}ms`);
 * ```
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private maxMetricsSize = 1000; // Keep last 1000 requests

  /**
   * Start timing a request
   */
  startTimer(): () => number {
    const startTime = Date.now();
    return () => Date.now() - startTime;
  }

  /**
   * Record a request metric
   */
  recordRequest(metric: Omit<PerformanceMetrics, 'timestamp'>): void {
    this.metrics.push({
      ...metric,
      timestamp: new Date().toISOString(),
    });

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetricsSize) {
      this.metrics.shift();
    }
  }

  /**
   * Get summary statistics
   */
  getSummary(endpoint?: string): {
    total_requests: number;
    avg_duration_ms: number;
    cache_hit_rate: number;
    total_api_calls: number;
    total_cost: number;
    p50_duration_ms: number;
    p95_duration_ms: number;
    p99_duration_ms: number;
  } {
    let relevantMetrics = this.metrics;
    if (endpoint) {
      relevantMetrics = this.metrics.filter((m) => m.endpoint === endpoint);
    }

    if (relevantMetrics.length === 0) {
      return {
        total_requests: 0,
        avg_duration_ms: 0,
        cache_hit_rate: 0,
        total_api_calls: 0,
        total_cost: 0,
        p50_duration_ms: 0,
        p95_duration_ms: 0,
        p99_duration_ms: 0,
      };
    }

    const durations = relevantMetrics.map((m) => m.duration_ms).sort((a, b) => a - b);
    const totalCacheHits = relevantMetrics.reduce((sum, m) => sum + m.cache_hits, 0);
    const totalCacheMisses = relevantMetrics.reduce((sum, m) => sum + m.cache_misses, 0);
    const totalCacheRequests = totalCacheHits + totalCacheMisses;

    return {
      total_requests: relevantMetrics.length,
      avg_duration_ms:
        relevantMetrics.reduce((sum, m) => sum + m.duration_ms, 0) / relevantMetrics.length,
      cache_hit_rate: totalCacheRequests > 0 ? totalCacheHits / totalCacheRequests : 0,
      total_api_calls: relevantMetrics.reduce((sum, m) => sum + m.api_calls, 0),
      total_cost: relevantMetrics.reduce((sum, m) => sum + m.total_cost, 0),
      p50_duration_ms: durations[Math.floor(durations.length * 0.5)],
      p95_duration_ms: durations[Math.floor(durations.length * 0.95)],
      p99_duration_ms: durations[Math.floor(durations.length * 0.99)],
    };
  }

  /**
   * Get recent metrics
   */
  getRecentMetrics(count: number = 100): PerformanceMetrics[] {
    return this.metrics.slice(-count);
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
  }

  /**
   * Get current memory usage
   */
  getMemoryUsage(): {
    rss_mb: number;
    heap_used_mb: number;
    heap_total_mb: number;
    external_mb: number;
  } {
    const usage = process.memoryUsage();
    return {
      rss_mb: usage.rss / 1024 / 1024,
      heap_used_mb: usage.heapUsed / 1024 / 1024,
      heap_total_mb: usage.heapTotal / 1024 / 1024,
      external_mb: usage.external / 1024 / 1024,
    };
  }
}

/**
 * Global performance monitor instance
 */
export const performanceMonitor = new PerformanceMonitor();

/**
 * Express middleware to track request performance
 */
export function performanceMiddleware(endpoint: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const stopTimer = performanceMonitor.startTimer();

    // Track cache metrics from response
    res.on('finish', () => {
      const duration = stopTimer();
      performanceMonitor.recordRequest({
        endpoint,
        duration_ms: duration,
        cache_hits: res.locals.cache_hits || 0,
        cache_misses: res.locals.cache_misses || 0,
        api_calls: res.locals.api_calls || 0,
        total_cost: res.locals.total_cost || 0,
        memory_usage_mb: performanceMonitor.getMemoryUsage().heap_used_mb,
      });
    });

    next();
  };
}

/**
 * Cache statistics tracker
 */
export class CacheStats {
  private static hits = 0;
  private static misses = 0;
  private static startTime = Date.now();

  static recordHit(): void {
    this.hits++;
  }

  static recordMiss(): void {
    this.misses++;
  }

  static getStats(): {
    hits: number;
    misses: number;
    hit_rate: number;
    total_requests: number;
    uptime_seconds: number;
  } {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hit_rate: total > 0 ? this.hits / total : 0,
      total_requests: total,
      uptime_seconds: (Date.now() - this.startTime) / 1000,
    };
  }

  static reset(): void {
    this.hits = 0;
    this.misses = 0;
    this.startTime = Date.now();
  }
}
