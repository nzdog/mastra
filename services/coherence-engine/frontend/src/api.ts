import { FounderStateInput, CoherencePacket, DriftCheckResult } from './types';

const API_BASE = '';

export async function stabiliseOnly(founderState: FounderStateInput): Promise<CoherencePacket> {
  const response = await fetch(`${API_BASE}/coherence/stabilise-only`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ founder_state: founderState }),
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }

  return response.json();
}

export async function checkDrift(text: string): Promise<DriftCheckResult> {
  const response = await fetch(`${API_BASE}/coherence/debug/drift-check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }

  return response.json();
}

export async function checkHealth(): Promise<{ status: string }> {
  const response = await fetch(`${API_BASE}/health`);

  if (!response.ok) {
    throw new Error('Health check failed');
  }

  return response.json();
}
