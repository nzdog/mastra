/**
 * COHERENCE ENGINE HTTP SERVER
 * Express server with API endpoints
 */

import express, { Express } from 'express';
import cors from 'cors';
import { stabiliseOnly, evaluate, driftCheck, health } from './handlers';

/**
 * Create and configure Express app
 */
export function createApp(): Express {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Request logging
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });

  // Routes
  app.get('/health', health);
  app.post('/coherence/stabilise-only', stabiliseOnly);
  app.post('/coherence/evaluate', evaluate);
  app.post('/coherence/debug/drift-check', driftCheck);

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
    console.log('═══════════════════════════════════════════════════════');
    console.log('  LICHEN COHERENCE ENGINE');
    console.log('  Phase 2: Stabilisation + Amplification');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  Server running on port ${port}`);
    console.log('  Endpoints:');
    console.log(`    POST http://localhost:${port}/coherence/stabilise-only`);
    console.log(`    POST http://localhost:${port}/coherence/evaluate (with upward)`);
    console.log(`    POST http://localhost:${port}/coherence/debug/drift-check`);
    console.log(`    GET  http://localhost:${port}/health`);
    console.log('═══════════════════════════════════════════════════════');
  });
}
