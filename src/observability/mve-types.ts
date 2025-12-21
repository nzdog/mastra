/**
 * MVE (Minimum Viable Experiment) - Week 1 Observability
 * Part of: Dual-Observation Experiment for Memory Architecture
 * Plan: ~/.claude/plans/parsed-swimming-avalanche.md
 * Safe to remove after: Memory layer implementation complete
 */

/**
 * Core fields present in every observation event
 */
interface ObservationEventCore {
  timestamp: string; // ISO 8601
  session_id: string; // UUID
  event_type: 'classification' | 'mode_decision' | 'theme_answer';
}

/**
 * Classification event - logs agent's classification of user input
 */
interface ClassificationEvent extends ObservationEventCore {
  event_type: 'classification';
  classification_label: 'discover' | 'walk' | 'memory' | 'none';
  confidence: number; // 0-1
}

/**
 * Mode decision event - logs agent's mode transition
 */
interface ModeDecisionEvent extends ObservationEventCore {
  event_type: 'mode_decision';
  mode: 'ENTRY' | 'WALK' | 'CLOSE';
}

/**
 * Theme answer event - logs user's response to a theme question
 */
interface ThemeAnswerEvent extends ObservationEventCore {
  event_type: 'theme_answer';
  theme_index: number; // 1-6
  raw_text: string; // Full user response
  spotlight_flags: string[]; // ["should", "rushing", etc.]
}

/**
 * Union type of all possible observation events
 */
export type ObservationEvent = ClassificationEvent | ModeDecisionEvent | ThemeAnswerEvent;

/**
 * Observer interface - implementers write events to storage
 */
export interface Observer {
  /**
   * Record an observation event
   */
  observe(event: ObservationEvent): Promise<void>;

  /**
   * Check if observer is enabled
   */
  isEnabled(): boolean;

  /**
   * Flush any buffered events (called on shutdown)
   */
  flush(): Promise<void>;
}
