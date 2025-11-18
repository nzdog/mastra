/**
 * ROUTING TESTS
 * Tests for protocol routing logic
 * As per TESTS.md Section 2
 */

import { describe, it, expect } from 'vitest';
import { routeToProtocol } from '../protocol_router';
import { ClassificationResult } from '../classification/integrity_classifier';

describe('Protocol Routing - DRIFT', () => {
  it('should route DRIFT + urgency to holding_my_rhythm', () => {
    const classification: ClassificationResult = {
      integrity_state: 'DRIFT',
      primary_signal: 'urgency',
      classification_reason: 'Urgency detected'
    };

    const route = routeToProtocol(classification);
    expect(route.protocol).toBe('holding_my_rhythm');
    expect(route.exit_precursor).toBe(false);
  });

  it('should route DRIFT + avoidance to what_am_i_avoiding', () => {
    const classification: ClassificationResult = {
      integrity_state: 'DRIFT',
      primary_signal: 'avoidance',
      classification_reason: 'Avoidance detected'
    };

    const route = routeToProtocol(classification);
    expect(route.protocol).toBe('what_am_i_avoiding');
    expect(route.exit_precursor).toBe(false);
  });

  it('should route DRIFT + oscillating to grounding_sequence', () => {
    const classification: ClassificationResult = {
      integrity_state: 'DRIFT',
      primary_signal: 'oscillating',
      classification_reason: 'Oscillating rhythm'
    };

    const route = routeToProtocol(classification);
    expect(route.protocol).toBe('grounding_sequence');
    expect(route.exit_precursor).toBe(false);
  });

  it('should route DRIFT + pressure to holding_my_rhythm', () => {
    const classification: ClassificationResult = {
      integrity_state: 'DRIFT',
      primary_signal: 'pressure',
      classification_reason: 'Pressure detected'
    };

    const route = routeToProtocol(classification);
    expect(route.protocol).toBe('holding_my_rhythm');
    expect(route.exit_precursor).toBe(false);
  });
});

describe('Protocol Routing - DISTORTION', () => {
  it('should route DISTORTION + shame to shame_release', () => {
    const classification: ClassificationResult = {
      integrity_state: 'DISTORTION',
      primary_signal: 'shame',
      classification_reason: 'Shame detected'
    };

    const route = routeToProtocol(classification);
    expect(route.protocol).toBe('shame_release');
    expect(route.exit_precursor).toBe(false);
  });

  it('should route DISTORTION + fear to fear_mapping', () => {
    const classification: ClassificationResult = {
      integrity_state: 'DISTORTION',
      primary_signal: 'fear',
      classification_reason: 'Fear detected'
    };

    const route = routeToProtocol(classification);
    expect(route.protocol).toBe('fear_mapping');
    expect(route.exit_precursor).toBe(false);
  });

  it('should route DISTORTION + overwhelm to capacity_reset', () => {
    const classification: ClassificationResult = {
      integrity_state: 'DISTORTION',
      primary_signal: 'overwhelm',
      classification_reason: 'Overwhelm detected'
    };

    const route = routeToProtocol(classification);
    expect(route.protocol).toBe('capacity_reset');
    expect(route.exit_precursor).toBe(false);
  });
});

describe('Protocol Routing - PRE_COLLAPSE', () => {
  it('should route PRE_COLLAPSE + numbness to emergency_grounding', () => {
    const classification: ClassificationResult = {
      integrity_state: 'PRE_COLLAPSE',
      primary_signal: 'numbness',
      classification_reason: 'Numbness detected'
    };

    const route = routeToProtocol(classification);
    expect(route.protocol).toBe('emergency_grounding');
    expect(route.exit_precursor).toBe(true);
  });

  it('should route PRE_COLLAPSE + shutdown with exit_precursor flag', () => {
    const classification: ClassificationResult = {
      integrity_state: 'PRE_COLLAPSE',
      primary_signal: 'shutdown',
      classification_reason: 'Shutdown detected'
    };

    const route = routeToProtocol(classification);
    expect(route.protocol).toBe('emergency_grounding');
    expect(route.exit_precursor).toBe(true);
  });

  it('should route PRE_COLLAPSE + fog to emergency_grounding', () => {
    const classification: ClassificationResult = {
      integrity_state: 'PRE_COLLAPSE',
      primary_signal: 'fog',
      classification_reason: 'Fog detected'
    };

    const route = routeToProtocol(classification);
    expect(route.protocol).toBe('emergency_grounding');
    expect(route.exit_precursor).toBe(true);
  });
});

describe('Protocol Routing - STABLE', () => {
  it('should route STABLE to no protocol', () => {
    const classification: ClassificationResult = {
      integrity_state: 'STABLE',
      primary_signal: 'none',
      classification_reason: 'No drift detected'
    };

    const route = routeToProtocol(classification);
    expect(route.protocol).toBeNull();
    expect(route.exit_precursor).toBe(false);
  });
});

