/**
 * COHERENCE ENGINE HTTP SERVER
 * Express server with API endpoints
 */

import express, { Express } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { stabiliseOnly, evaluate, driftCheck, health } from './handlers';
import { REQUEST_SIZE_LIMIT, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS } from '../constants';
import { apiKeyAuth } from '../middleware/auth';
import { logger } from '../utils/logger';

/**
 * Create and configure Express app
 */
export function createApp(): Express {
  const app = express();

  // Trust proxy for accurate rate limiting behind load balancers
  app.set('trust proxy', 1);

  // CORS configuration - specify allowed origins for production
  const corsOptions = {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
    credentials: true,
  };
  app.use(cors(corsOptions));

  // Request size limits to prevent abuse
  app.use(express.json({ limit: REQUEST_SIZE_LIMIT }));

  // Rate limiting for API endpoints
  const apiLimiter = rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RATE_LIMIT_MAX_REQUESTS,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Request logging
  app.use((req, res, next) => {
    logger.info('HTTP Request', { method: req.method, path: req.path });
    next();
  });

  // Routes
  app.get('/health', health);

  // Apply authentication and rate limiting to coherence endpoints
  app.post('/coherence/stabilise-only', apiKeyAuth, apiLimiter, stabiliseOnly);
  app.post('/coherence/evaluate', apiKeyAuth, apiLimiter, evaluate);
  app.post('/coherence/debug/drift-check', apiKeyAuth, apiLimiter, driftCheck);

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not found',
      path: req.path,
    });
  });

  return app;
}

/**
 * Start the server
 */
export function startServer(port: number = 3000): void {
  const app = createApp();

  app.listen(port, () => {
    const authEnabled = !!process.env.COHERENCE_API_KEY;

    console.log('═══════════════════════════════════════════════════════');
    console.log('  LICHEN COHERENCE ENGINE');
    console.log('  Phase 2: Stabilisation + Amplification');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  Server running on port ${port}`);
    console.log(`  Authentication: ${authEnabled ? '✅ ENABLED' : '⚠️  DISABLED (set COHERENCE_API_KEY)'}`);
    console.log('  Endpoints:');
    console.log(`    POST http://localhost:${port}/coherence/stabilise-only`);
    console.log(`    POST http://localhost:${port}/coherence/evaluate (with upward)`);
    console.log(`    POST http://localhost:${port}/coherence/debug/drift-check`);
    console.log(`    GET  http://localhost:${port}/health`);
    if (authEnabled) {
      console.log('');
      console.log('  🔐 Protected endpoints require x-api-key header');
    }
    console.log('═══════════════════════════════════════════════════════');
  });
}
