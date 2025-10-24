// Shared types for the Field Diagnostic Agent

export type Mode = 'ENTRY' | 'WALK' | 'CLOSE';

export type Intent = 'discover' | 'walk' | 'memory' | 'none';

export type ResumeHint = 'awaiting_theme_completion' | 'ready_to_advance' | 'none';

export type LastResponse = 'theme_questions' | 'interpretation_and_completion' | 'none';

export interface SessionState {
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

export interface UserIntent {
  advance_to_next_theme: boolean;
  request_elaboration: boolean;
  add_more_reflection: boolean;
  navigate_to_theme: number | null;
}

export interface ClassificationResult {
  intent: Intent;
  continuity: boolean;
  protocol_pointer: {
    protocol_slug: string;
    theme_index: number | null;
  };
  confidence: number;
  requested_theme?: number; // When user requests to navigate to a specific theme (legacy, will use user_wants_to)
  user_wants_to: UserIntent; // AI-driven semantic intent understanding
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ProtocolChunk {
  id: string;
  type: 'ENTRY' | 'WALK';
  content: string;
  theme_index?: number;
}

export interface ProtocolHistory {
  protocol_id: string;
  protocol_name: string;
  completed_at: string;
  diagnosed_field?: string;
  summary_text?: string;
}
