/**
 * Core type definitions for the Field Diagnostic Agent
 *
 * This module defines the fundamental types used throughout the agent,
 * including session state, intent classification, and protocol structure.
 */

/**
 * Agent conversation mode
 * - ENTRY: Introduction and protocol overview
 * - WALK: Guided theme-by-theme dialogue
 * - CLOSE: Completion and summary
 */
export type Mode = 'ENTRY' | 'WALK' | 'CLOSE';

/**
 * User intent classification
 * - discover: User wants to explore/start new themes
 * - walk: User wants guided progression through protocol
 * - memory: User is continuing with current theme
 * - none: Just chatting, no clear protocol intent
 */
export type Intent = 'discover' | 'walk' | 'memory' | 'none';

/**
 * Hint for resuming conversation
 * - awaiting_theme_completion: User hasn't finished current theme
 * - ready_to_advance: User completed current theme, can move forward
 * - none: No specific resume state
 */
export type ResumeHint = 'awaiting_theme_completion' | 'ready_to_advance' | 'none';

/**
 * Type of last response sent to user
 * - theme_questions: Sent theme questions for user to answer
 * - interpretation_and_completion: Sent interpretation and theme wrap-up
 * - none: No specific response type
 */
export type LastResponse = 'theme_questions' | 'interpretation_and_completion' | 'none';

/**
 * Session state tracking conversation progress
 *
 * Maintains all state needed to continue a conversation across messages,
 * including current position in protocol, user progress, and conversation depth.
 */
export interface SessionState {
  session_id: string; // MVE: Session identifier for event logging
  active_protocol: string | null;
  mode: Mode;
  theme_index: number | null;
  last_response: LastResponse; // Track what we just showed the user
  is_revisiting: boolean; // Track if user explicitly went back to a previous theme
  conversation_depth: number; // Track turns within current theme
  has_answered_theme: boolean; // User has provided initial answer to theme questions
  resume_hint: ResumeHint;
  last_answer_summary: string;
  last_chunk_refs: string[];
  turn_counter: number;
  emotion_last?: string;
  field_diagnosed?: string;
  updated_at: string;
}

/**
 * User navigation and interaction desires
 *
 * Captures what the user wants to do next based on AI semantic understanding.
 */
export interface UserIntent {
  /** User wants to move to the next theme */
  advance_to_next_theme: boolean;
  /** User wants more explanation/detail about current theme */
  request_elaboration: boolean;
  /** User wants to add more reflection/thoughts */
  add_more_reflection: boolean;
  /** User wants to navigate to a specific theme number (or null) */
  navigate_to_theme: number | null;
}

/**
 * Result of intent classification
 *
 * Contains the classified intent, continuity status, protocol position,
 * and user navigation desires from analyzing a user message.
 *
 * @example
 * ```typescript
 * {
 *   intent: 'memory',
 *   continuity: true,
 *   protocol_pointer: { protocol_slug: 'field_diagnostic', theme_index: 1 },
 *   confidence: 0.95,
 *   user_wants_to: {
 *     advance_to_next_theme: false,
 *     request_elaboration: false,
 *     add_more_reflection: true,
 *     navigate_to_theme: null
 *   }
 * }
 * ```
 */
export interface ClassificationResult {
  /** Classified user intent */
  intent: Intent;
  /** Whether user is naturally continuing the conversation */
  continuity: boolean;
  /** Current protocol and theme position */
  protocol_pointer: {
    protocol_slug: string;
    theme_index: number | null;
  };
  /** Confidence score (0-1) in the classification */
  confidence: number;
  /** (Legacy) When user requests to navigate to a specific theme */
  requested_theme?: number;
  /** AI-driven semantic intent understanding */
  user_wants_to: UserIntent;
}

/**
 * Single turn in conversation history
 *
 * Represents one message exchange between user and assistant.
 */
export interface ConversationTurn {
  /** Who sent this message */
  role: 'user' | 'assistant';
  /** Message content */
  content: string;
}

/**
 * Protocol content chunk
 *
 * Represents a discrete piece of protocol content (intro or theme).
 */
export interface ProtocolChunk {
  /** Unique identifier for this chunk */
  id: string;
  /** Type of chunk (introduction or theme walkthrough) */
  type: 'ENTRY' | 'WALK';
  /** The actual content/text of this chunk */
  content: string;
  /** Theme number (0-based) for WALK chunks */
  theme_index?: number;
}
