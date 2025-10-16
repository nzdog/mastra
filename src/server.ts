/* eslint-disable import/order */
import { randomUUID } from 'crypto';
import * as path from 'path';
import cors from 'cors';
import * as dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { FieldDiagnosticAgent } from './agent';
import { healthCheck } from './memory-layer/api/health';
import { getAuditEmitter } from './memory-layer/governance/audit-emitter';
import { getLedgerSink } from './memory-layer/storage/ledger-sink';
import { getJWKSManager } from './memory-layer/governance/jwks-manager';
import { performanceMonitor, CacheStats } from './performance';
import { ProtocolLoader } from './protocol/loader';
import { ProtocolParser } from './protocol/parser';
import { Session, SessionStore, createSessionStore } from './session-store';
import { ProtocolRegistry } from './tools/registry';
import { SessionState } from './types';

// Load environment variables
dotenv.config();

const API_KEY = process.env.ANTHROPIC_API_KEY;

if (!API_KEY) {
  console.error('Error: ANTHROPIC_API_KEY not found in environment variables.');
  process.exit(1);
}

// Initialize session store (Redis if REDIS_URL provided, otherwise in-memory)
let sessionStore: SessionStore;
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
      sessionStore = createSessionStore({ type: 'memory', apiKey: API_KEY! });
    });

    sessionStore = createSessionStore({ type: 'redis', redis, apiKey: API_KEY! });
  } catch {
    console.warn('⚠️  Redis module not installed. Using in-memory session store.');
    console.log('   To enable Redis: npm install ioredis');
    sessionStore = createSessionStore({ type: 'memory', apiKey: API_KEY! });
  }
} else {
  sessionStore = createSessionStore({ type: 'memory', apiKey: API_KEY! });
}

// Types for API
interface Support {
  source: string;
  theme: string;
  excerpt: string;
}

interface StartRequest {
  user_input: string;
  protocol_slug?: string;
}

interface ContinueRequest {
  session_id: string;
  user_response: string;
}

interface CompleteRequest {
  session_id: string;
  generate_summary?: boolean;
}

// Input Validation & Sanitization
const INPUT_CONSTRAINTS = {
  MAX_USER_INPUT_LENGTH: 5000, // 5000 chars max for user input
  MAX_SESSION_ID_LENGTH: 100, // UUID should be ~36 chars
  MAX_PROTOCOL_SLUG_LENGTH: 200,
  MIN_USER_INPUT_LENGTH: 1,
};

/**
 * Validate and sanitize user input to prevent prompt injection and excessive token usage
 */
function validateUserInput(
  input: string,
  fieldName: string = 'input'
): { valid: boolean; error?: string; sanitized?: string } {
  // Check type
  if (typeof input !== 'string') {
    return { valid: false, error: `${fieldName} must be a string` };
  }

  // Trim whitespace
  const trimmed = input.trim();

  // Check minimum length
  if (trimmed.length < INPUT_CONSTRAINTS.MIN_USER_INPUT_LENGTH) {
    return { valid: false, error: `${fieldName} cannot be empty` };
  }

  // Check maximum length (prevents excessive token usage)
  if (trimmed.length > INPUT_CONSTRAINTS.MAX_USER_INPUT_LENGTH) {
    return {
      valid: false,
      error: `${fieldName} too long. Maximum ${INPUT_CONSTRAINTS.MAX_USER_INPUT_LENGTH} characters allowed (received ${trimmed.length})`,
    };
  }

  // Check for suspicious patterns (basic prompt injection detection)
  const suspiciousPatterns = [
    /ignore\s+(all\s+)?(previous|above|prior)\s+instructions/i,
    /disregard\s+(all\s+)?(previous|above|prior)\s+instructions/i,
    /forget\s+(all\s+)?(previous|above|prior)\s+instructions/i,
    /system\s*:\s*/i, // Trying to inject system messages
    /assistant\s*:\s*/i, // Trying to inject assistant messages
    /<\|im_start\|>/i, // ChatML injection
    /<\|im_end\|>/i,
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(trimmed)) {
      console.warn(`⚠️  Potential prompt injection detected: ${trimmed.substring(0, 100)}...`);
      // Log but don't block - could be legitimate conversation about AI
      // return { valid: false, error: 'Input contains suspicious patterns' };
    }
  }

  // Check for excessive special characters (might indicate injection attempt)
  const specialCharCount = (trimmed.match(/[<>{}[\]]/g) || []).length;
  if (specialCharCount > 50) {
    console.warn(`⚠️  Excessive special characters detected: ${specialCharCount}`);
  }

  return { valid: true, sanitized: trimmed };
}

