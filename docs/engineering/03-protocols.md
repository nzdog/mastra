# Protocols as Code

> **Quick take**: Protocols are typed state machines that guide field transitions—not rigid workflows, but adaptive scaffolds.

## What is a Protocol?

A **protocol** in Lichen is:
- A **typed workflow** with explicit state transitions
- An **adaptive scaffold** that responds to field state
- A **guided conversation** between human and AI, mediated by structure

**NOT** a rigid checklist. **NOT** a linear flowchart. **NOT** a constraint on human agency.

## Protocol Structure

Every protocol has:

```typescript
interface Protocol {
  id: string;              // Unique identifier
  slug: string;            // URL-safe name
  title: string;           // Human-readable name
  description: string;     // Purpose and context
  
  stages: Stage[];         // Ordered workflow stages
  invariants: Invariant[]; // Never-violate rules
  
  empathyCodec: EmpathyCodec;  // Field-aware adaptations
  exitCriteria: ExitCriteria;   // When to stop
}

interface Stage {
  id: string;
  name: string;
  prompt: string;          // AI prompt for this stage
  validation?: Validator;   // Optional validation logic
  transitions: Transition[]; // Possible next states
}
```

## Example: Field Diagnostic Protocol

```typescript
const fieldDiagnostic: Protocol = {
  id: 'field-diagnostic-v1',
  slug: 'field_diagnostic',
  title: 'Field Diagnostic Walk',
  description: 'Detect invisible constraint patterns affecting decision-making',
  
  stages: [
    {
      id: 'opening',
      name: 'Opening',
      prompt: `Welcome to the Lichen Field Diagnostic.
      
      This is a guided conversation to help you see the invisible patterns 
      shaping your decisions. There are no right answers—only honest observations.
      
      Before we begin: Is this a good time? Do you have 20-30 minutes of 
      uninterrupted space?`,
      transitions: [
        { trigger: 'consent_given', next: 'current_state' },
        { trigger: 'not_ready', next: 'pause_offer' },
      ],
    },
    
    {
      id: 'current_state',
      name: 'Current State',
      prompt: `Let's start with what's real right now.
      
      What's one decision you're facing that feels... stuck? Not urgent, 
      not dramatic—just a decision that won't quite resolve.`,
      validation: {
        minLength: 20, // Ensure thoughtful response
        stressDetection: true, // Activate empathy codec
      },
      transitions: [
        { trigger: 'decision_named', next: 'field_exploration' },
      ],
    },
    
    {
      id: 'field_exploration',
      name: 'Field Exploration',
      prompt: `Now let's look at the invisible architecture around that decision.
      
      When you think about making that decision:
      - What becomes possible?
      - What becomes impossible?
      - What do you notice in your body?`,
      empathyCodec: {
        stressSignals: ['overwhelm', 'stuck', 'paralyzed'],
        adaptations: {
          pacing: 'slow',
          validation: 'explicit',
          complexity: 'reduced',
        },
      },
      transitions: [
        { trigger: 'pattern_detected', next: 'field_naming' },
      ],
    },
    
    // ... more stages
  ],
  
  invariants: [
    { type: 'consent', rule: 'User can exit at any time' },
    { type: 'privacy', rule: 'No data retained beyond session' },
    { type: 'agency', rule: 'No prescriptive advice given' },
  ],
  
  exitCriteria: {
    natural: 'User sees the field pattern clearly',
    early: 'User chooses to pause/stop',
    timeout: '45 minutes elapsed',
  },
};
```

## State Machine Implementation

```typescript
class ProtocolStateMachine {
  private currentStage: Stage;
  private session: Session;
  private empathyCodec: EmpathyCodec;
  
  async advance(userInput: string): Promise<Response> {
    // 1. Detect field state from user input
    const fieldState = await this.empathyCodec.detect(userInput);
    
    // 2. Validate current stage completion
    if (this.currentStage.validation) {
      const valid = await this.validate(userInput);
      if (!valid) {
        return this.handleValidationFailure();
      }
    }
    
    // 3. Determine next stage
    const trigger = await this.determineTrigger(userInput);
    const nextStage = this.findTransition(trigger);
    
    // 4. Apply empathy codec to next stage prompt
    const adaptedPrompt = this.empathyCodec.adapt(
      nextStage.prompt,
      fieldState
    );
    
    // 5. Update session state
    await this.updateSession(nextStage.id);
    
    // 6. Return AI response
    return {
      prompt: adaptedPrompt,
      stage: nextStage.id,
      fieldState,
    };
  }
  
