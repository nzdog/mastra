/**
 * DIAGNOSTIC CONTEXT MODEL
 * Field diagnostic inputs from the Field Diagnostic Engine
 * As per SPEC.md Section 1.2
 */

export interface DiagnosticContext {
  current_field?: string;
  origin_field_residue?: string;
  emerging_field?: string;
  distortion_map?: string[];
  capacity_edge?: string;
  coherence_score?: number;
  field_drift_direction?: string;
}

/**
 * Validation helper
 */
export function isValidDiagnosticContext(context: unknown): context is DiagnosticContext {
  if (!context || typeof context !== 'object') return false;

  // All fields are optional, but if present must be correct types
  if (context.current_field !== undefined && typeof context.current_field !== 'string')
    return false;
  if (
    context.origin_field_residue !== undefined &&
    typeof context.origin_field_residue !== 'string'
  )
    return false;
  if (context.emerging_field !== undefined && typeof context.emerging_field !== 'string')
    return false;
  if (context.distortion_map !== undefined && !Array.isArray(context.distortion_map)) return false;
  if (context.capacity_edge !== undefined && typeof context.capacity_edge !== 'string')
    return false;
  if (context.coherence_score !== undefined && typeof context.coherence_score !== 'number')
    return false;
  if (
    context.field_drift_direction !== undefined &&
    typeof context.field_drift_direction !== 'string'
  )
    return false;

  return true;
}
