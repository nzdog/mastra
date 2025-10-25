import * as path from 'path';
import express, { Request, Response } from 'express';
import { loadConfig } from './server/config';
import { applyMiddleware } from './server/middleware';
import { createHealthRouter } from './server/routes/health';
import { createMetricsRouter } from './server/routes/metrics';
import { createVerificationRouter } from './server/routes/verification';
import { createProtocolRouter } from './server/routes/protocols';
import { getLedgerSink } from './memory-layer/storage/ledger-sink';
import memoryRouter from './memory-layer/api/memory-router';
import { getMemoryStore } from './memory-layer/storage/in-memory-store';
import { errorHandler } from './memory-layer/middleware/error-handler';

// Load configuration
const config = loadConfig();
const { apiKey: API_KEY, sessionStore, corsConfig } = config;

// Server readiness flag (mutable reference for health router)
const isReadyRef = { current: false };

// Types for API now defined in route modules

// Cleanup expired sessions every 10 minutes (for in-memory store)
setInterval(
  async () => {
    await sessionStore.cleanup();
  },
  10 * 60 * 1000
);

// Initialize memory store (singleton)
const memoryStore = getMemoryStore();

// Cleanup expired memory records every 60 seconds (TTL enforcement)
setInterval(
  async () => {
    try {
      const deletedCount = await memoryStore.clearExpired();
      if (deletedCount > 0) {
        console.log(`🧹 MEMORY: Cleared ${deletedCount} expired memory records`);
      }
    } catch (error) {
      console.error('❌ MEMORY: Error clearing expired records:', error);
    }
  },
  60 * 1000 // Run every 60 seconds
);

// Session and protocol helper functions now in src/server/routes/protocols.ts

// Initialize Express app
const app = express();
const PORT = config.port;

// Trust proxy - Critical for rate limiting behind reverse proxies (Railway, Heroku, etc.)
// Without this, all requests appear to come from the proxy's IP, breaking per-client rate limits
app.set('trust proxy', 1);

// Temporarily disable static middleware to test logo route
const fs = require('fs');
const assetsPath = path.join(__dirname, '../assets');
console.log(`📁 Assets path: ${assetsPath}`);

// Rate limiters now loaded from config
const { api: apiLimiter, aiEndpoint: aiEndpointLimiter, sessionCreation: sessionCreationLimiter, metrics: metricsLimiter } = config.rateLimiters;

// Apply all middleware (security, CORS, body parser)
applyMiddleware(app, config);

// Mount health check routes
const healthRouter = createHealthRouter(sessionStore, apiLimiter, isReadyRef);
app.use(healthRouter);

// Mount verification routes
const verificationRouter = createVerificationRouter(apiLimiter);
app.use(verificationRouter);

// Mount metrics routes
const metricsRouter = createMetricsRouter(apiLimiter, metricsLimiter);
app.use(metricsRouter);

// Mount protocol routes
const protocolRouter = createProtocolRouter(
  API_KEY,
  sessionStore,
  apiLimiter,
  aiEndpointLimiter,
  sessionCreationLimiter
);
app.use(protocolRouter);

// Test route
app.get('/test-route', (_req: Request, res: Response) => {
  console.log('✅ Test route hit!');
  res.send('Test route works!');
});

// Logo endpoint
app.get('/lichen-logo.png', (_req: Request, res: Response) => {
  console.log(`🖼️  Logo route hit!`);
  const logoPath = path.join(__dirname, '../lichen-logo.png');
  console.log(`🖼️  Serving logo from: ${logoPath}`);
  console.log(`🖼️  File exists: ${fs.existsSync(logoPath)}`);

  try {
    const imageBuffer = fs.readFileSync(logoPath);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', imageBuffer.length);
    res.send(imageBuffer);
    console.log(`✅ Logo served successfully`);
  } catch (error) {
    console.error(`❌ Error serving logo:`, error);
    res.status(404).send('Logo not found');
  }
});

// Root endpoint - Serve the production frontend
app.get('/', (_req: Request, res: Response) => {
  const fs = require('fs');
  const path = require('path');
  const indexPath = path.join(__dirname, '../index.html');

  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res
      .status(404)
      .send('Frontend not found. Please ensure index.html exists in the project root.');
  }
});

// Test interface
app.get('/test', (_req: Request, res: Response) => {
  const fs = require('fs');
  const path = require('path');
  const testFilePath = path.join(__dirname, '../test-frontend.html');

  if (fs.existsSync(testFilePath)) {
    res.sendFile(testFilePath);
  } else {
    res
      .status(404)
      .send(
        'Test interface not found. Please ensure test-frontend.html exists in the project root.'
      );
  }
});

// Health check routes now mounted via healthRouter

// Verification and metrics routes now mounted via verificationRouter and metricsRouter



// Protocol routes now mounted via protocolRouter


// ============================================================================
// Phase 2: Memory Layer Routes
// ============================================================================

/**
 * Memory Layer API Routes
 *
 * All memory operations follow the pattern: /v1/{family}/{operation}
 * Where {family} is one of: personal, cohort, population
 *
 * Operations:
 * - POST /v1/{family}/store - Store new memory record
 * - GET /v1/{family}/recall - Retrieve memory records
 * - POST /v1/{family}/distill - Aggregate data with k-anonymity
 * - DELETE /v1/{family}/forget - Delete memory records (GDPR)
 * - GET /v1/{family}/export - Export user data (GDPR)
 *
 * Middleware stack (applied in memory-router):
 * 1. Consent resolver - validates auth and extracts consent family
 * 2. Schema validator - validates request against JSON schema
 * 3. SLO middleware - tracks latency and enforces SLO
 * 4. Operation handlers - execute memory operations with audit
 */
