/**
 * EXAMPLE USAGE
 * Demonstrates how to use the Coherence Engine API
 * Run with: tsx example.ts
 */

import { FounderStateInput } from './models/founder_state';
import { DiagnosticContext } from './models/diagnostic_context';
import { classifyIntegrityState } from './classification/integrity_classifier';
import { routeToProtocol } from './protocol_router';
import { buildCoherencePacket } from './outputs/output_builder';
import { validateOutput } from './outputs/self_correction';

console.log('═══════════════════════════════════════════════════════');
console.log('  LICHEN COHERENCE ENGINE — EXAMPLE USAGE');
console.log('═══════════════════════════════════════════════════════\n');

// Example 1: Urgency Spike (DRIFT)
console.log('Example 1: Urgency Spike\n');
const urgencyState: FounderStateInput = {
  physiological: 'tight',
  rhythm: 'urgent',
  emotional: 'constricted',
  cognitive: 'looping',
  tension_keyword: 'deadline',
  conflict_indicator: 'pressure'
};

const urgencyContext: DiagnosticContext = {
  current_field: 'launch_pressure',
  coherence_score: 0.4
};

let classification = classifyIntegrityState(urgencyState, urgencyContext);
let route = routeToProtocol(classification);
let packet = buildCoherencePacket(urgencyState, classification, route);
let violations = validateOutput(packet);

console.log('Input:', JSON.stringify(urgencyState, null, 2));
console.log('\nOutput:');
console.log('  Integrity State:', packet.integrity_state);
console.log('  State Reflection:', packet.state_reflection);
console.log('  Protocol Route:', packet.protocol_route);
console.log('  Stabilisation Cue:', packet.stabilisation_cue);
console.log('  Exit Precursor:', packet.exit_precursor);
console.log('  Drift Violations:', violations.length === 0 ? 'None (Clean)' : violations);
console.log('\n' + '─'.repeat(60) + '\n');

// Example 2: Numbness/Shutdown (PRE_COLLAPSE)
console.log('Example 2: Numbness/Shutdown\n');
const collapseState: FounderStateInput = {
  physiological: 'numb',
  rhythm: 'fragmented',
  emotional: 'fog',
  cognitive: 'overwhelmed',
  tension_keyword: 'nothing',
  conflict_indicator: 'avoidance'
};

classification = classifyIntegrityState(collapseState);
route = routeToProtocol(classification);
packet = buildCoherencePacket(collapseState, classification, route);
violations = validateOutput(packet);

console.log('Input:', JSON.stringify(collapseState, null, 2));
console.log('\nOutput:');
console.log('  Integrity State:', packet.integrity_state);
console.log('  State Reflection:', packet.state_reflection);
console.log('  Protocol Route:', packet.protocol_route);
console.log('  Stabilisation Cue:', packet.stabilisation_cue);
console.log('  Exit Precursor:', packet.exit_precursor);
console.log('  Drift Violations:', violations.length === 0 ? 'None (Clean)' : violations);
console.log('\n' + '─'.repeat(60) + '\n');

// Example 3: Shame Spike (DISTORTION)
console.log('Example 3: Shame Spike\n');
const shameState: FounderStateInput = {
  physiological: 'tight',
  rhythm: 'oscillating',
  emotional: 'constricted',
  cognitive: 'looping',
  tension_keyword: 'failure',
  conflict_indicator: 'tension'
};

classification = classifyIntegrityState(shameState);
route = routeToProtocol(classification);
packet = buildCoherencePacket(shameState, classification, route);
violations = validateOutput(packet);

console.log('Input:', JSON.stringify(shameState, null, 2));
console.log('\nOutput:');
console.log('  Integrity State:', packet.integrity_state);
console.log('  State Reflection:', packet.state_reflection);
console.log('  Protocol Route:', packet.protocol_route);
console.log('  Stabilisation Cue:', packet.stabilisation_cue);
console.log('  Exit Precursor:', packet.exit_precursor);
console.log('  Drift Violations:', violations.length === 0 ? 'None (Clean)' : violations);
console.log('\n' + '─'.repeat(60) + '\n');

// Example 4: Calm and Coherent (STABLE)
console.log('Example 4: Calm and Coherent\n');
const stableState: FounderStateInput = {
  physiological: 'open',
  rhythm: 'steady',
  emotional: 'open',
  cognitive: 'clear',
  tension_keyword: 'calm',
  conflict_indicator: 'none'
};

classification = classifyIntegrityState(stableState);
route = routeToProtocol(classification);
packet = buildCoherencePacket(stableState, classification, route);
violations = validateOutput(packet);

console.log('Input:', JSON.stringify(stableState, null, 2));
console.log('\nOutput:');
console.log('  Integrity State:', packet.integrity_state);
console.log('  State Reflection:', packet.state_reflection);
console.log('  Protocol Route:', packet.protocol_route);
console.log('  Stabilisation Cue:', packet.stabilisation_cue);
console.log('  Exit Precursor:', packet.exit_precursor);
console.log('  Drift Violations:', violations.length === 0 ? 'None (Clean)' : violations);
console.log('\n' + '═'.repeat(60));
console.log('All examples completed successfully!');
console.log('═'.repeat(60));

