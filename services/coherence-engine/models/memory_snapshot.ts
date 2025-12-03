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
export function isValidMemorySnapshot(snapshot: any): snapshot is MemorySnapshot {
  if (!snapshot || typeof snapshot !== 'object') return false;

  // All fields are optional arrays or numbers
  if (snapshot.recent_drift_events !== undefined && !Array.isArray(snapshot.recent_drift_events))
    return false;
  if (
    snapshot.recent_distortion_events !== undefined &&
    !Array.isArray(snapshot.recent_distortion_events)
  )
    return false;
  if (
    snapshot.recent_pre_collapse_events !== undefined &&
    !Array.isArray(snapshot.recent_pre_collapse_events)
  )
    return false;
  if (
    snapshot.stability_restoration_durations !== undefined &&
    !Array.isArray(snapshot.stability_restoration_durations)
  )
    return false;
  if (snapshot.collapse_precursors !== undefined && !Array.isArray(snapshot.collapse_precursors))
    return false;
  if (
    snapshot.protocol_usage_history !== undefined &&
    !Array.isArray(snapshot.protocol_usage_history)
  )
    return false;
  if (
    snapshot.founder_drift_signature !== undefined &&
    !Array.isArray(snapshot.founder_drift_signature)
  )
    return false;
  if (
    snapshot.stability_duration_hours !== undefined &&
    typeof snapshot.stability_duration_hours !== 'number'
  )
    return false;

  return true;
}