  private findTransition(trigger: string): Stage {
    const transition = this.currentStage.transitions.find(
      t => t.trigger === trigger
    );
    
    if (!transition) {
      throw new InvariantViolation(
        `No valid transition for trigger: ${trigger}`
      );
    }
    
    return this.getStage(transition.next);
  }
}
```

## Empathy Codec Integration

The empathy codec adapts protocol behavior based on detected field state:

```typescript
interface EmpathyCodec {
  detect(input: string): Promise<FieldState>;
  adapt(prompt: string, state: FieldState): string;
}

type FieldState = 
  | { type: 'coherent'; energy: 'high' | 'medium' }
  | { type: 'stressed'; signals: string[] }
  | { type: 'overwhelmed'; urgency: boolean }
  | { type: 'confused'; clarity: number };

function adaptPrompt(base: string, state: FieldState): string {
  switch (state.type) {
    case 'stressed':
      return `[Adapting to stress signals detected]
      
      Let's slow down for a moment.
      
      ${base}
      
      Take your time—there's no rush.`;
      
    case 'overwhelmed':
      return `[Simplifying due to overwhelm]
      
      ${simplify(base)}
      
      Just one small step: ${extractFirstQuestion(base)}`;
      
    case 'confused':
      return `[Adding clarity]
      
      Let me reframe that more clearly:
      
      ${clarify(base)}`;
      
    default:
      return base;
  }
}
```

## Protocol Validation

Every protocol must pass these checks before deployment:

```typescript
function validateProtocol(protocol: Protocol): ValidationResult {
  const errors: string[] = [];
  
  // 1. All stages must have valid transitions
  for (const stage of protocol.stages) {
    if (stage.transitions.length === 0 && !isTerminal(stage)) {
      errors.push(`Stage ${stage.id} has no exit transitions`);
    }
  }
  
  // 2. No unreachable stages
  const reachable = findReachableStages(protocol);
  const unreachable = protocol.stages.filter(s => !reachable.has(s.id));
  if (unreachable.length > 0) {
    errors.push(`Unreachable stages: ${unreachable.map(s => s.id)}`);
  }
  
  // 3. All invariants must be encodable
  for (const inv of protocol.invariants) {
    if (!isEncodable(inv)) {
      errors.push(`Invariant not encodable: ${inv.rule}`);
    }
  }
  
  // 4. Empathy codec is configured
  if (!protocol.empathyCodec) {
    errors.push('Missing empathy codec configuration');
  }
  
  // 5. Exit criteria are defined
  if (!protocol.exitCriteria) {
    errors.push('Missing exit criteria');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
```

## Testing Protocols

```typescript
describe('Field Diagnostic Protocol', () => {
  it('respects user consent at opening', async () => {
    const machine = new ProtocolStateMachine(fieldDiagnostic);
    
    const response = await machine.advance('Not ready right now');
    
    expect(response.stage).toBe('pause_offer');
    expect(response.prompt).toContain('completely fine');
  });
  
  it('adapts to stress signals', async () => {
    const machine = new ProtocolStateMachine(fieldDiagnostic);
    
    const response = await machine.advance(
      'I feel completely overwhelmed and stuck'
    );
    
    expect(response.fieldState.type).toBe('stressed');
    expect(response.prompt).toContain('slow down');
  });
  
  it('validates minimum response length', async () => {
    const machine = new ProtocolStateMachine(fieldDiagnostic);
    machine.currentStage = machine.getStage('current_state');
    
    const response = await machine.advance('Nothing');
    
    expect(response.type).toBe('validation_failure');
    expect(response.prompt).toContain('take a moment');
  });
});
```

## Protocol Authoring Guidelines

When creating new protocols:

1. **Start with invariants**: What must NEVER happen?
2. **Define exit criteria**: How does success/completion look?
3. **Map the state space**: What are all possible states and transitions?
4. **Add empathy codec**: Where might stress/confusion/overwhelm appear?
5. **Test edge cases**: What if user says "I don't know" at every stage?
6. **Validate accessibility**: Can this work for non-native English speakers?
7. **Check consent**: Is exit always possible? Is purpose clear?

**Principle**: A protocol is a conversation scaffold, not a script. The AI and human co-create the path through it.

---

_Next: [Encoding Invariants](./04-invariants.md) for implementation patterns._
