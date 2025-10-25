/**
 * Health Check Routes
 *
 * Provides health and readiness endpoints:
 * - GET /health - Legacy health check with basic metrics
 * - GET /v1/health - Spec-compliant health check with audit ledger verification
 * - GET /readyz - Kubernetes-style readiness probe
 */

import { Router, Request, Response } from 'express';
import { SessionStore } from '../../session-store';
import { performanceMonitor } from '../../performance';
import { healthCheck } from '../../memory-layer/api/health';
import { getAuditEmitter } from '../../memory-layer/governance/audit-emitter';
import { getJWKSManager } from '../../memory-layer/governance/jwks-manager';
import { getSignerRegistry } from '../../memory-layer/governance/signer-registry';
import {
  auditLedgerSignerKid,
  auditJwksActiveKid,
  auditJwksMismatchTotal,
} from '../../observability/metrics';

/**
 * Create health check router
 *
 * @param sessionStore - Session store instance for metrics
 * @param apiLimiter - Rate limiter for API endpoints
 * @param isReadyRef - Mutable reference to server readiness flag
 * @returns Express router with health endpoints
 */
export function createHealthRouter(
  sessionStore: SessionStore,
  apiLimiter: any,
  isReadyRef: { current: boolean }
): Router {
  const router = Router();

  // Health check (legacy endpoint)
  router.get('/health', async (_req: Request, res: Response) => {
    const sessionCount = await sessionStore.size();
    const memory = performanceMonitor.getMemoryUsage();

    res.json({
      status: 'ok',
      active_sessions: sessionCount,
      session_store: process.env.REDIS_URL ? 'redis' : 'memory',
      memory_usage: {
        heap_used_mb: Math.round(memory.heap_used_mb * 100) / 100,
        heap_total_mb: Math.round(memory.heap_total_mb * 100) / 100,
      },
      timestamp: new Date().toISOString(),
    });
  });

  // Memory Layer v1 Health Check (spec-compliant)
  router.get('/v1/health', apiLimiter, async (_req: Request, res: Response) => {
    try {
      const healthResponse = await healthCheck();

      // Enrich with actual session metrics
      const sessionCount = await sessionStore.size();
      healthResponse.metrics.active_sessions = sessionCount;

      // Enrich with audit ledger metrics (Phase 1)
      const auditEmitter = getAuditEmitter();
      const ledgerHeight = await auditEmitter.getLedgerHeight();
      healthResponse.metrics.audit_ledger_height = ledgerHeight;

      // Get recent receipts to find last timestamp
      if (ledgerHeight > 0) {
        const recentReceipts = await auditEmitter.getRecentReceipts(1);
        if (recentReceipts.length > 0) {
          healthResponse.metrics.last_audit_receipt_timestamp = recentReceipts[0].event.timestamp;
        }
      }

      // Verify audit chain integrity (Phase 1 - Merkle chain verification)
      const chainVerification = await auditEmitter.verifyChainIntegrity();
      if (!chainVerification.valid) {
        healthResponse.components.audit.status = 'unhealthy';
        healthResponse.components.audit.message = chainVerification.message;
        healthResponse.status = 'unhealthy';
      } else {
        healthResponse.components.audit.message = `Merkle chain verified (${ledgerHeight} events)`;
      }

      // Get key rotation status (Phase 1)
      const keyStatus = await auditEmitter.getKeyRotationStatus();
      healthResponse.compliance.key_rotation_status = keyStatus.needsRotation
        ? keyStatus.ageDays >= 90
          ? 'expired'
          : 'expiring_soon'
        : 'current';
      healthResponse.compliance.last_key_rotation = keyStatus.createdAt;

      // Phase 1.2: Verify ledger signer kid matches JWKS active kid
      try {
        const registry = await getSignerRegistry();
        const ledgerSignerKid = registry.getCurrentKid();
        const jwksManager = await getJWKSManager();
        const jwks = await jwksManager.getJWKS();
        const jwksActiveKid = jwks.keys[0]?.kid; // First key is active key

        // Emit info gauges for monitoring
        auditLedgerSignerKid.labels(ledgerSignerKid).set(1);
        if (jwksActiveKid) {
          auditJwksActiveKid.labels(jwksActiveKid).set(1);
        }

        // Critical check: kids MUST match
        if (ledgerSignerKid !== jwksActiveKid) {
          console.error(
            `❌ CRITICAL: Ledger signer kid (${ledgerSignerKid}) !== JWKS active kid (${jwksActiveKid})`
          );
          auditJwksMismatchTotal.inc();
          healthResponse.status = 'unhealthy';
          healthResponse.components.audit.status = 'unhealthy';
          healthResponse.components.audit.message = `KEY MISMATCH: Ledger signer (${ledgerSignerKid}) != JWKS (${jwksActiveKid})`;
        }
      } catch (error) {
        console.error('⚠️ Failed to verify kid consistency:', error);
        healthResponse.components.audit.status = 'degraded';
        healthResponse.components.audit.message = 'Failed to verify kid consistency';
      }

      // Emit HEALTH audit event (Phase 1)
      await auditEmitter.emit('HEALTH', 'health_check', {
        status: healthResponse.status,
        session_count: sessionCount,
        ledger_height: ledgerHeight,
      });

      res.json(healthResponse);
    } catch (error) {
      console.error('Error in /v1/health:', error);
      res.status(500).json({
        status: 'unhealthy',
        error: 'Health check failed',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Readiness check endpoint (Phase 3.2)
  router.get('/readyz', (_req: Request, res: Response) => {
    if (isReadyRef.current) {
      res.status(200).json({ ready: true, message: 'Server is ready' });
    } else {
      res.status(503).json({ ready: false, message: 'Server is initializing...' });
    }
  });

  return router;
}
