/**
 * API INTEGRATION TESTS
 * Tests for HTTP endpoints
 * As per TESTS.md Section 6
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../api/server';
import { Express } from 'express';

let app: Express;

beforeAll(() => {
  app = createApp();
});

describe('POST /coherence/stabilise-only', () => {
  it('should return 200 with valid CoherencePacket for valid request', async () => {
    const response = await request(app)
      .post('/coherence/stabilise-only')
      .send({
        founder_state: {
          physiological: 'tight',
          rhythm: 'urgent',
          emotional: 'constricted',
          cognitive: 'looping',
          tension_keyword: 'deadline',
          conflict_indicator: 'pressure'
        },
        diagnostic_context: {
          current_field: 'launch_pressure',
          coherence_score: 0.4
        },
        memory_snapshot: {
          recent_drift_events: ['urgency_2024-11-15']
        }
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('integrity_state');
    expect(response.body).toHaveProperty('state_reflection');
    expect(response.body).toHaveProperty('protocol_route');
    expect(response.body).toHaveProperty('stabilisation_cue');
    expect(response.body).toHaveProperty('exit_precursor');
    expect(response.body).toHaveProperty('upward');
    expect(response.body.upward).toBeNull();
  });

  it('should return 400 for missing founder_state', async () => {
    const response = await request(app)
      .post('/coherence/stabilise-only')
      .send({
        diagnostic_context: {}
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });

  it('should return 400 for invalid physiological value', async () => {
    const response = await request(app)
      .post('/coherence/stabilise-only')
      .send({
        founder_state: {
          physiological: 'invalid_value',
          rhythm: 'steady',
          emotional: 'open',
          cognitive: 'clear',
          tension_keyword: 'calm',
          conflict_indicator: 'none'
        }
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });

  it('should handle urgency spike scenario', async () => {
    const response = await request(app)
      .post('/coherence/stabilise-only')
      .send({
        founder_state: {
          physiological: 'tight',
          rhythm: 'urgent',
          emotional: 'constricted',
          cognitive: 'looping',
          tension_keyword: 'deadline',
          conflict_indicator: 'pressure'
        }
      });

    expect(response.status).toBe(200);
    expect(response.body.integrity_state).toBe('DRIFT');
    expect(response.body.protocol_route).toBe('holding_my_rhythm');
    expect(response.body.exit_precursor).toBe(false);
  });

  it('should handle numbness/shutdown scenario', async () => {
    const response = await request(app)
      .post('/coherence/stabilise-only')
      .send({
        founder_state: {
          physiological: 'numb',
          rhythm: 'fragmented',
          emotional: 'fog',
          cognitive: 'overwhelmed',
          tension_keyword: 'nothing',
          conflict_indicator: 'avoidance'
        }
      });

    expect(response.status).toBe(200);
    expect(response.body.integrity_state).toBe('PRE_COLLAPSE');
    expect(response.body.exit_precursor).toBe(true);
  });

  it('should handle shame scenario', async () => {
    const response = await request(app)
      .post('/coherence/stabilise-only')
      .send({
        founder_state: {
          physiological: 'tight',
          rhythm: 'oscillating',
          emotional: 'constricted',
          cognitive: 'looping',
          tension_keyword: 'failure',
          conflict_indicator: 'tension'
        }
      });

    expect(response.status).toBe(200);
    expect(response.body.integrity_state).toBe('DISTORTION');
    expect(response.body.protocol_route).toBe('shame_release');
  });

  it('should handle calm/stable scenario', async () => {
    const response = await request(app)
      .post('/coherence/stabilise-only')
      .send({
        founder_state: {
          physiological: 'open',
          rhythm: 'steady',
          emotional: 'open',
          cognitive: 'clear',
          tension_keyword: 'calm',
          conflict_indicator: 'none'
        }
      });

    expect(response.status).toBe(200);
    expect(response.body.integrity_state).toBe('STABLE');
    expect(response.body.protocol_route).toBeNull();
    expect(response.body.stabilisation_cue).toBeNull();
  });
});

describe('POST /coherence/debug/drift-check', () => {
  it('should return clean: true for clean text', async () => {
    const response = await request(app)
      .post('/coherence/debug/drift-check')
      .send({
        text: 'Urgency detected. Rhythm fragmented.'
      });

    expect(response.status).toBe(200);
    expect(response.body.clean).toBe(true);
    expect(response.body.violations).toHaveLength(0);
  });

  it('should detect violations in text with "you should"', async () => {
    const response = await request(app)
      .post('/coherence/debug/drift-check')
      .send({
        text: 'You should take a break now.'
      });

    expect(response.status).toBe(200);
    expect(response.body.clean).toBe(false);
    expect(response.body.violations.length).toBeGreaterThan(0);
  });

  it('should return 400 for missing text field', async () => {
    const response = await request(app)
      .post('/coherence/debug/drift-check')
      .send({});

    expect(response.status).toBe(400);
  });

  it('should return list of detected violations', async () => {
    const response = await request(app)
      .post('/coherence/debug/drift-check')
      .send({
        text: 'You should try to relax. Soon you will feel better.'
      });

    expect(response.status).toBe(200);
    expect(response.body.violations).toBeInstanceOf(Array);
    expect(response.body.violations.length).toBeGreaterThan(1);
  });
});

describe('GET /health', () => {
  it('should return 200 with health status', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'healthy');
    expect(response.body).toHaveProperty('service', 'coherence-engine');
  });
});

describe('404 Handler', () => {
  it('should return 404 for unknown routes', async () => {
    const response = await request(app).get('/unknown/route');

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error');
  });
});

