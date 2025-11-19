/**
 * DRIFT GUARD
 * Detects forbidden language patterns in outputs
 * As per SPEC.md Section 9.1
 *
 * CRITICAL: These patterns MUST be caught before outputs reach founders
 */

export interface DriftViolation {
  type: string;
  pattern: string;
  detected_in: string;
}

/**
 * Forbidden patterns organized by category
 */
const FORBIDDEN_PATTERNS = {
  // Future references
  future_reference: [
    /\byou will\b/i,
    /\byou'll\b/i,
    /\bnext you\b/i,
    /\bafter this\b/i,
    /\bafter that\b/i,
    /\bsoon\b/i,
    /\blater\b/i,
    /\bwhen you're ready\b/i,
    /\bonce you\b/i,
    /\bthen you\b/i,
    /\bthis will\b/i,
    /\bin the future\b/i,
    /\beventually\b/i,
    /\bcoming up\b/i,
  ],

  // Advisory verbs
  advisory: [
    /\byou should\b/i,
    /\byou need to\b/i,
    /\byou must\b/i,
    /\byou have to\b/i,
    /\btry to\b/i,
    /\btry and\b/i,
    /\bconsider\b/i,
    /\bI recommend\b/i,
    /\bI suggest\b/i,
    /\byou might want to\b/i,
    /\byou could\b/i,
    /\bit would be good\b/i,
    /\byou ought to\b/i,
  ],

  // Motivational language
  motivational: [
    /\byou can do it\b/i,
    /\byou've got this\b/i,
    /\bkeep going\b/i,
    /\bstay strong\b/i,
    /\bbelieve in yourself\b/i,
    /\byou're capable\b/i,
    /\byou're strong\b/i,
    /\bhang in there\b/i,
    /\bdon't give up\b/i,
    /\bpush through\b/i,
    /\byou're doing great\b/i,
    /\bproud of you\b/i,
  ],

  // Emotional validation
  emotional_validation: [
    /\bit's okay\b/i,
    /\bit's ok\b/i,
    /\bthat's okay\b/i,
    /\bthat's normal\b/i,
    /\bthat's understandable\b/i,
    /\bdon't worry\b/i,
    /\bno need to worry\b/i,
    /\byou're safe\b/i,
    /\bit'll be okay\b/i,
    /\beverything will be\b/i,
    /\byou're not alone\b/i,
  ],

  // Therapeutic language
  therapeutic: [
    /\bhow does that make you feel\b/i,
    /\bwhat comes up for you\b/i,
    /\blet's explore\b/i,
    /\btell me more about\b/i,
    /\bhow are you feeling\b/i,
    /\bwhat do you think\b/i,
    /\bwhat are your thoughts\b/i,
    /\bprocess this\b/i,
    /\bwork through\b/i,
  ],

  // Strategy and planning
  strategy: [
    /\bplan for\b/i,
    /\bstrategy\b/i,
    /\bgoal\b/i,
    /\bobjective\b/i,
    /\btarget\b/i,
    /\bsteps? to\b/i,
    /\baction plan\b/i,
    /\bmove forward\b/i,
    /\bpath forward\b/i,
  ],

  // Reassurance
  reassurance: [
    /\byou're doing well\b/i,
    /\byou're on the right track\b/i,
    /\bgood job\b/i,
    /\bwell done\b/i,
    /\bthat's great\b/i,
    /\bperfect\b/i,
    /\bexcellent\b/i,
  ],
};

/**
 * Check text for drift violations
 */
export function checkForDrift(text: string): DriftViolation[] {
  const violations: DriftViolation[] = [];

  for (const [type, patterns] of Object.entries(FORBIDDEN_PATTERNS)) {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        violations.push({
          type,
          pattern: pattern.source,
          detected_in: match[0],
        });
      }
    }
  }

  return violations;
}

/**
 * Check if text is clean (no violations)
 */
export function isCleanOutput(text: string): boolean {
  return checkForDrift(text).length === 0;
}

/**
 * Check multiple text fields
 */
export function checkOutputFields(
  fields: Record<string, string | null | undefined>
): DriftViolation[] {
  const allViolations: DriftViolation[] = [];

  for (const [fieldName, value] of Object.entries(fields)) {
    if (value && typeof value === 'string') {
      const violations = checkForDrift(value);
      allViolations.push(
        ...violations.map((v) => ({
          ...v,
          detected_in: `${fieldName}: ${v.detected_in}`,
        }))
      );
    }
  }

  return allViolations;
}

/**
 * Validate entire output packet for drift
 */
export function validateOutputPacket(packet: any): {
  clean: boolean;
  violations: DriftViolation[];
} {
  const fields = {
    state_reflection: packet.state_reflection,
    stabilisation_cue: packet.stabilisation_cue,
    protocol_route: packet.protocol_route,
  };

  const violations = checkOutputFields(fields);

  return {
    clean: violations.length === 0,
    violations,
  };
}
