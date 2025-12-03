import { useState, useEffect } from 'react';
import {
  FounderStateInput,
  CoherencePacket,
  DriftCheckResult,
  PhysiologicalState,
  Rhythm,
  EmotionalState,
  CognitiveState,
  ConflictIndicator,
} from './types';
import { evaluate, checkDrift, checkHealth } from './api';
import { SCENARIOS } from './scenarios';

function App() {
  const [founderState, setFounderState] = useState<FounderStateInput>({
    physiological: 'open',
    rhythm: 'steady',
    emotional: 'open',
    cognitive: 'clear',
    tension_keyword: '',
    conflict_indicator: 'none',
    founder_ready_signal: true,
  });

  const [result, setResult] = useState<CoherencePacket | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [healthStatus, setHealthStatus] = useState<'healthy' | 'error' | 'checking'>('checking');

  const [driftText, setDriftText] = useState('');
  const [driftResult, setDriftResult] = useState<DriftCheckResult | null>(null);
  const [driftLoading, setDriftLoading] = useState(false);

  useEffect(() => {
    checkHealth()
      .then(() => setHealthStatus('healthy'))
      .catch(() => setHealthStatus('error'));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await evaluate(founderState);
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const loadScenario = (state: FounderStateInput) => {
    setFounderState(state);
    setResult(null);
    setError(null);
  };

  const handleDriftCheck = async () => {
    if (!driftText.trim()) return;

    setDriftLoading(true);
    try {
      const response = await checkDrift(driftText);
      setDriftResult(response);
    } catch (err) {
      console.error('Drift check failed:', err);
    } finally {
      setDriftLoading(false);
    }
  };

  const getIntegrityClass = (state: string) => state.toLowerCase().replace('_', '');

  return (
    <div className="app">
      <header className="header">
        <h1>🍄 Lichen Coherence Engine</h1>
        <p>Phase 2: Stabilisation + Amplification Dashboard</p>
        <span className={`status-badge ${healthStatus}`}>
          {healthStatus === 'healthy' && '● Backend Online'}
          {healthStatus === 'error' && '● Backend Offline'}
          {healthStatus === 'checking' && '● Checking...'}
        </span>
      </header>

      <div className="container">
        {/* Left Column: Input */}
        <div>
          <div className="card">
            <h2>⚙️ Founder State Input</h2>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Physiological</label>
                <select
                  value={founderState.physiological}
                  onChange={(e) =>
                    setFounderState({
                      ...founderState,
                      physiological: e.target.value as PhysiologicalState,
                    })
                  }
                >
                  <option value="open">Open</option>
                  <option value="tight">Tight</option>
                  <option value="numb">Numb</option>
                  <option value="agitated">Agitated</option>
                  <option value="steady">Steady</option>
                </select>
              </div>

              <div className="form-group">
                <label>Rhythm</label>
                <select
                  value={founderState.rhythm}
                  onChange={(e) =>
                    setFounderState({ ...founderState, rhythm: e.target.value as Rhythm })
                  }
                >
                  <option value="steady">Steady</option>
                  <option value="fragmented">Fragmented</option>
                  <option value="urgent">Urgent</option>
                  <option value="oscillating">Oscillating</option>
                </select>
              </div>

              <div className="form-group">
                <label>Emotional</label>
                <select
                  value={founderState.emotional}
                  onChange={(e) =>
                    setFounderState({
                      ...founderState,
                      emotional: e.target.value as EmotionalState,
                    })
                  }
                >
                  <option value="open">Open</option>
                  <option value="constricted">Constricted</option>
                  <option value="fog">Fog</option>
                  <option value="collapse">Collapse</option>
                </select>
              </div>

              <div className="form-group">
                <label>Cognitive</label>
                <select
                  value={founderState.cognitive}
                  onChange={(e) =>
                    setFounderState({
                      ...founderState,
                      cognitive: e.target.value as CognitiveState,
                    })
                  }
                >
                  <option value="clear">Clear</option>
                  <option value="looping">Looping</option>
                  <option value="overwhelmed">Overwhelmed</option>
                </select>
              </div>

              <div className="form-group">
                <label>Tension Keyword</label>
                <input
                  type="text"
                  value={founderState.tension_keyword}
                  onChange={(e) =>
                    setFounderState({ ...founderState, tension_keyword: e.target.value })
                  }
                  placeholder="e.g., deadline, failure, calm"
                />
              </div>

              <div className="form-group">
                <label>Conflict Indicator</label>
                <select
                  value={founderState.conflict_indicator}
                  onChange={(e) =>
                    setFounderState({
                      ...founderState,
                      conflict_indicator: e.target.value as ConflictIndicator,
                    })
                  }
                >
                  <option value="none">None</option>
                  <option value="avoidance">Avoidance</option>
                  <option value="tension">Tension</option>
                  <option value="pressure">Pressure</option>
                </select>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={founderState.founder_ready_signal === true}
                    onChange={(e) =>
                      setFounderState({ ...founderState, founder_ready_signal: e.target.checked })
                    }
                    style={{ width: 'auto', margin: 0 }}
                  />
                  Founder Ready Signal (Embodied Yes)
                </label>
              </div>

              <button type="submit" className="button button-primary" disabled={loading}>
                {loading ? '⏳ Analyzing...' : '🔍 Evaluate'}
              </button>
            </form>

            <h3>Quick Test Scenarios</h3>
            <div className="scenarios">
              {SCENARIOS.map((scenario, i) => (
                <button
                  key={i}
                  className="button button-small"
                  onClick={() => loadScenario(scenario.state)}
                >
                  {scenario.name}
                </button>
              ))}
            </div>
          </div>

          {/* Drift Check Section */}
          <div className="card drift-check">
            <h2>🔍 Drift Detection Test</h2>
            <div className="form-group">
              <label>Test Text for Forbidden Language</label>
              <input
                type="text"
                value={driftText}
                onChange={(e) => setDriftText(e.target.value)}
                placeholder="e.g., You should try to relax..."
              />
            </div>
            <button
              className="button button-primary"
              onClick={handleDriftCheck}
              disabled={driftLoading || !driftText.trim()}
            >
              {driftLoading ? '⏳ Checking...' : '✓ Check for Drift'}
            </button>

            {driftResult && (
              <div className={`drift-result ${driftResult.clean ? 'clean' : 'violations'}`}>
                <strong>{driftResult.clean ? '✅ Clean Output' : '⚠️ Violations Detected'}</strong>
                {!driftResult.clean && (
                  <div>
                    {driftResult.violations.map((v, i) => (
                      <div key={i} className="violation-item">
                        <div className="violation-type">{v.type.replace(/_/g, ' ')}</div>
                        <div>Detected: "{v.detected_in}"</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Results */}
        <div>
          <div className="card">
            <h2>📊 Classification Results</h2>

            {error && <div className="error">{error}</div>}

            {!result && !error && (
              <div className="empty-state">
                <div className="empty-state-icon">🎯</div>
                <p>Submit a founder state to see results</p>
              </div>
            )}

            {result && (
              <div className={`result-card ${getIntegrityClass(result.integrity_state)}`}>
                <div className="result-header">
                  <span className={`integrity-badge ${getIntegrityClass(result.integrity_state)}`}>
                    {result.integrity_state}
                  </span>
                </div>

                <div className="result-row">
                  <span className="result-label">State Reflection</span>
                  <span className="result-value">{result.state_reflection}</span>
                </div>

                <div className="result-row">
                  <span className="result-label">Protocol Route</span>
                  <span className="result-value">
                    {result.protocol_route ? (
                      <code>{result.protocol_route}</code>
                    ) : (
                      <span style={{ color: 'var(--color-text-muted)' }}>None</span>
                    )}
                  </span>
                </div>

                {result.stabilisation_cue && (
                  <div>
                    <h3>Stabilisation Cue</h3>
                    <div className="cue-display">{result.stabilisation_cue}</div>
                  </div>
                )}

                {result.exit_precursor && (
                  <div className="exit-warning">
                    <span className="exit-warning-icon">⚠️</span>
                    <div>
                      <strong>Exit Precursor Triggered</strong>
                      <div style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                        System approaching collapse - emergency protocols required
                      </div>
                    </div>
                  </div>
                )}

                {result.upward && (
                  <div>
                    <h3 style={{ color: 'var(--color-success)', marginTop: '1.5rem' }}>
                      ✨ Upward Coherence Detected
                    </h3>

                    <div
                      style={{
                        background: 'rgba(16, 185, 129, 0.1)',
                        border: '2px solid var(--color-success)',
                        borderRadius: '0.75rem',
                        padding: '1.25rem',
                        marginTop: '1rem',
                      }}
                    >
                      <div className="result-row">
                        <span className="result-label">Expansion Detected</span>
                        <span className="result-value">
                          {result.upward.expansion_detected ? '✅ Yes' : '❌ No'}
                        </span>
                      </div>

                      <div className="result-row">
                        <span className="result-label">Amplification Safe</span>
                        <span className="result-value">
                          {result.upward.amplification_safe ? '✅ Yes' : '❌ No'}
                        </span>
                      </div>

                      {result.upward.magnification_note && (
                        <div style={{ marginTop: '1rem' }}>
                          <strong
                            style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}
                          >
                            Magnification Note:
                          </strong>
                          <div
                            style={{
                              marginTop: '0.5rem',
                              padding: '0.75rem',
                              background: 'var(--color-surface-hover)',
                              borderRadius: '0.5rem',
                              fontSize: '1rem',
                              fontStyle: 'italic',
                            }}
                          >
                            "{result.upward.magnification_note}"
                          </div>
                        </div>
                      )}

                      {result.upward.micro_actions && result.upward.micro_actions.length > 0 && (
                        <div style={{ marginTop: '1rem' }}>
                          <strong
                            style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}
                          >
                            Micro-Actions:
                          </strong>
                          <ul
                            style={{
                              marginTop: '0.5rem',
                              paddingLeft: '1.5rem',
                              listStyleType: 'disc',
                            }}
                          >
                            {result.upward.micro_actions.map((action, i) => (
                              <li key={i} style={{ marginTop: '0.25rem' }}>
                                {action}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {!result.upward && result.integrity_state === 'STABLE' && (
                  <div
                    style={{
                      marginTop: '1.5rem',
                      padding: '1rem',
                      background: 'var(--color-surface-hover)',
                      borderRadius: '0.5rem',
                    }}
                  >
                    <strong>ℹ️ No Amplification</strong>
                    <p
                      style={{
                        fontSize: '0.875rem',
                        marginTop: '0.5rem',
                        color: 'var(--color-text-muted)',
                      }}
                    >
                      State is STABLE but amplification conditions not met. Check founder ready
                      signal and expansion signals.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
