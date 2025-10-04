#!/usr/bin/env node

import * as readline from 'readline';
import * as dotenv from 'dotenv';
import { FieldDiagnosticAgent } from './agent';

// Load environment variables
dotenv.config();

const API_KEY = process.env.ANTHROPIC_API_KEY;

if (!API_KEY) {
  console.error('Error: ANTHROPIC_API_KEY not found in environment variables.');
  console.error('Please create a .env file with your API key:');
  console.error('  ANTHROPIC_API_KEY=your_key_here');
  process.exit(1);
}

// Create agent
const agent = new FieldDiagnosticAgent(API_KEY);

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '\n> ',
});

// Welcome message
console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║                                                                ║');
console.log('║           Field Diagnostic Protocol - Lichen Agent             ║');
console.log('║                                                                ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');
console.log('Welcome to the Field Diagnostic Protocol.');
console.log('This protocol helps surface the invisible field shaping your');
console.log('behavior, decisions, and emotional stance.\n');
console.log('Commands:');
console.log('  - Type "exit" or "quit" to end the session');
console.log('  - Type "reset" to start over');
console.log('  - Type "state" to see current session state');
console.log('  - Type "help" for more information\n');
console.log('Ready to begin.\n');

rl.prompt();

rl.on('line', async (line: string) => {
  const input = line.trim();

  if (!input) {
    rl.prompt();
    return;
  }

  // Handle commands
  if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
    console.log('\nThank you for using the Field Diagnostic Protocol.');
    console.log('May you carry forward clarity about where you stand.\n');
    rl.close();
    process.exit(0);
  }

  if (input.toLowerCase() === 'reset') {
    agent.reset();
    console.log('\n✓ Session reset. Starting fresh.\n');
    rl.prompt();
    return;
  }

  if (input.toLowerCase() === 'state') {
    const state = agent.getState();
    console.log('\n=== Current Session State ===');
    console.log(JSON.stringify(state, null, 2));
    console.log('');
    rl.prompt();
    return;
  }

  if (input.toLowerCase() === 'help') {
    console.log('\n=== Help ===');
    console.log('The Field Diagnostic Protocol walks you through 6 themes to help');
    console.log('identify the invisible field currently shaping your behavior.\n');
    console.log('Try asking:');
    console.log('  - "What field am I in?"');
    console.log('  - "Walk me through the protocol"');
    console.log('  - "Continue" (to move to the next theme)\n');
    console.log('Commands:');
    console.log('  - exit/quit: End session');
    console.log('  - reset: Start over');
    console.log('  - state: View current state\n');
    rl.prompt();
    return;
  }

  // Process message with agent
  try {
    console.log(''); // Add spacing

    const response = await agent.processMessage(input);
    console.log(response);

    rl.prompt();
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : String(error));
    console.log('Please try again.\n');
    rl.prompt();
  }
});

rl.on('close', () => {
  console.log('\nGoodbye.\n');
  process.exit(0);
});

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('\n❌ Unhandled error:', error);
  process.exit(1);
});
