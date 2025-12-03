export type PhysiologicalState = 'open' | 'tight' | 'numb' | 'agitated' | 'steady';
export type Rhythm = 'steady' | 'fragmented' | 'urgent' | 'oscillating';
export type EmotionalState = 'open' | 'constricted' | 'fog' | 'collapse';
export type CognitiveState = 'clear' | 'looping' | 'overwhelmed';
export type ConflictIndicator = 'none' | 'avoidance' | 'tension' | 'pressure';
export type IntegrityState = 'STABLE' | 'DRIFT' | 'DISTORTION' | 'PRE_COLLAPSE';

export interface FounderStateInput {
  physiological: PhysiologicalState;
  rhythm: Rhythm;
  emotional: EmotionalState;
  cognitive: CognitiveState;
  tension_keyword: string;
  conflict_indicator: ConflictIndicator;
  founder_ready_signal?: boolean;
}

export interface CoherencePacket {
  integrity_state: IntegrityState;
  state_reflection: string;
  protocol_route: string | null;
  stabilisation_cue: string | null;
  exit_precursor: boolean;
  upward: null;
}

export interface DriftViolation {
  type: string;
  pattern: string;
  detected_in: string;
}

export interface DriftCheckResult {
  clean: boolean;
  violations: DriftViolation[];
  text: string;
}

export interface DiagnosticContext {
  current_field?: string;
  origin_field_residue?: string;
  emerging_field?: string;
  distortion_map?: string[];
  capacity_edge?: string;
  coherence_score?: number;
  field_drift_direction?: string;
}
