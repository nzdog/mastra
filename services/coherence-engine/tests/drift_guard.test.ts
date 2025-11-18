/**
 * DRIFT GUARD TESTS
 * Tests for forbidden language detection
 * As per TESTS.md Section 4
 */

import { describe, it, expect } from 'vitest';
import { checkForDrift, isCleanOutput } from '../outputs/drift_guard';

describe('Drift Detection - Future References', () => {
  it('should reject "you will"', () => {
    const violations = checkForDrift('You will feel better soon.');
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].type).toBe('future_reference');
  });

  it('should reject "next you"', () => {
    const violations = checkForDrift('Next you can try grounding.');
    expect(violations.length).toBeGreaterThan(0);
  });

  it('should reject "after this"', () => {
    const violations = checkForDrift('After this, things will improve.');
    expect(violations.length).toBeGreaterThan(0);
  });

  it('should reject "soon"', () => {
    const violations = checkForDrift('Soon you will be ready.');
    expect(violations.length).toBeGreaterThan(0);
  });

  it('should reject "later"', () => {
    const violations = checkForDrift('We can address this later.');
    expect(violations.length).toBeGreaterThan(0);
  });

  it('should reject "when you\'re ready"', () => {
    const violations = checkForDrift('When you\'re ready, move forward.');
    expect(violations.length).toBeGreaterThan(0);
  });
});

describe('Drift Detection - Advisory Language', () => {
  it('should reject "you should"', () => {
    const violations = checkForDrift('You should take a break.');
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].type).toBe('advisory');
  });

  it('should reject "you need to"', () => {
    const violations = checkForDrift('You need to rest.');
    expect(violations.length).toBeGreaterThan(0);
  });

  it('should reject "try to"', () => {
    const violations = checkForDrift('Try to breathe deeply.');
    expect(violations.length).toBeGreaterThan(0);
  });

  it('should reject "consider"', () => {
    const violations = checkForDrift('Consider taking time off.');
    expect(violations.length).toBeGreaterThan(0);
  });

  it('should reject "I recommend"', () => {
    const violations = checkForDrift('I recommend pausing here.');
    expect(violations.length).toBeGreaterThan(0);
  });
});

describe('Drift Detection - Motivational Language', () => {
  it('should reject "you can do it"', () => {
    const violations = checkForDrift('You can do it! Keep going.');
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some(v => v.type === 'motivational')).toBe(true);
  });

  it('should reject "you\'ve got this"', () => {
    const violations = checkForDrift('You\'ve got this.');
    expect(violations.length).toBeGreaterThan(0);
  });

  it('should reject "keep going"', () => {
    const violations = checkForDrift('Keep going, you\'re almost there.');
    expect(violations.length).toBeGreaterThan(0);
  });

  it('should reject "stay strong"', () => {
    const violations = checkForDrift('Stay strong through this.');
    expect(violations.length).toBeGreaterThan(0);
  });

  it('should reject "believe in yourself"', () => {
    const violations = checkForDrift('Believe in yourself.');
    expect(violations.length).toBeGreaterThan(0);
  });
});

describe('Drift Detection - Emotional Validation', () => {
  it('should reject "it\'s okay"', () => {
    const violations = checkForDrift('It\'s okay to feel this way.');
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].type).toBe('emotional_validation');
  });

  it('should reject "that\'s normal"', () => {
    const violations = checkForDrift('That\'s normal for founders.');
    expect(violations.length).toBeGreaterThan(0);
  });

  it('should reject "don\'t worry"', () => {
    const violations = checkForDrift('Don\'t worry about it.');
    expect(violations.length).toBeGreaterThan(0);
  });
});

describe('Drift Detection - Therapeutic Language', () => {
  it('should reject "how does that make you feel"', () => {
    const violations = checkForDrift('How does that make you feel?');
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].type).toBe('therapeutic');
  });

  it('should reject "let\'s explore"', () => {
    const violations = checkForDrift('Let\'s explore this feeling.');
    expect(violations.length).toBeGreaterThan(0);
  });

  it('should reject "what comes up for you"', () => {
    const violations = checkForDrift('What comes up for you when I say that?');
    expect(violations.length).toBeGreaterThan(0);
  });
});

describe('Clean Output Detection', () => {
  it('should pass clean present-state reflection', () => {
    const clean = isCleanOutput('Urgency detected. Rhythm fragmented.');
    expect(clean).toBe(true);
  });

  it('should pass clean stabilisation cue', () => {
    const clean = isCleanOutput('Pause.');
    expect(clean).toBe(true);
  });

  it('should pass clean state descriptions', () => {
    const texts = [
      'Coherent. Rhythm steady.',
      'Shame detected. Field distorted.',
      'Numbness detected. System shutdown imminent.',
      'Ground.',
      'Stop.',
      'Notice.',
      'Breathe.'
    ];

    texts.forEach(text => {
      expect(isCleanOutput(text)).toBe(true);
    });
  });

  it('should reject mixed clean and dirty text', () => {
    const violations = checkForDrift('Urgency detected. You should pause now.');
    expect(violations.length).toBeGreaterThan(0);
  });
});

describe('Multiple Violations Detection', () => {
  it('should detect multiple violations in single text', () => {
    const text = 'You should try to relax. Soon you will feel better. Keep going!';
    const violations = checkForDrift(text);
    
    expect(violations.length).toBeGreaterThan(2);
    
    const types = violations.map(v => v.type);
    expect(types).toContain('advisory');
    expect(types).toContain('future_reference');
    expect(types).toContain('motivational');
  });
});

