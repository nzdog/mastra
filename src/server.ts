import * as path from 'path';
import express from 'express';
import { loadConfig } from './server/config';
import { applyMiddleware } from './server/middleware';
import { createHealthRouter } from './server/routes/health';
import { createMetricsRouter } from './server/routes/metrics';
import { createVerificationRouter } from './server/routes/verification';
import { createProtocolRouter } from './server/routes/protocols';
import { createStaticRouter } from './server/routes/static';
import { startServer, setupGracefulShutdown } from './server/lifecycle';
import memoryRouter from './memory-layer/api/memory-router';
import { getMemoryStore } from './memory-layer/storage/in-memory-store';
import { errorHandler } from './memory-layer/middleware/error-handler';

// Load configuration
const config = loadConfig();
const { apiKey: API_KEY, sessionStore } = config;

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

// Trust proxy - Critical for rate limiting behind reverse proxies (Railway, Heroku, etc.)
// Without this, all requests appear to come from the proxy's IP, breaking per-client rate limits
app.set('trust proxy', 1);

// Log assets path for debugging
const assetsPath = path.join(__dirname, '../assets');
console.log(`📁 Assets path: ${assetsPath}`);

// Rate limiters now loaded from config
const {
  api: apiLimiter,
  aiEndpoint: aiEndpointLimiter,
  sessionCreation: sessionCreationLimiter,
  metrics: metricsLimiter,
} = config.rateLimiters;

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

// Mount static content routes
const staticRouter = createStaticRouter();
app.use(staticRouter);

// All application routes now mounted via routers

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

// ============================================================================
// Server Lifecycle (startup and shutdown)
// ============================================================================

// Start the server with initialization and register shutdown handlers
(async () => {
  try {
    await startServer(app, config.port, isReadyRef);
    setupGracefulShutdown(sessionStore);
  } catch (error) {
    console.error('❌ Fatal error starting server:', error);
    process.exit(1);
  }
})();
