import express, { Request, Response } from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import { FieldDiagnosticAgent } from './agent';
import { ProtocolRegistry } from './tools/registry';
import { ProtocolParser } from './protocol/parser';
import { ProtocolLoader } from './protocol/loader';
import { SessionState } from './types';
import { Session, SessionStore, createSessionStore } from './session-store';
import { performanceMonitor, CacheStats } from './performance';
import * as path from 'path';

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
  } catch (error) {
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

// Cleanup expired sessions every 10 minutes (for in-memory store)
setInterval(async () => {
  await sessionStore.cleanup();
}, 10 * 60 * 1000);

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
  console.log(`✨ Created new session: ${session.id} (protocol: ${protocolSlug || 'field_diagnostic'})`);
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
      excerpt: 'This protocol helps surface the invisible field shaping your behavior, decisions, and emotional stance.',
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

// Temporarily disable static middleware to test logo route
const fs = require('fs');
const assetsPath = path.join(__dirname, '../assets');
console.log(`📁 Assets path: ${assetsPath}`);

// Middleware
// CORS configuration - allow all origins since we're serving frontend from same domain
const corsOptions = {
  origin: '*', // Allow all origins since frontend is served from same Railway domain
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

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
    res.status(404).send('Frontend not found. Please ensure index.html exists in the project root.');
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
    res.status(404).send('Test interface not found. Please ensure test-frontend.html exists in the project root.');
  }
});

// Health check
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

// Performance metrics endpoint
app.get('/api/metrics', (_req: Request, res: Response) => {
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

// List available protocols
app.get('/api/protocols', (_req: Request, res: Response) => {
  try {
    const loader = new ProtocolLoader();
    const protocols = loader.listProtocols();

    res.json({
      protocols: protocols.map(p => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        version: p.version,
        purpose: p.purpose,
        why: p.why,
        use_when: p.use_when,
        theme_count: p.theme_count,
      }))
    });
  } catch (error) {
    console.error('Error listing protocols:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// Start protocol walk
app.post('/api/walk/start', async (req: Request, res: Response) => {
  try {
    const { user_input, protocol_slug } = req.body as StartRequest;

    if (!user_input || typeof user_input !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid user_input field',
      });
    }

    // Create new session with specified protocol
    const session = await createSession(protocol_slug);

    // Process initial message
    const agentResponse = await session.agent.processMessage(user_input);
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
});

// Continue protocol walk
app.post('/api/walk/continue', async (req: Request, res: Response) => {
  try {
    const { session_id, user_response } = req.body as ContinueRequest;

    if (!session_id || !user_response) {
      return res.status(400).json({
        error: 'Missing session_id or user_response',
      });
    }

    // Get session
    const session = await getSession(session_id);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found or expired',
      });
    }

    // Process message
    const agentResponse = await session.agent.processMessage(user_response);
    const state = session.agent.getState();

    // Update session cost
    session.total_cost = session.agent.getTotalCost();

    // Format response
    const response = formatResponse(agentResponse, state, session_id, session);

    // Debug: Log what we're sending to the frontend
    console.log('\n🌐 SENDING TO FRONTEND (last 300 chars of composer_output):', response.composer_output.substring(response.composer_output.length - 300));

    res.json(response);
  } catch (error) {
    console.error('Error in /api/walk/continue:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// Complete protocol
app.post('/api/walk/complete', async (req: Request, res: Response) => {
  try {
    const { session_id, generate_summary } = req.body as CompleteRequest;

    if (!session_id) {
      return res.status(400).json({
        error: 'Missing session_id',
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

// Get session state (debugging)
app.get('/api/session/:id', async (req: Request, res: Response) => {
  const sessionId = req.params.id;
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

Endpoints:
  GET    /api/protocols       - List available protocols
  POST   /api/walk/start      - Start new protocol walk
  POST   /api/walk/continue   - Continue protocol walk
  POST   /api/walk/complete   - Complete protocol
  GET    /api/session/:id     - Get session state (debug)
  GET    /health              - Health check

Ready to accept connections.
`);
});