/**
 * Validate protocol slug to prevent path traversal
 */
function validateProtocolSlug(slug: string | undefined): { valid: boolean; error?: string } {
  if (!slug) {
    return { valid: true }; // Optional field
  }

  if (typeof slug !== 'string') {
    return { valid: false, error: 'protocol_slug must be a string' };
  }

  if (slug.length > INPUT_CONSTRAINTS.MAX_PROTOCOL_SLUG_LENGTH) {
    return { valid: false, error: 'protocol_slug too long' };
  }

  // Only allow alphanumeric, hyphens, and underscores (prevents path traversal)
  if (!/^[a-z0-9_-]+$/i.test(slug)) {
    return {
      valid: false,
      error: 'protocol_slug can only contain letters, numbers, hyphens, and underscores',
    };
  }

  // Prevent path traversal attempts
  if (slug.includes('..') || slug.includes('/') || slug.includes('\\')) {
    return { valid: false, error: 'Invalid protocol_slug format' };
  }

  return { valid: true };
}

/**
 * Validate session ID format
 */
function validateSessionId(sessionId: string): { valid: boolean; error?: string } {
  if (typeof sessionId !== 'string') {
    return { valid: false, error: 'session_id must be a string' };
  }

  if (sessionId.length > INPUT_CONSTRAINTS.MAX_SESSION_ID_LENGTH) {
    return { valid: false, error: 'session_id too long' };
  }

  // UUIDs should be alphanumeric + hyphens
  if (!/^[a-f0-9-]+$/i.test(sessionId)) {
    return { valid: false, error: 'Invalid session_id format' };
  }

  return { valid: true };
}

// Cleanup expired sessions every 10 minutes (for in-memory store)
setInterval(
  async () => {
    await sessionStore.cleanup();
  },
  10 * 60 * 1000
);

// Helper: Get session (async wrapper for SessionStore)
async function getSession(sessionId: string): Promise<Session | null> {
  return await sessionStore.get(sessionId);
}

// Helper: Create new session (async)
async function createSession(protocolSlug?: string): Promise<Session> {
  const loader = new ProtocolLoader();

  // Get protocol path from slug, or default to field_diagnostic
  let protocolPath: string;
  if (protocolSlug) {
    const path = loader.getProtocolPath(protocolSlug);
    if (!path) {
      throw new Error(`Protocol not found: ${protocolSlug}`);
    }
    protocolPath = path;
  } else {
    protocolPath = path.join(__dirname, '../protocols/field_diagnostic.md');
  }

  const parser = new ProtocolParser(protocolPath);
  const protocol = parser.parse();
  const registry = new ProtocolRegistry(protocol);

  const session: Session = {
    id: randomUUID(),
    agent: new FieldDiagnosticAgent(API_KEY!, registry, protocolPath),
    registry,
    parser,
    created_at: new Date().toISOString(),
    last_accessed: new Date().toISOString(),
    total_cost: 0,
  };

  await sessionStore.set(session.id, session);
  console.log(
    `✨ Created new session: ${session.id} (protocol: ${protocolSlug || 'field_diagnostic'})`
  );
  return session;
}

