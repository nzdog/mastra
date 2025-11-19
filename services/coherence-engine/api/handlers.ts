/**
 * API HANDLERS
 * HTTP request handlers for Coherence Engine endpoints
 */

import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import {
  FounderStateInput,
  DiagnosticContext,
  MemorySnapshot,
  isValidFounderState,
  isValidDiagnosticContext,
  isValidMemorySnapshot,
  isValidCoherencePacket,
} from '../models';
import { classifyIntegrityState } from '../classification';
import { routeToProtocol } from '../protocol_router';
import { buildCoherencePacket } from '../outputs/output_builder';
import { validateOutput } from '../outputs/self_correction';
import { checkForDrift } from '../outputs/drift_guard';
import { detectExpansion } from '../amplification/expansion_detector';
import { detectFalseHigh } from '../amplification/false_high_detector';
import { planAmplification } from '../amplification/amplification_planner';

/**
 * Request body for stabilisation endpoint
 */
interface StabiliseRequest {
  founder_state: FounderStateInput;
  diagnostic_context?: DiagnosticContext;
  memory_snapshot?: MemorySnapshot;
}

/**
 * POST /coherence/stabilise-only
 * Main stabilisation endpoint (Phase 1 MVP)
 */
export async function stabiliseOnly(req: Request, res: Response): Promise<void> {
  try {
    const body: StabiliseRequest = req.body;

    // Validate required fields
    if (!body.founder_state) {
      res.status(400).json({
        error: 'Missing required field: founder_state',
      });
      return;
    }

    // Validate founder_state
    if (!isValidFounderState(body.founder_state)) {
      res.status(400).json({
        error: 'Invalid founder_state format',
        details: 'Check physiological, rhythm, emotional, cognitive, and conflict_indicator fields',
      });
      return;
    }

    // Validate optional fields
    if (body.diagnostic_context && !isValidDiagnosticContext(body.diagnostic_context)) {
      res.status(400).json({
        error: 'Invalid diagnostic_context format',
      });
      return;
    }

    if (body.memory_snapshot && !isValidMemorySnapshot(body.memory_snapshot)) {
      res.status(400).json({
        error: 'Invalid memory_snapshot format',
      });
      return;
    }

    // Process: Classify -> Route -> Build Output
    const classification = classifyIntegrityState(body.founder_state, body.diagnostic_context);

    const route = routeToProtocol(classification);

    const coherencePacket = buildCoherencePacket(body.founder_state, classification, route);

    // Validate output for drift (should never happen in deterministic system, but safety check)
    const driftViolations = validateOutput(coherencePacket);
    if (driftViolations.length > 0) {
      // Log error and return 500 - this is a system bug
      logger.error('CRITICAL: Drift detected in output', { violations: driftViolations });
      res.status(500).json({
        error: 'Internal error: drift detected in output',
        violations: driftViolations,
      });
      return;
    }

    // Validate packet structure
    if (!isValidCoherencePacket(coherencePacket)) {
      logger.error('CRITICAL: Invalid CoherencePacket structure', { packet: coherencePacket });
      res.status(500).json({
        error: 'Internal error: invalid output structure',
      });
      return;
    }

    // Return successful response
    res.status(200).json(coherencePacket);
  } catch (error) {
    logger.error('Error in stabiliseOnly', { error });
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * POST /coherence/evaluate
 * Full evaluation endpoint (includes amplification - Phase 2)
 */
export async function evaluate(req: Request, res: Response): Promise<void> {
  try {
    const body: StabiliseRequest = req.body;

    // Validate required fields
    if (!body.founder_state) {
      res.status(400).json({
        error: 'Missing required field: founder_state',
      });
      return;
    }

    // Validate founder_state
    if (!isValidFounderState(body.founder_state)) {
      res.status(400).json({
        error: 'Invalid founder_state format',
        details: 'Check physiological, rhythm, emotional, cognitive, and conflict_indicator fields',
      });
      return;
    }

    // Validate optional fields
    if (body.diagnostic_context && !isValidDiagnosticContext(body.diagnostic_context)) {
      res.status(400).json({
        error: 'Invalid diagnostic_context format',
      });
      return;
    }

    if (body.memory_snapshot && !isValidMemorySnapshot(body.memory_snapshot)) {
      res.status(400).json({
        error: 'Invalid memory_snapshot format',
      });
      return;
    }

    // Step 1: Classify integrity state
    const classification = classifyIntegrityState(body.founder_state, body.diagnostic_context);

    const route = routeToProtocol(classification);

    // Step 2: Build base coherence packet
    let coherencePacket = buildCoherencePacket(body.founder_state, classification, route);

    // Step 3: Check for upward coherence (Phase 2)
    if (classification.integrity_state === 'STABLE') {
      // Detect expansion signals
      const expansion = detectExpansion(body.founder_state, body.diagnostic_context);

      // Detect false-high
      const falseHigh = detectFalseHigh(body.founder_state, body.diagnostic_context);

      // Plan amplification with safeguards
      const amplificationPlan = planAmplification(
        body.founder_state,
        classification.integrity_state,
        expansion,
        falseHigh,
        true // For Phase 2, assume protocol cycle complete
      );

      // Add upward block if amplification is safe
      coherencePacket = {
        ...coherencePacket,
        upward: amplificationPlan.upward_block,
      };
    }

    // Validate output for drift
    const driftViolations = validateOutput(coherencePacket);
    if (driftViolations.length > 0) {
      logger.error('CRITICAL: Drift detected in output', { violations: driftViolations });
      res.status(500).json({
        error: 'Internal error: drift detected in output',
        violations: driftViolations,
      });
      return;
    }

    // Validate packet structure
    if (!isValidCoherencePacket(coherencePacket)) {
      logger.error('CRITICAL: Invalid CoherencePacket structure', { packet: coherencePacket });
      res.status(500).json({
        error: 'Internal error: invalid output structure',
      });
      return;
    }

    // Return successful response
    res.status(200).json(coherencePacket);
  } catch (error) {
    logger.error('Error in evaluate', { error });
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * POST /coherence/debug/drift-check
 * Debug endpoint to test drift detection
 */
export async function driftCheck(req: Request, res: Response): Promise<void> {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      res.status(400).json({
        error: 'Missing or invalid required field: text (string)',
      });
      return;
    }

    const violations = checkForDrift(text);

    res.status(200).json({
      clean: violations.length === 0,
      violations,
      text,
    });
  } catch (error) {
    logger.error('Error in driftCheck', { error });
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * GET /health
 * Health check endpoint
 */
export function health(req: Request, res: Response): void {
  res.status(200).json({
    status: 'healthy',
    service: 'coherence-engine',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
}
