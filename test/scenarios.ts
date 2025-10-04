import * as dotenv from 'dotenv';
import { FieldDiagnosticAgent } from '../src/agent';

dotenv.config();

const API_KEY = process.env.ANTHROPIC_API_KEY;

if (!API_KEY) {
  console.error('Error: ANTHROPIC_API_KEY not found');
  process.exit(1);
}

interface TestScenario {
  name: string;
  messages: string[];
  expectedBehavior: string;
}

const scenarios: TestScenario[] = [
  {
    name: 'Greeting Test',
    messages: ['Hello'],
    expectedBehavior: 'Should respond naturally without retrieving protocol chunks',
  },
  {
    name: 'ENTRY Test',
    messages: ['What field am I in?'],
    expectedBehavior: 'Should enter ENTRY mode and provide orientation + invitation',
  },
  {
    name: 'WALK Transition',
    messages: ['What field am I in?', 'Walk me through it'],
    expectedBehavior: 'Should transition to WALK mode, Theme 1, and ask guiding question',
  },
  {
    name: 'Continuity Test',
    messages: [
      'What field am I in?',
      'Walk me through it',
      'I often use language about shipping fast and hitting deadlines',
      'continue',
    ],
    expectedBehavior: 'Should advance to Theme 2 after user answers Theme 1',
  },
  {
    name: 'Full Walk Test',
    messages: [
      'What field am I in?',
      'Yes, walk me through it',
      // Theme 1: Surface Behaviors
      'I use language about shipping fast, hitting deadlines, always pushing',
      'next',
      // Theme 2: Felt Experience
      'I feel tension in my chest and shoulders, like I can never rest',
      'continue',
      // Theme 3: Rewards and Punishments
      'Speed and output get praised. Slowing down feels like failure',
      'next',
      // Theme 4: Source Stories
      'The story here is ship or die. You are what you deliver',
      'continue',
      // Theme 5: Pressure Points
      'When things go wrong, the demand is to go faster, work harder',
      'next',
      // Theme 6: Naming the Field
      'Based on everything, I am in a velocity-obsessed field',
    ],
    expectedBehavior:
      'Should walk through all 6 themes, then transition to CLOSE mode with field diagnosis',
  },
];

async function runScenario(scenario: TestScenario) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`TEST: ${scenario.name}`);
  console.log(`EXPECTED: ${scenario.expectedBehavior}`);
  console.log('='.repeat(70));

  const agent = new FieldDiagnosticAgent(API_KEY!);

  for (let i = 0; i < scenario.messages.length; i++) {
    const message = scenario.messages[i];
    console.log(`\n[${i + 1}] USER: ${message}`);

    try {
      const response = await agent.processMessage(message);
      console.log(`\nAGENT: ${response}`);

      const state = agent.getState();
      console.log(
        `\nSTATE: mode=${state.mode}, theme=${state.theme_index}, confirmed=${state.last_completion_confirmed}`
      );
    } catch (error) {
      console.error(`\n❌ ERROR: ${error instanceof Error ? error.message : String(error)}`);
      break;
    }

    // Add delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log(`\n${'='.repeat(70)}\n`);
}

async function runAllTests() {
  console.log('\n🧪 Running Field Diagnostic Agent Test Scenarios\n');

  for (const scenario of scenarios) {
    await runScenario(scenario);

    // Longer delay between scenarios
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.log('\n✓ All test scenarios completed\n');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch((error) => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}