// Helper: Extract supports from protocol content
function extractSupports(
  registry: ProtocolRegistry,
  parser: ProtocolParser,
  state: SessionState
): Support[] {
  const supports: Support[] = [];

  // In WALK mode, provide relevant theme excerpts as supports
  if (state.mode === 'WALK' && state.theme_index) {
    const chunk = registry.retrieve('WALK', state.theme_index);
    if (chunk) {
      const themeContent = parser.parseThemeContent(chunk.content);

      // Add purpose as a support
      supports.push({
        source: 'Field Diagnostic Protocol',
        theme: themeContent.title,
        excerpt: themeContent.purpose,
      });

      // Add "why this matters" as a support
      if (themeContent.why_matters) {
        supports.push({
          source: 'Field Diagnostic Protocol',
          theme: themeContent.title,
          excerpt: themeContent.why_matters,
        });
      }
    }
  }

  // In ENTRY mode, provide protocol-level context
  if (state.mode === 'ENTRY') {
    supports.push({
      source: 'Field Diagnostic Protocol',
      theme: 'Overview',
      excerpt:
        'This protocol helps surface the invisible field shaping your behavior, decisions, and emotional stance.',
    });
  }

  return supports;
}

// Helper: Format agent response for frontend
function formatResponse(
  agentResponse: string,
  state: SessionState,
  sessionId: string,
  session: Session
) {
  // Parse theme number from state
  const themeNumber = state.theme_index || 1;
  const totalThemes = session.registry.getTotalThemes(); // Dynamically get total themes from protocol
  const protocolMetadata = session.registry.getMetadata();
  const protocolName = protocolMetadata.title;

  // Determine mode based on state
  let mode: 'ENTRY' | 'WALK' | 'CONTINUE' | 'COMPLETE';
  if (state.mode === 'ENTRY') {
    mode = 'ENTRY';
  } else if (state.mode === 'CLOSE') {
    mode = 'COMPLETE';
  } else if (state.last_response === 'theme_questions') {
    mode = 'WALK';
  } else {
    mode = 'CONTINUE';
  }

  // Extract supports
  const supports = extractSupports(session.registry, session.parser, state);

  // Check if user has completed all themes and is on final theme
  // Show completion options when on final theme AND showing interpretation (not questions)
  const isFinalTheme = themeNumber === totalThemes;
  const showingInterpretation = state.last_response === 'interpretation_and_completion';
  const showCompletionOptions = isFinalTheme && showingInterpretation;

  return {
    session_id: sessionId,
    protocol_name: protocolName,
    theme_number: themeNumber,
    total_themes: totalThemes,
    mode,
    composer_output: agentResponse,
    supports,
    state: {
      current_mode: state.mode,
      current_theme: state.theme_index,
      last_response_type: state.last_response,
      turn_count: state.turn_counter,
    },
    total_cost: session.total_cost,
    // New fields for completion detection
    is_final_theme: isFinalTheme,
    show_completion_options: showCompletionOptions,
  };
}

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy - Critical for rate limiting behind reverse proxies (Railway, Heroku, etc.)
// Without this, all requests appear to come from the proxy's IP, breaking per-client rate limits
app.set('trust proxy', 1);

// Temporarily disable static middleware to test logo route
const fs = require('fs');
const assetsPath = path.join(__dirname, '../assets');
console.log(`📁 Assets path: ${assetsPath}`);

