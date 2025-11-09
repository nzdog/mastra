/**
 * Server Configuration Module
 *
 * Centralizes all configuration initialization:
 * - Environment variables
 * - Session store setup (Redis/in-memory)
 * - Rate limiters
 * - CORS configuration
 */

import * as dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { SessionStore, createSessionStore } from '../session-store';
import { parseCorsConfig, CorsConfig } from '../config/cors';

// Load environment variables
dotenv.config();

/**
 * Application configuration interface
 */
export interface AppConfig {
  apiKey: string | undefined;
  port: number;
  sessionStore: SessionStore;
  corsConfig: CorsConfig;
  rateLimiters: {
    api: ReturnType<typeof rateLimit>;
    aiEndpoint: ReturnType<typeof rateLimit>;
    sessionCreation: ReturnType<typeof rateLimit>;
    metrics: ReturnType<typeof rateLimit>;
  };
}

/**
 * Initialize and return session store (Redis if available, otherwise in-memory)
 */
function initializeSessionStore(apiKey: string | undefined): SessionStore {
  if (process.env.REDIS_URL) {
    try {
      // Dynamic import for Redis (optional dependency)
      const Redis = require('ioredis');
      const redis = new Redis(process.env.REDIS_URL);

      redis.on('connect', () => {
        console.log('✅ Connected to Redis');
      });

      redis.on('error', (err: Error) => {
        console.error('❌ Redis connection error:', err);

        // Fail-fast in production to prevent session data loss
        if (process.env.NODE_ENV === 'production') {
          console.error(
            '⚠️  Redis is required for production. Cannot continue with failed connection.'
          );
          console.error('   Either fix REDIS_URL or unset it to use in-memory store.');
          process.exit(1);
        }

        // In development, log the error but allow the app to continue
        // Note: The app will still use the Redis store (which may fail),
        // but this prevents crashes during development
        console.warn('⚠️  Continuing with Redis despite error (development mode)');
      });

      return createSessionStore({ type: 'redis', redis, apiKey: apiKey! });
    } catch {
      console.warn('⚠️  Redis module not installed. Using in-memory session store.');
      console.log('   To enable Redis: npm install ioredis');
      return createSessionStore({ type: 'memory', apiKey: apiKey! });
    }
  } else {
    return createSessionStore({ type: 'memory', apiKey: apiKey! });
  }
}

/**
 * Create rate limiter configurations
 */
function createRateLimiters() {
  // Check if we're in test mode - disable rate limiting for tests
  const isTest =
    process.env.NODE_ENV === 'test' || process.env.DISABLE_RATE_LIMIT === 'true';

  // Custom handler that includes trace ID in 429 responses
  const rateLimitHandler = (req: any, res: any) => {
    const traceId = req.get('X-Trace-ID') || 'unknown';
    res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests from this IP, please try again later.',
        trace_id: traceId,
      },
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
      trace_id: traceId,
    });
  };

  // General API rate limiter - more lenient for read operations
  const api = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isTest ? 10000 : 100, // Very high limit in test mode
    skip: isTest ? () => true : undefined, // Skip entirely in test mode
    message: {
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: '15 minutes',
    },
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    handler: rateLimitHandler,
  });

  // Strict rate limiter for AI endpoints (expensive operations)
  const aiEndpoint = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isTest ? 10000 : 20, // Very high limit in test mode
    skip: isTest ? () => true : undefined, // Skip entirely in test mode
    message: {
      error: 'Too many AI requests from this IP. Please wait before continuing.',
      retryAfter: '15 minutes',
      note: 'AI operations are rate-limited to prevent API cost abuse.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
  });

  // Very strict limiter for session creation
  const sessionCreation = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: isTest ? 10000 : 10, // Very high limit in test mode
    skip: isTest ? () => true : undefined, // Skip entirely in test mode
    message: {
      error: 'Too many sessions created from this IP. Please try again later.',
      retryAfter: '1 hour',
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
  });

  // Metrics endpoint rate limiter
  const metrics = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: isTest ? 10000 : 10, // Very high limit in test mode
    skip: isTest ? () => true : undefined, // Skip entirely in test mode
    message: {
      error: 'Too many metrics requests. Please slow down.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
  });

  return { api, aiEndpoint, sessionCreation, metrics };
}

/**
 * Load and validate application configuration
 *
 * @returns {AppConfig} Complete application configuration
 */
export function loadConfig(): AppConfig {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  // Allow skipping the strict API key check in CI/test/dev for Phase 0.
  if (!apiKey && process.env.NODE_ENV !== 'test' && process.env.SKIP_API_KEY_CHECK !== 'true') {
    console.error('Error: ANTHROPIC_API_KEY not found in environment variables.');
    process.exit(1);
  } else if (!apiKey) {
    console.warn('⚠️  ANTHROPIC_API_KEY missing, continuing in permissive mode for tests/dev.');
  }

  const port = parseInt(process.env.PORT || '3000', 10);
  const sessionStore = initializeSessionStore(apiKey);
  const corsConfig = parseCorsConfig();
  const rateLimiters = createRateLimiters();

  return {
    apiKey,
    port,
    sessionStore,
    corsConfig,
    rateLimiters,
  };
}