app.use('/v1/:family', apiLimiter, memoryRouter);

// ============================================================================
// Error Handling (must be last)
// ============================================================================

/**
 * Global error handler for memory layer operations
 * Converts all errors to ErrorResponse format with trace IDs
 */
app.use(errorHandler);

// Async server startup with ledger initialization (Phase 3.2)
async function startServer() {
  try {
    console.log('🔧 Initializing server components...');

    // Initialize ledger sink conditionally (Phase 3.2: Graceful degradation)
    const ledgerEnabled = process.env.LEDGER_ENABLED !== 'false';
    const ledgerOptional = process.env.LEDGER_OPTIONAL === 'true';

    if (ledgerEnabled) {
      console.log('📚 Initializing ledger sink...');
      try {
        const ledger = await getLedgerSink();
        console.log(`✅ Ledger initialized (height: ${ledger.getLedgerHeight()})`);
      } catch (ledgerError) {
        if (ledgerOptional) {
          // Graceful degradation: log warning and continue
          console.warn('⚠️  Ledger initialization failed (LEDGER_OPTIONAL=true):');
          console.warn(
            `   ${ledgerError instanceof Error ? ledgerError.message : String(ledgerError)}`
          );
          console.warn('   Server will continue without audit logging persistence.');
        } else {
          // Fail-closed: ledger is required in production
          console.error('❌ Ledger initialization failed (required for production):');
          console.error(
            `   ${ledgerError instanceof Error ? ledgerError.message : String(ledgerError)}`
          );
          throw ledgerError;
        }
      }
    } else {
      console.log(
        '⚠️  Ledger disabled (LEDGER_ENABLED=false) - audit events will not be persisted'
      );
    }

    // Phase 3.2: KMS health check (encryption enabled)
    const encryptionEnabled = process.env.ENCRYPTION_ENABLED === 'true';
    if (encryptionEnabled) {
      console.log('🔐 Verifying KMS provider health...');
      const { assertKmsUsable } = require('./memory-layer/security/encryption-service');
      await assertKmsUsable();
      console.log('✅ KMS health check passed');
    } else {
      console.log(
        '⚠️  Encryption disabled (ENCRYPTION_ENABLED=false) - data will not be encrypted at rest'
      );
    }

    // Mark server as ready (Phase 3.2: /readyz will return 200)
    isReadyRef.current = true;
    console.log('✅ Server initialization complete');

    // Start listening
    app.listen(PORT, () => {
      // Get current git branch
      const { execSync } = require('child_process');
      let branchName = 'unknown';
      try {
        branchName = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
      } catch {
        // If git command fails, use unknown
      }

      console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║        Field Diagnostic Protocol - API Server                  ║
║        Branch: ${branchName.padEnd(47)}║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝

🚀 Server running on http://localhost:${PORT}

Protocol Walk Endpoints:
  GET    /api/protocols       - List available protocols
  POST   /api/walk/start      - Start new protocol walk
  POST   /api/walk/continue   - Continue protocol walk
  POST   /api/walk/complete   - Complete protocol
  GET    /api/session/:id     - Get session state (debug)

Health & Monitoring:
  GET    /health              - Health check (legacy)
  GET    /v1/health           - Memory Layer health check (spec-compliant)
  GET    /readyz              - Readiness check (Phase 3.2)
  GET    /api/metrics         - Performance metrics
  GET    /metrics             - Prometheus audit metrics (Phase 1.2)

Phase 1.1 Verification Endpoints:
  GET    /v1/ledger/root      - Get current Merkle root
  GET    /v1/receipts/:id     - Get and verify audit receipt
  POST   /v1/receipts/verify  - Verify a receipt
  GET    /v1/keys/jwks        - Get public keys (JWKS)
  GET    /v1/ledger/integrity - Verify ledger chain integrity

Ready to accept connections.
`);
    });
  } catch (error) {
    console.error('❌ Failed to initialize server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

// ============================================================================
// Graceful Shutdown Handlers (HIGH-4: Process Exit Handlers)
// ============================================================================

/**
 * Graceful shutdown handler for SIGTERM/SIGINT
 * Ensures clean shutdown of database connections and active sessions
 */
async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`\n⚠️  Received ${signal} - starting graceful shutdown...`);

  try {
    // 1. Close PostgreSQL pool if using Postgres persistence
    if (process.env.PERSISTENCE === 'postgres') {
      const { getPostgresStore } = require('./memory-layer/storage/postgres-store');
      const postgresStore = getPostgresStore();
      console.log('🔌 Closing PostgreSQL connection pool...');
      await postgresStore.close();
      console.log('✅ PostgreSQL pool closed');
    }

    // 2. Close Redis connection if using Redis for sessions
    if (process.env.REDIS_URL && sessionStore) {
      console.log('🔌 Closing Redis connection...');
      const redisClient = (sessionStore as any).redis;
      if (redisClient && typeof redisClient.quit === 'function') {
        await redisClient.quit();
        console.log('✅ Redis connection closed');
      }
    }

    // 3. Log shutdown metrics
    const sessionCount = await sessionStore.size();
    console.log(`📊 Shutdown stats: ${sessionCount} active sessions`);

    console.log('✅ Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
}

// Register signal handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
