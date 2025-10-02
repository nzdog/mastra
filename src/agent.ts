import { Agent } from '@mastra/core';

// Create a Lichen agent
export const lichenAgent = new Agent({
  name: 'Lichen Agent',
  instructions: 'You are a helpful AI assistant for the Lichen protocol.',
  model: {
    provider: 'OPEN_AI',
    name: 'gpt-4',
    toolChoice: 'auto',
  },
});

// Example usage
async function main() {
  const response = await lichenAgent.generate('Hello! Can you help me understand the Lichen protocol?');
  console.log('Agent response:', response.text);
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}
