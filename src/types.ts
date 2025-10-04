// Shared types for the Field Diagnostic Agent

export type Mode = 'ENTRY' | 'WALK' | 'CLOSE';

export type Intent = 'discover' | 'walk' | 'memory' | 'none';

export type ResumeHint = 'awaiting_theme_completion' | 'ready_to_advance' | 'none';

export interface SessionState {
  active_protocol: string | null;
  mode: Mode;
  theme_index: number | null;
  awaiting_confirmation: boolean; // Track if waiting for user to move to next theme after completion prompt
  last_completion_confirmed: boolean;
  resume_hint: ResumeHint;
  last_answer_summary: string;
  last_chunk_refs: string[];
  turn_counter: number;
  emotion_last?: string;
  field_diagnosed?: string;
  updated_at: string;
}

export interface ClassificationResult {
  intent: Intent;
  continuity: boolean;
  protocol_pointer: {
    protocol_slug: string;
    theme_index: number | null;
  };
  confidence: number;
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
