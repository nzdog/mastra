import express, { Request, Response } from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import { FieldDiagnosticAgent } from './agent';
import { ProtocolRegistry } from './tools/registry';
import { ProtocolParser } from './protocol/parser';
import { SessionState } from './types';
import * as path from 'path';

// Load environment variables
dotenv.config();

const API_KEY = process.env.ANTHROPIC_API_KEY;

if (!API_KEY) {
  console.error('Error: ANTHROPIC_API_KEY not found in environment variables.');
  process.exit(1);
}

// Types for API
interface Session {
  id: string;
  agent: FieldDiagnosticAgent;
  registry: ProtocolRegistry;
  parser: ProtocolParser;
  created_at: string;
  last_accessed: string;
  total_cost: number;
}

interface Support {
  source: string;
  theme: string;
  excerpt: string;
}

interface StartRequest {
  user_input: string;
}

interface ContinueRequest {
  session_id: string;
  user_response: string;
}

interface CompleteRequest {
  session_id: string;
  generate_summary?: boolean;
}

// In-memory session storage (ephemeral, perfect for protocol walks)
const sessions = new Map<string, Session>();
const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour

// Cleanup expired sessions every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    const lastAccessed = new Date(session.last_accessed).getTime();
    if (now - lastAccessed > SESSION_TTL_MS) {
      sessions.delete(sessionId);
      console.log(`🗑️  Cleaned up expired session: ${sessionId}`);
    }
  }
}, 10 * 60 * 1000);

// Helper: Get or create session
function getSession(sessionId: string): Session | null {
  const session = sessions.get(sessionId);
  if (!session) {
    return null;
  }

  // Update last accessed
  session.last_accessed = new Date().toISOString();
  return session;
}

// Helper: Create new session
function createSession(): Session {
  const protocolPath = path.join(__dirname, '../protocols/field_diagnostic.md');
  const parser = new ProtocolParser(protocolPath);
  const protocol = parser.parse();
  const registry = new ProtocolRegistry(protocol);

  const session: Session = {
    id: randomUUID(),
    agent: new FieldDiagnosticAgent(API_KEY!),
    registry,
    parser,
    created_at: new Date().toISOString(),
    last_accessed: new Date().toISOString(),
    total_cost: 0,
  };

  sessions.set(session.id, session);
  console.log(`✨ Created new session: ${session.id}`);
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
  const isFinalTheme = themeNumber === totalThemes;
  const hasCompletedAllThemes = agentResponse.includes('You\'ve completed all') && 
                                agentResponse.includes('themes of the Field Diagnostic Protocol');

  return {
    session_id: sessionId,
    protocol_name: 'Field Diagnostic Protocol',
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
    show_completion_options: isFinalTheme && hasCompletedAllThemes,
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
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    active_sessions: sessions.size,
    timestamp: new Date().toISOString(),
  });
});

// Start protocol walk
app.post('/api/walk/start', async (req: Request, res: Response) => {
  try {
    const { user_input } = req.body as StartRequest;

    if (!user_input || typeof user_input !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid user_input field',
      });
    }

    // Create new session
    const session = createSession();

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
    const session = getSession(session_id);
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
    const session = getSession(session_id);
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
      const response = {
        session_id: session_id,
        protocol_name: 'Field Diagnostic Protocol',
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
      sessions.delete(session_id);
      console.log(`✅ Completed and deleted session: ${session_id}`);

      return res.json(response);
    }

    // If no summary requested, just complete without generating content
    sessions.delete(session_id);
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
app.get('/api/session/:id', (req: Request, res: Response) => {
  const sessionId = req.params.id;
  const session = getSession(sessionId);

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
  POST   /api/walk/start      - Start new protocol walk
  POST   /api/walk/continue   - Continue protocol walk
  POST   /api/walk/complete   - Complete protocol
  GET    /api/session/:id     - Get session state (debug)
  GET    /health              - Health check

Ready to accept connections.
`);
});
