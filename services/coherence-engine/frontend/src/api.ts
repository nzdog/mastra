import { FounderStateInput, CoherencePacket, DriftCheckResult } from './types';

const API_BASE = 'http://localhost:3000';

export async function stabiliseOnly(founderState: FounderStateInput): Promise<CoherencePacket> {
  const response = await fetch(`${API_BASE}/coherence/stabilise-only`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ founder_state: founderState })
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }

  return response.json() as Promise<CoherencePacket>;
}

export async function evaluate(founderState: FounderStateInput, diagnosticContext?: any): Promise<CoherencePacket> {
  const response = await fetch(`${API_BASE}/coherence/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      founder_state: founderState,
      diagnostic_context: diagnosticContext || { coherence_score: 0.85 }
    })
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }

  return response.json() as Promise<CoherencePacket>;
}

export async function checkDrift(text: string): Promise<DriftCheckResult> {
  const response = await fetch(`${API_BASE}/coherence/debug/drift-check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }

  return response.json() as Promise<DriftCheckResult>;
}

export async function checkHealth(): Promise<{ status: string }> {
  const response = await fetch(`${API_BASE}/health`);
  
  if (!response.ok) {
    throw new Error('Health check failed');
  }

  return response.json() as Promise<{ status: string }>;
}

