/**
 * Metrics and Info Routes
 *
 * Provides observability and information endpoints:
 * - GET /metrics - Prometheus metrics export
 * - GET /api/metrics - Performance and cache statistics
 * - GET /api/git/branch - Current git branch info
 * - GET /api/branch - Legacy branch endpoint
 */

import { Router, Request, Response } from 'express';
import { performanceMonitor, CacheStats } from '../../performance';
import { getMetrics, getContentType } from '../../observability/metrics';

/**
 * Create metrics router
 *
 * @param apiLimiter - Rate limiter for API endpoints
 * @param metricsLimiter - Rate limiter for metrics endpoints
 * @returns Express router with metrics endpoints
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createMetricsRouter(apiLimiter: any, metricsLimiter: any): Router {
  const router = Router();

  // Prometheus metrics endpoint (Phase 1.2)
  router.get('/metrics', metricsLimiter, async (_req: Request, res: Response) => {
    res.set('Content-Type', getContentType());
    res.end(await getMetrics());
  });

  // Performance metrics endpoint (rate-limited)
  router.get('/api/metrics', metricsLimiter, (_req: Request, res: Response) => {
    const summary = performanceMonitor.getSummary();
    const cacheStats = CacheStats.getStats();
    const memory = performanceMonitor.getMemoryUsage();

    res.json({
      performance: {
        ...summary,
        avg_duration_ms: Math.round(summary.avg_duration_ms * 100) / 100,
        p50_duration_ms: Math.round(summary.p50_duration_ms * 100) / 100,
        p95_duration_ms: Math.round(summary.p95_duration_ms * 100) / 100,
        p99_duration_ms: Math.round(summary.p99_duration_ms * 100) / 100,
        cache_hit_rate: Math.round(summary.cache_hit_rate * 10000) / 100 + '%',
      },
      cache: {
        ...cacheStats,
        hit_rate: Math.round(cacheStats.hit_rate * 10000) / 100 + '%',
      },
      memory,
      timestamp: new Date().toISOString(),
    });
  });

  // Git branch info endpoint (for UI display)
  router.get('/api/git/branch', apiLimiter, (_req: Request, res: Response) => {
    const { execSync } = require('child_process');
    let branchName = 'unknown';
    try {
      branchName = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    } catch {
      // If git command fails, use unknown
    }

    res.json({
      branch: branchName,
      timestamp: new Date().toISOString(),
    });
  });

  // Get current git branch (Railway-compatible endpoint from main)
  router.get('/api/branch', (_req: Request, res: Response) => {
    const { execSync } = require('child_process');
    let branchName = 'unknown';
    let commitHash = 'unknown';

    try {
      branchName = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
      commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
    } catch (error) {
      console.error('Error getting git info:', error);
    }

    res.json({
      branch: branchName,
      commit: commitHash,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
    });
  });

  return router;
}
