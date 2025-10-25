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
        console.log('⚠️  Falling back to in-memory session store');
        return createSessionStore({ type: 'memory', apiKey: apiKey! });
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
  // General API rate limiter - more lenient for read operations
  const api = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    message: {
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: '15 minutes',
    },
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
  });

  // Strict rate limiter for AI endpoints (expensive operations)
  const aiEndpoint = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit each IP to 20 AI requests per window (protects API costs)
    message: {
      error: 'Too many AI requests from this IP. Please wait before continuing.',
      retryAfter: '15 minutes',
      note: 'AI operations are rate-limited to prevent API cost abuse.',
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Very strict limiter for session creation
  const sessionCreation = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // Limit each IP to 10 new sessions per hour
    message: {
      error: 'Too many sessions created from this IP. Please try again later.',
      retryAfter: '1 hour',
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Metrics endpoint rate limiter
  const metrics = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // Limit each IP to 10 requests per minute
    message: {
      error: 'Too many metrics requests. Please slow down.',
    },
    standardHeaders: true,
    legacyHeaders: false,
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
