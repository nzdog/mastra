/**
 * Verification API Routes
 *
 * Provides ledger and receipt verification endpoints:
 * - GET /v1/ledger/root - Get current Merkle root
 * - GET /v1/receipts/:id - Get and verify specific receipt
 * - GET /v1/keys/jwks - Get public keys for verification
 * - POST /v1/receipts/verify - Verify a receipt
 * - GET /v1/ledger/integrity - Verify ledger integrity
 */

import { Router, Request, Response } from 'express';
import { getLedgerSink } from '../../memory-layer/storage/ledger-sink';
import { getJWKSManager } from '../../memory-layer/governance/jwks-manager';
import {
  auditJwksFetchRequests,
  auditVerificationDuration,
  auditVerificationFailures,
  measureAsync,
} from '../../observability/metrics';

/**
 * Create verification router
 *
 * @param apiLimiter - Rate limiter for API endpoints
 * @returns Express router with verification endpoints
 */
export function createVerificationRouter(apiLimiter: any): Router {
  const router = Router();

  // GET /v1/ledger/root - Get current Merkle root
  router.get('/v1/ledger/root', apiLimiter, async (_req: Request, res: Response) => {
    try {
      const ledger = await getLedgerSink();
      const signer = ledger.getKeyRotationStatus();

      res.json({
        root: ledger.getRootHash(),
        height: ledger.getLedgerHeight(),
        timestamp: new Date().toISOString(),
        kid: signer.keyId,
        algorithm: 'Ed25519',
      });
    } catch (error) {
      console.error('Error in /v1/ledger/root:', error);
      res.status(500).json({
        error: 'Failed to get ledger root',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // GET /v1/receipts/:id - Get and verify specific receipt
  router.get('/v1/receipts/:id', apiLimiter, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const ledger = await getLedgerSink();

      const receipt = await ledger.getReceipt(id);
      if (!receipt) {
        return res.status(404).json({ error: 'Receipt not found' });
      }

      // Verify receipt
      const verification = ledger.verifyReceipt(receipt);

      res.json({
        receipt,
        verification: {
          valid: verification.valid,
          merkle_valid: verification.merkle_valid,
          signature_valid: verification.signature_valid,
          message: verification.message,
        },
      });
    } catch (error) {
      console.error('Error in /v1/receipts/:id:', error);
      res.status(500).json({
        error: 'Failed to get receipt',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // GET /v1/keys/jwks - Get public keys for verification
  router.get('/v1/keys/jwks', apiLimiter, async (_req: Request, res: Response) => {
    try {
      // Phase 1.2: Emit JWKS fetch metric
      auditJwksFetchRequests.labels('success').inc();
      const jwksManager = await getJWKSManager();
      const jwks = await jwksManager.getJWKS();

      res.json(jwks);
    } catch (error) {
      // Phase 1.2: Emit JWKS fetch error metric
      auditJwksFetchRequests.labels('error').inc();
      console.error('Error in /v1/keys/jwks:', error);
      res.status(500).json({
        error: 'Failed to get JWKS',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // POST /v1/receipts/verify - Verify a receipt
  router.post('/v1/receipts/verify', apiLimiter, async (req: Request, res: Response) => {
    try {
      const { receipt } = req.body;

      if (!receipt) {
        return res.status(400).json({ error: 'Missing receipt' });
      }

      const ledger = await getLedgerSink();

      // Phase 1.2: Measure verification duration
      const verification = await measureAsync(
        auditVerificationDuration,
        { verification_type: 'full' },
        async () => ledger.verifyReceipt(receipt)
      );

      // Phase 1.2: Emit verification failure metric
      if (!verification.valid) {
        const reason = !verification.merkle_valid ? 'merkle_invalid' : 'signature_invalid';
        auditVerificationFailures.labels(reason).inc();
      }

      res.json({
        valid: verification.valid,
        details: {
          merkle_valid: verification.merkle_valid,
          signature_valid: verification.signature_valid,
          message: verification.message,
        },
      });
    } catch (error) {
      console.error('Error in /v1/receipts/verify:', error);
      res.status(500).json({
        error: 'Failed to verify receipt',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // GET /v1/ledger/integrity - Verify ledger integrity
  router.get('/v1/ledger/integrity', apiLimiter, async (req: Request, res: Response) => {
    try {
      const { full } = req.query;
      const ledger = await getLedgerSink();

      // Phase 1.1: Full chain verification (for now, will add incremental later)
      const result = ledger.verifyChain();

      res.json({
        valid: result.valid,
        message: result.message,
        brokenAt: result.brokenAt,
        height: ledger.getLedgerHeight(),
        timestamp: new Date().toISOString(),
        verificationType: full === 'true' ? 'full' : 'incremental',
      });
    } catch (error) {
      console.error('Error in /v1/ledger/integrity:', error);
      res.status(500).json({
        error: 'Failed to verify integrity',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return router;
}
