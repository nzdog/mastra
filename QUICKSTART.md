# Quick Start Guide

## Setup (5 minutes)

1. **Set your API key**:

   ```bash
   cp .env.example .env
   # Edit .env and add your Anthropic API key
   ```

2. **Install dependencies** (if not already done):

   ```bash
   npm install
   ```

3. **Run the agent**:
   ```bash
   npm run dev
   ```

## First Conversation

Try this sequence:

```
> What field am I in?

[Agent provides orientation]

> Yes, walk me through it

[Agent asks Theme 1 question about Surface Behaviors]

> I use language about shipping fast and hitting deadlines

[Agent mirrors back and validates]

> continue

[Agent moves to Theme 2: Felt Experience]
```

## Commands

- `exit` or `quit` - End session
- `reset` - Start over
- `state` - View current session state
- `help` - Show help

## Full Protocol Flow

1. **ENTRY** - Orientation and invitation
2. **WALK** - 6 themes, one question at a time:
   - Theme 1: Surface Behaviors
   - Theme 2: Felt Experience
   - Theme 3: Rewards and Punishments
   - Theme 4: Source Stories
   - Theme 5: Pressure Points
   - Theme 6: Naming the Field
3. **CLOSE** - Field diagnosis with pattern-level name

## Testing

Run automated test scenarios:

```bash
npm test
```

This will run 5 test scenarios to verify all modes work correctly.

## Troubleshooting

**API Key Error**: Make sure `.env` exists and contains:

```
ANTHROPIC_API_KEY=sk-ant-...
```

**Build Errors**: Run `npm run build` to check TypeScript compilation

**Rate Limiting**: The test suite includes delays to avoid rate limits

## Architecture Overview

```
User Input
    ↓
Intent Classifier (AI) → Classification
    ↓
Mode Determiner → ENTRY | WALK | CLOSE
    ↓
Retrieval (chunk selection)
    ↓
Composer (response generation)
    ↓
State Update
    ↓
Response to User
```

## Next Steps

- Read the full [README.md](./README.md) for detailed architecture
- Explore the protocol file: `protocols/field_diagnostic.md`
- Review system prompts: `src/composer/prompts.ts`
- Check state management: `src/agent.ts`
