/**
 * Protocol and Session Routes
 *
 * Provides protocol discovery and session management endpoints:
 * - GET /api/protocols - List available protocols
 * - POST /api/walk/start - Start new protocol session
 * - POST /api/walk/continue - Continue existing session
 * - POST /api/walk/complete - Complete and optionally generate summary
 * - GET /api/session/:id - Get session state
 */

import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import path from 'path';
import { ProtocolLoader } from '../../protocol/loader';
import { ProtocolParser } from '../../protocol/parser';
import { ProtocolRegistry } from '../../tools/registry';
import { FieldDiagnosticAgent } from '../../agent';
import { SessionStore, Session } from '../../session-store';
import { validateUserInput, validateProtocolSlug, validateSessionId } from '../validation';
import { validateApiKey } from '../middleware';
import type { SessionState } from '../../types';

/**
 * Support type for protocol content
 */
interface Support {
  source: string;
  theme: string;
  excerpt: string;
}

/**
 * Request/Response types for protocol endpoints
 */
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

/**
 * Helper: Get session (async wrapper for SessionStore)
 */
async function getSession(
  sessionStore: SessionStore,
  sessionId: string
): Promise<Session | null> {
  return await sessionStore.get(sessionId);
}

/**
 * Helper: Create new session (async)
 */
async function createSession(
  apiKey: string,
  sessionStore: SessionStore,
  protocolSlug?: string
): Promise<Session> {
  const loader = new ProtocolLoader();

  // Get protocol path from slug, or default to field_diagnostic
  let protocolPath: string;
  if (protocolSlug) {
    const pathResult = loader.getProtocolPath(protocolSlug);
    if (!pathResult) {
      throw new Error(`Protocol not found: ${protocolSlug}`);
    }
    protocolPath = pathResult;
  } else {
    protocolPath = path.join(__dirname, '../../protocols/field_diagnostic.md');
  }

  const parser = new ProtocolParser(protocolPath);
  const protocol = parser.parse();
  const registry = new ProtocolRegistry(protocol);

  const session: Session = {
    id: randomUUID(),
    agent: new FieldDiagnosticAgent(apiKey, registry, protocolPath),
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

/**
 * Helper: Extract supports from protocol content
 */
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

/**
 * Helper: Format agent response for frontend
 */
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

/**
 * Create protocol router
 *
 * @param apiKey - Anthropic API key for creating sessions
 * @param sessionStore - Session store instance
 * @param apiLimiter - Rate limiter for API endpoints
 * @param aiEndpointLimiter - Rate limiter for AI endpoints
 * @param sessionCreationLimiter - Rate limiter for session creation
 * @returns Express router with protocol endpoints
 */
export function createProtocolRouter(
  apiKey: string | undefined,
  sessionStore: SessionStore,
  apiLimiter: any,
  aiEndpointLimiter: any,
  sessionCreationLimiter: any
): Router {
  const router = Router();

  // GET /api/protocols - List available protocols (rate-limited)
  router.get('/api/protocols', apiLimiter, (_req: Request, res: Response) => {
    try {
      const loader = new ProtocolLoader();
      const protocols = loader.listProtocols();

      res.json({
        protocols: protocols.map((p: any) => ({
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

  // POST /api/walk/start - Start protocol walk (strictly rate-limited - creates sessions and uses AI)
  router.post(
    '/api/walk/start',
    validateApiKey,
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

        // Require API key for session creation
        if (!apiKey) {
          return res.status(500).json({
            error: 'Server misconfiguration',
            message: 'ANTHROPIC_API_KEY not configured',
          });
        }

        // Create new session with specified protocol
        const session = await createSession(apiKey, sessionStore, protocol_slug);

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
        console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
        console.error('Protocol slug:', req.body.protocol_slug);
        console.error('User input:', req.body.user_input);
        res.status(500).json({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : String(error),
          stack:
            process.env.NODE_ENV === 'development'
              ? error instanceof Error
                ? error.stack
                : undefined
              : undefined,
        });
      }
    }
  );

  // POST /api/walk/continue - Continue protocol walk (rate-limited AI endpoint)
  router.post(
    '/api/walk/continue',
    validateApiKey,
    aiEndpointLimiter,
    async (req: Request, res: Response) => {
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
        const session = await getSession(sessionStore, session_id);
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
    }
  );

  // POST /api/walk/complete - Complete protocol (rate-limited AI endpoint)
  router.post(
    '/api/walk/complete',
    validateApiKey,
    aiEndpointLimiter,
    async (req: Request, res: Response) => {
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
        const session = await getSession(sessionStore, session_id);
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
    }
  );

  // GET /api/session/:id - Get session state (debugging, rate-limited)
  router.get('/api/session/:id', apiLimiter, async (req: Request, res: Response) => {
    const sessionId = req.params.id;

    // Validate session ID
    const sessionIdValidation = validateSessionId(sessionId);
    if (!sessionIdValidation.valid) {
      return res.status(400).json({
        error: sessionIdValidation.error,
      });
    }

    const session = await getSession(sessionStore, sessionId);

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

  return router;
}
