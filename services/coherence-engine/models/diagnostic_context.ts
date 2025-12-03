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

  // Type assertion after object check
  const c = context as Record<string, unknown>;

  // All fields are optional, but if present must be correct types
  if (c.current_field !== undefined && typeof c.current_field !== 'string') return false;
  if (c.origin_field_residue !== undefined && typeof c.origin_field_residue !== 'string')
    return false;
  if (c.emerging_field !== undefined && typeof c.emerging_field !== 'string') return false;
  if (c.distortion_map !== undefined && !Array.isArray(c.distortion_map)) return false;
  if (c.capacity_edge !== undefined && typeof c.capacity_edge !== 'string') return false;
  if (c.coherence_score !== undefined && typeof c.coherence_score !== 'number') return false;
  if (c.field_drift_direction !== undefined && typeof c.field_drift_direction !== 'string')
    return false;

  return true;
}
