/**
 * MEMORY NON-INTERFERENCE TESTS
 * Ensures memory cannot influence classification
 * As per TESTS.md Section 5 and SPEC.md Section 7
 */

import { describe, it, expect } from 'vitest';
import { classifyIntegrityState } from '../classification/integrity_classifier';
import { FounderStateInput } from '../models/founder_state';
import { MemorySnapshot } from '../models/memory_snapshot';

describe('Memory Non-Interference', () => {
  it('should produce same classification with different memory snapshots', () => {
    const state: FounderStateInput = {
      physiological: 'tight',
      rhythm: 'urgent',
      emotional: 'constricted',
      cognitive: 'looping',
      tension_keyword: 'deadline',
      conflict_indicator: 'pressure',
    };

    const memory1: MemorySnapshot = {
      recent_drift_events: [],
      stability_duration_hours: 48,
    };

    const memory2: MemorySnapshot = {
      recent_drift_events: ['urgency_2024-11-01', 'urgency_2024-11-05'],
      founder_drift_signature: ['urgency', 'collapse'],
      collapse_precursors: ['shutdown_pattern'],
    };

    // Classification should be identical regardless of memory
    const result1 = classifyIntegrityState(state);
    const result2 = classifyIntegrityState(state);

    expect(result1.integrity_state).toBe(result2.integrity_state);
    expect(result1.primary_signal).toBe(result2.primary_signal);
    expect(result1.integrity_state).toBe('DRIFT');
  });

  it('should not change DRIFT to STABLE based on memory', () => {
    const driftState: FounderStateInput = {
      physiological: 'tight',
      rhythm: 'urgent',
      emotional: 'constricted',
      cognitive: 'looping',
      tension_keyword: 'deadline',
      conflict_indicator: 'pressure',
    };

    const positiveMemory: MemorySnapshot = {
      recent_drift_events: [],
      stability_duration_hours: 168, // 1 week stable
      protocol_usage_history: [],
    };

    const result = classifyIntegrityState(driftState);
    expect(result.integrity_state).toBe('DRIFT');
  });

  it('should not change STABLE to DRIFT based on memory', () => {
    const stableState: FounderStateInput = {
      physiological: 'open',
      rhythm: 'steady',
      emotional: 'open',
      cognitive: 'clear',
      tension_keyword: 'calm',
      conflict_indicator: 'none',
    };

    const negativeMemory: MemorySnapshot = {
      recent_drift_events: ['urgency_spike', 'collapse_event'],
      recent_pre_collapse_events: ['shutdown_2024-11-10'],
      founder_drift_signature: ['urgency', 'shame', 'collapse'],
      collapse_precursors: ['shutdown_pattern', 'numbness_pattern'],
    };

    const result = classifyIntegrityState(stableState);
    expect(result.integrity_state).toBe('STABLE');
  });

  it('should classify based on present state only', () => {
    // Two founders with identical present state but different histories
    const presentState: FounderStateInput = {
      physiological: 'tight',
      rhythm: 'oscillating',
      emotional: 'constricted',
      cognitive: 'looping',
      tension_keyword: 'failure',
      conflict_indicator: 'tension',
    };

    const founderAMemory: MemorySnapshot = {
      recent_drift_events: [],
      stability_duration_hours: 240,
    };

    const founderBMemory: MemorySnapshot = {
      recent_drift_events: ['drift_daily_for_2_weeks'],
      recent_distortion_events: ['shame_spike_yesterday'],
      collapse_precursors: ['multiple_patterns'],
    };

    // Both should classify identically
    const resultA = classifyIntegrityState(presentState);
    const resultB = classifyIntegrityState(presentState);

    expect(resultA.integrity_state).toBe(resultB.integrity_state);
    expect(resultA.primary_signal).toBe(resultB.primary_signal);
    expect(resultA.integrity_state).toBe('DISTORTION');
  });
});
