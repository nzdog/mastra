/**
 * Server Lifecycle Management
 *
 * Handles server initialization, startup, and graceful shutdown:
 * - startServer() - Initialize components and start listening
 * - setupGracefulShutdown() - Register SIGTERM/SIGINT handlers
 */

import { Express } from 'express';
import { SessionStore } from '../session-store';
import { getLedgerSink } from '../memory-layer/storage/ledger-sink';
// MVE: Import Observer type for cleanup
import type { Observer } from '../observability/mve-types';

/**
 * Start the server with initialization and health checks
 *
 * @param app - Express application instance
 * @param port - Port number to listen on
 * @param isReadyRef - Mutable reference to server readiness flag
 */
export async function startServer(
  app: Express,
  port: number,
  isReadyRef: { current: boolean }
): Promise<void> {
  try {
    console.log('🔧 Initializing server components...');

    // OPTIONAL: Protocol validation at startup (fast-fail guard for production)
    // NOTE: This is redundant - loader also validates per-request
    // Purpose: Fail fast in production before accepting traffic
    console.log('📋 Validating protocol files at startup...');
    const path = require('path');
    const { ProtocolValidator } = require('../protocol/validation');
    const protocolValidator = new ProtocolValidator();
    const protocolDir = path.join(__dirname, '../../protocols');
    const validationResults = protocolValidator.validateDirectory(protocolDir);

    const hasErrors = validationResults.some((r: { hasErrors: boolean }) => r.hasErrors);
    const erroredProtocols = validationResults.filter((r: { hasErrors: boolean }) => r.hasErrors);

    if (hasErrors) {
      console.error('❌ Protocol validation errors at startup:');
      erroredProtocols.forEach(
        (r: { filename: string; errorCount: number; errors: { message: string }[] }) => {
          console.error(`  - ${r.filename}: ${r.errorCount} error(s)`);
          r.errors.slice(0, 3).forEach((e: { message: string }) => {
            console.error(`    • ${e.message}`);
          });
          if (r.errorCount > 3) {
            console.error(`    ... and ${r.errorCount - 3} more`);
          }
        }
      );

      // Environment-aware strictness
      const isProduction = process.env.NODE_ENV === 'production';
      const strictModeOverride = process.env.PROTOCOL_VALIDATION_STRICT;

      const strictMode =
        strictModeOverride !== undefined ? strictModeOverride === 'true' : isProduction;

      if (strictMode) {
        // STRICT MODE: Block startup
        console.error('\n❌ Server startup aborted due to invalid protocols');
        console.error(`   Environment: ${isProduction ? 'production' : 'development'}`);
        console.error(`   Mode: STRICT`);
        console.error('   Run "npm run validate:protocols" for detailed diagnostics');
        console.error('   Set PROTOCOL_VALIDATION_STRICT=false to allow startup');
        process.exit(1);
      } else {
        // PERMISSIVE MODE: Warn but continue
        console.warn('\n⚠️  STARTUP VALIDATION (PERMISSIVE): Invalid protocols detected');
        console.warn(`   Invalid protocols will be skipped by the loader`);
        console.warn(`   Skipped (invalid): ${erroredProtocols.length}`);
        erroredProtocols.forEach((r: { filename: string; errorCount: number }) => {
          console.warn(`     - ${r.filename} (${r.errorCount} errors)`);
        });
        console.warn('   Run "npm run validate:protocols" for detailed diagnostics');
      }
    } else {
      console.log('✅ All protocol files passed validation');
    }

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
      const { assertKmsUsable } = require('../memory-layer/security/encryption-service');
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
    app.listen(port, () => {
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

🚀 Server running on http://localhost:${port}

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

/**
 * Graceful shutdown handler for SIGTERM/SIGINT
 * Ensures clean shutdown of database connections and active sessions
 *
 * @param signal - Signal name (SIGTERM or SIGINT)
 * @param sessionStore - Session store instance for cleanup
 * @param observer - MVE observer instance for cleanup (optional)
 */
async function gracefulShutdown(
  signal: string,
  sessionStore: SessionStore,
  observer?: Observer
): Promise<void> {
  console.log(`\n⚠️  Received ${signal} - starting graceful shutdown...`);

  try {
    // MVE: Start - Flush observer before shutdown
    if (observer) {
      console.log('📊 MVE: Flushing observation buffer...');
      await observer.flush();
      console.log('✅ MVE: Observer flushed');
    }
    // MVE: End

    // 1. Close PostgreSQL pool if using Postgres persistence
    if (process.env.PERSISTENCE === 'postgres') {
      const { getPostgresStore } = require('../memory-layer/storage/postgres-store');
      const postgresStore = getPostgresStore();
      console.log('🔌 Closing PostgreSQL connection pool...');
      await postgresStore.close();
      console.log('✅ PostgreSQL pool closed');
    }

    // 2. Close Redis connection if using Redis for sessions
    if (process.env.REDIS_URL && sessionStore) {
      console.log('🔌 Closing Redis connection...');
      const redisClient = (sessionStore as { redis?: { quit: () => Promise<void> } }).redis;
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

/**
 * Setup graceful shutdown handlers for SIGTERM and SIGINT
 *
 * @param sessionStore - Session store instance for cleanup
 * @param observer - MVE observer instance for cleanup (optional)
 */
export function setupGracefulShutdown(sessionStore: SessionStore, observer?: Observer): void {
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM', sessionStore, observer));
  process.on('SIGINT', () => gracefulShutdown('SIGINT', sessionStore, observer));
}