// Rate Limiting Configuration
// General API rate limiter - more lenient for read operations
const apiLimiter = rateLimit({
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
const aiEndpointLimiter = rateLimit({
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
const sessionCreationLimiter = rateLimit({
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
const metricsLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 requests per minute
  message: {
    error: 'Too many metrics requests. Please slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
// Security Headers - Helmet configuration
app.use(
  helmet({
    // Content Security Policy - prevents XSS attacks
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for frontend
        styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for frontend
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"], // API calls only to same origin
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    // Strict Transport Security - forces HTTPS (disabled in dev)
    hsts:
      process.env.NODE_ENV === 'production'
        ? {
            maxAge: 31536000, // 1 year
            includeSubDomains: true,
            preload: true,
          }
        : false,
    // Hide X-Powered-By header
    hidePoweredBy: true,
    // Prevent clickjacking
    frameguard: { action: 'deny' },
    // Prevent MIME type sniffing
    noSniff: true,
    // XSS Protection (legacy but still useful)
    xssFilter: true,
  })
);

// CORS Configuration - Secure origin validation
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
  : [
      'http://localhost:3000',
      'http://localhost:5173', // Vite dev server
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
    ];

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`🚫 CORS: Blocked request from unauthorized origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' })); // Add request size limit for security

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

// Health check (legacy endpoint)
app.get('/health', async (_req: Request, res: Response) => {
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
app.get('/v1/health', apiLimiter, async (_req: Request, res: Response) => {
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

// Phase 1.1: Verification API Endpoints

// GET /v1/ledger/root - Get current Merkle root
app.get('/v1/ledger/root', apiLimiter, async (_req: Request, res: Response) => {
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
app.get('/v1/receipts/:id', apiLimiter, async (req: Request, res: Response) => {
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
app.get('/v1/keys/jwks', apiLimiter, async (_req: Request, res: Response) => {
  try {
    const jwksManager = await getJWKSManager();
    const jwks = await jwksManager.getJWKS();

    res.json(jwks);
  } catch (error) {
    console.error('Error in /v1/keys/jwks:', error);
    res.status(500).json({
      error: 'Failed to get JWKS',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// POST /v1/receipts/verify - Verify a receipt
app.post('/v1/receipts/verify', apiLimiter, async (req: Request, res: Response) => {
  try {
    const { receipt } = req.body;

    if (!receipt) {
      return res.status(400).json({ error: 'Missing receipt' });
    }

    const ledger = await getLedgerSink();
    const verification = ledger.verifyReceipt(receipt);

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
app.get('/v1/ledger/integrity', apiLimiter, async (req: Request, res: Response) => {
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

// Performance metrics endpoint (rate-limited)
app.get('/api/metrics', metricsLimiter, (_req: Request, res: Response) => {
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

// List available protocols (rate-limited)
app.get('/api/protocols', apiLimiter, (_req: Request, res: Response) => {
  try {
    const loader = new ProtocolLoader();
    const protocols = loader.listProtocols();

    res.json({
      protocols: protocols.map((p) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        version: p.version,
        purpose: p.purpose,
        why: p.why,
        use_when: p.use_when,
        theme_count: p.theme_count,
      })),
    });
  } catch (error) {
    console.error('Error listing protocols:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// Start protocol walk (strictly rate-limited - creates sessions and uses AI)
app.post(
  '/api/walk/start',
  sessionCreationLimiter,
  aiEndpointLimiter,
  async (req: Request, res: Response) => {
    try {
      const { user_input, protocol_slug } = req.body as StartRequest;

      // Validate user_input
      if (!user_input) {
        return res.status(400).json({
          error: 'Missing user_input field',
        });
      }

      const inputValidation = validateUserInput(user_input, 'user_input');
      if (!inputValidation.valid) {
        return res.status(400).json({
          error: inputValidation.error,
        });
      }

      // Validate protocol_slug (optional field)
      const slugValidation = validateProtocolSlug(protocol_slug);
      if (!slugValidation.valid) {
        return res.status(400).json({
          error: slugValidation.error,
        });
      }

      // Create new session with specified protocol
      const session = await createSession(protocol_slug);

      // Process initial message with sanitized input
      const agentResponse = await session.agent.processMessage(inputValidation.sanitized!);
      const state = session.agent.getState();

      // Update session cost
      session.total_cost = session.agent.getTotalCost();

      // Format response
      const response = formatResponse(agentResponse, state, session.id, session);

      res.json(response);
    } catch (error) {
      console.error('Error in /api/walk/start:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

// Continue protocol walk (rate-limited AI endpoint)
app.post('/api/walk/continue', aiEndpointLimiter, async (req: Request, res: Response) => {
  try {
    const { session_id, user_response } = req.body as ContinueRequest;

    // Validate session_id
    if (!session_id) {
      return res.status(400).json({
        error: 'Missing session_id',
      });
    }

    const sessionIdValidation = validateSessionId(session_id);
    if (!sessionIdValidation.valid) {
      return res.status(400).json({
        error: sessionIdValidation.error,
      });
    }

    // Validate user_response
    if (!user_response) {
      return res.status(400).json({
        error: 'Missing user_response',
      });
    }

    const responseValidation = validateUserInput(user_response, 'user_response');
    if (!responseValidation.valid) {
      return res.status(400).json({
        error: responseValidation.error,
      });
    }

    // Get session
    const session = await getSession(session_id);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found or expired',
      });
    }

    // Process message with sanitized input
    const agentResponse = await session.agent.processMessage(responseValidation.sanitized!);
    const state = session.agent.getState();

    // Update session cost
    session.total_cost = session.agent.getTotalCost();

    // Format response
    const response = formatResponse(agentResponse, state, session_id, session);

    // Debug: Log what we're sending to the frontend
    console.log(
      '\n🌐 SENDING TO FRONTEND (last 300 chars of composer_output):',
      response.composer_output.substring(response.composer_output.length - 300)
    );

    res.json(response);
  } catch (error) {
    console.error('Error in /api/walk/continue:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// Complete protocol (rate-limited AI endpoint)
app.post('/api/walk/complete', aiEndpointLimiter, async (req: Request, res: Response) => {
  try {
    const { session_id, generate_summary } = req.body as CompleteRequest;

    // Validate session_id
    if (!session_id) {
      return res.status(400).json({
        error: 'Missing session_id',
      });
    }

    const sessionIdValidation = validateSessionId(session_id);
    if (!sessionIdValidation.valid) {
      return res.status(400).json({
        error: sessionIdValidation.error,
      });
    }

    // Get session
    const session = await getSession(session_id);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found or expired',
      });
    }

    let summaryHtml = '';

    // If generate_summary requested, directly trigger CLOSE mode
    if (generate_summary) {
      console.log('🎯 COMPLETION: Directly forcing CLOSE mode to generate field diagnosis');

      // Get current state and directly set it to CLOSE mode
      const state = session.agent.getState();
      state.mode = 'CLOSE';

      // Trigger field diagnosis by processing with CLOSE mode
      // The agent's processMessage will see mode=CLOSE and generate the diagnosis
      const agentResponse = await session.agent.processMessage('Generate field diagnosis');
      summaryHtml = agentResponse;

      // Update session cost
      session.total_cost = session.agent.getTotalCost();

      // Get updated state for proper response formatting
      const updatedState = session.agent.getState();

      // Return proper completion response with theme info
      const protocolMetadata = session.registry.getMetadata();
      const response = {
        session_id: session_id,
        protocol_name: protocolMetadata.title,
        theme_number: updatedState.theme_index || 5,
        total_themes: session.registry.getTotalThemes(),
        mode: 'COMPLETE' as const,
        composer_output: summaryHtml,
        supports: [],
        state: {
          current_mode: 'CLOSE',
          current_theme: updatedState.theme_index,
          last_response_type: updatedState.last_response,
          turn_count: updatedState.turn_counter,
        },
        total_cost: session.total_cost,
        completed: true,
      };

      // Delete session after sending response
      await sessionStore.delete(session_id);
      console.log(`✅ Completed and deleted session: ${session_id}`);

      return res.json(response);
    }

    // If no summary requested, just complete without generating content
    await sessionStore.delete(session_id);
    console.log(`✅ Completed and deleted session: ${session_id}`);

    res.json({
      completed: true,
    });
  } catch (error) {
    console.error('Error in /api/walk/complete:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// Get session state (debugging, rate-limited)
app.get('/api/session/:id', apiLimiter, async (req: Request, res: Response) => {
  const sessionId = req.params.id;

  // Validate session ID
  const sessionIdValidation = validateSessionId(sessionId);
  if (!sessionIdValidation.valid) {
    return res.status(400).json({
      error: sessionIdValidation.error,
    });
  }

  const session = await getSession(sessionId);

  if (!session) {
    return res.status(404).json({
      error: 'Session not found or expired',
    });
  }

  const state = session.agent.getState();

  res.json({
    session_id: sessionId,
    created_at: session.created_at,
    last_accessed: session.last_accessed,
    state,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║        Field Diagnostic Protocol - API Server                  ║
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
  GET    /api/metrics         - Performance metrics

Phase 1.1 Verification Endpoints:
  GET    /v1/ledger/root      - Get current Merkle root
  GET    /v1/receipts/:id     - Get and verify audit receipt
  POST   /v1/receipts/verify  - Verify a receipt
  GET    /v1/keys/jwks        - Get public keys (JWKS)
  GET    /v1/ledger/integrity - Verify ledger chain integrity

Ready to accept connections.
`);
});
