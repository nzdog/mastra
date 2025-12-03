/**
 * MEMORY SNAPSHOT MODEL
 * Event-only, non-predictive memory context
 * As per SPEC.md Section 1.3 and Section 7
 *
 * CRITICAL: Memory is read-only, event-based, and non-temporal
 * Memory CANNOT influence classification
 */

export interface MemorySnapshot {
  recent_drift_events?: string[];
  recent_distortion_events?: string[];
  recent_pre_collapse_events?: string[];
  stability_restoration_durations?: number[];
  collapse_precursors?: string[];
  protocol_usage_history?: string[];
  founder_drift_signature?: string[]; // Exact-match map, NOT predictive
  stability_duration_hours?: number;
}

/**
 * Validation helper
 */
export function isValidMemorySnapshot(snapshot: unknown): snapshot is MemorySnapshot {
  if (!snapshot || typeof snapshot !== 'object') return false;

  // Type assertion after object check
  const s = snapshot as Record<string, unknown>;

  // All fields are optional arrays or numbers
  if (s.recent_drift_events !== undefined && !Array.isArray(s.recent_drift_events)) return false;
  if (s.recent_distortion_events !== undefined && !Array.isArray(s.recent_distortion_events))
    return false;
  if (s.recent_pre_collapse_events !== undefined && !Array.isArray(s.recent_pre_collapse_events))
    return false;
  if (
    s.stability_restoration_durations !== undefined &&
    !Array.isArray(s.stability_restoration_durations)
  )
    return false;
  if (s.collapse_precursors !== undefined && !Array.isArray(s.collapse_precursors)) return false;
  if (s.protocol_usage_history !== undefined && !Array.isArray(s.protocol_usage_history))
    return false;
  if (s.founder_drift_signature !== undefined && !Array.isArray(s.founder_drift_signature))
    return false;
  if (s.stability_duration_hours !== undefined && typeof s.stability_duration_hours !== 'number')
    return false;

  return true;
}
