import { ClaudeClient } from './client';
import { ENTRY_PROMPT, WALK_PROMPT, CLOSE_PROMPT } from './prompts';
import { Mode, ConversationTurn, ProtocolChunk } from '../types';
import { WalkResponseValidator } from '../validator';
import * as path from 'path';

export class Composer {
  private client: ClaudeClient;
  private validator: WalkResponseValidator | null = null;

  constructor(apiKey: string, validator?: WalkResponseValidator) {
    this.client = new ClaudeClient(apiKey);
    this.validator = validator || null;
  }

  /**
   * Generate a response based on mode, chunk, and conversation history
   */
  async compose(
    mode: Mode,
    chunk: ProtocolChunk | null,
    conversationHistory: ConversationTurn[],
    userMessage: string,
    context?: {
      themeAnswers?: Map<number, string>;
      currentThemeIndex?: number;
      currentThemeTitle?: string;
      nextThemeTitle?: string;
      awaitingConfirmation?: boolean;
      intent?: string;
    }
  ): Promise<string> {
    const systemPrompt = this.getSystemPrompt(mode);
    const messages = this.buildMessages(mode, chunk, conversationHistory, userMessage, context);

    console.log(`\n📝 COMPOSER: Mode = ${mode}, Theme = ${context?.currentThemeIndex || 'N/A'}, Awaiting = ${context?.awaitingConfirmation || false}`);

    let response = await this.client.sendMessage(systemPrompt, messages);

    if (response.length > 500) {
      console.log(`\n📤 COMPOSER RESPONSE (first 200 chars):\n${response.substring(0, 200)}...`);
      console.log(`\n📤 COMPOSER RESPONSE (last 200 chars):\n...${response.substring(response.length - 200)}`);
    } else {
      console.log(`\n📤 COMPOSER FULL RESPONSE:\n${response}`);
    }

    // Validate WALK mode responses
    // SKIP validation if user is asking for clarification (discover intent)
    const isClarification = context?.intent === 'discover';

    console.log(`\n🔍 VALIDATOR CHECK:`);
    console.log(`   mode=${mode}, hasValidator=${!!this.validator}, themeIndex=${context?.currentThemeIndex}, isClarification=${isClarification}`);
    console.log(`   awaitingConfirmation=${context?.awaitingConfirmation}, intent=${context?.intent}`);

    // TEMPORARILY DISABLED: Validator is too strict for new template system
    // TODO: Update validator to work with new flexible templates
    const VALIDATION_DISABLED = true;

    // Only validate when showing interpretation (awaitingConfirmation = true)
    // Skip validation when showing new theme questions (awaitingConfirmation = false)
    if (mode === 'WALK' && this.validator && context?.currentThemeIndex && context?.awaitingConfirmation && !isClarification && !VALIDATION_DISABLED) {
      console.log('🔍 VALIDATOR: Running validation...');
      const validation = this.validator.validateThemeResponse(
        response,
        context.currentThemeIndex,
        context.awaitingConfirmation || false
      );

      if (!validation.valid) {
        console.log('\n⚠️  VALIDATOR FAILED. Issues detected:');
        validation.issues.forEach(issue => console.log(`   - ${issue}`));

        // Try once more with stronger guardrails
        // console.log('🔄 Retrying with stronger constraints...\n');

        const strengthenedPrompt = systemPrompt + '\n\nWARNING: Your previous response did not follow the protocol exactly. You MUST copy the theme title and guiding questions WORD FOR WORD from the theme content. DO NOT improvise.';
        response = await this.client.sendMessage(strengthenedPrompt, messages);

        // Validate again
        const secondValidation = this.validator.validateThemeResponse(
          response,
          context.currentThemeIndex,
          context.awaitingConfirmation || false
        );

        if (!secondValidation.valid) {
          console.log('⚠️  VALIDATOR: Second validation failed. Using deterministic fallback.\n');

          // Use deterministic fallback
          response = (
            '⚠️  Hang on, I was hallucinating. Let me try again.\n\n' +
            this.validator.generateDeterministicThemeResponse(
              context.currentThemeIndex,
              context.awaitingConfirmation || false,
              userMessage
            )
          );
        }
      }

      // If awaiting confirmation, inject next theme mention deterministically
      if (context.awaitingConfirmation && this.validator) {
        const nextThemeIndex = context.currentThemeIndex + 1;
        const nextThemeChunk = this.validator.getRegistry().retrieve('WALK', nextThemeIndex);

        if (nextThemeChunk) {
          const nextThemeContent = this.validator.getParser().parseThemeContent(nextThemeChunk.content);

          // Remove any existing theme mention from Claude (might be hallucinated)
          // Pattern: "Shall we move into **Theme X – [anything]**?"
          const themePattern = new RegExp(`Shall we move into \\*\\*Theme ${nextThemeIndex}[^?]+\\?`, 'g');
          response = response.replace(themePattern, '').trim();

          // Always inject the correct theme mention
          // console.log(`✅ COMPOSER: Injecting next theme mention: Theme ${nextThemeIndex} – ${nextThemeContent.title}`);
          response += `\n\nShall we move into **Theme ${nextThemeIndex} – ${nextThemeContent.title}**?`;
        } else {
          // Last theme - move to CLOSE
          // Remove any hallucinated theme mention
          const themePattern = /Shall we move into \*\*Theme \d+[^?]+\?/g;
          response = response.replace(themePattern, '').trim();

          // console.log('✅ COMPOSER: Injecting field diagnosis transition');
          response += '\n\nReady to diagnose the field?';
        }
      }
    }

    return response;
  }

  /**
   * Get the appropriate system prompt for the mode
   */
  private getSystemPrompt(mode: Mode): string {
    switch (mode) {
      case 'ENTRY':
        return ENTRY_PROMPT;
      case 'WALK':
        return WALK_PROMPT;
      case 'CLOSE':
        return CLOSE_PROMPT;
      default:
        return ENTRY_PROMPT;
    }
  }

  /**
   * Build messages array for Claude API
   */
  private buildMessages(
    mode: Mode,
    chunk: ProtocolChunk | null,
    conversationHistory: ConversationTurn[],
    userMessage: string,
    context?: {
      themeAnswers?: Map<number, string>;
      currentThemeIndex?: number;
      currentThemeTitle?: string;
      nextThemeTitle?: string;
      awaitingConfirmation?: boolean;
    }
  ): Array<{ role: 'user' | 'assistant'; content: string }> {
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    // Add conversation history (last 6 turns for context)
    const recentHistory = conversationHistory.slice(-6);
    messages.push(...recentHistory);

    // Build the current user message with context
    let currentMessage = '';

    if (mode === 'ENTRY' && chunk) {
      currentMessage = `=== PROTOCOL CONTENT ===\n${chunk.content}\n\n`;
      currentMessage += `=== USER MESSAGE ===\n${userMessage}`;
    } else if (mode === 'WALK' && chunk) {
      currentMessage = `=== CURRENT THEME (Theme ${chunk.theme_index}) ===\n${chunk.content}\n\n`;
      currentMessage += `=== STATE ===\n`;
      currentMessage += `Current Theme Index: ${context?.currentThemeIndex ?? 1}\n`;
      currentMessage += `Current Theme Title: ${context?.currentThemeTitle || 'Unknown'}\n`;
      currentMessage += `Next Theme Title: ${context?.nextThemeTitle || 'None (final theme)'}\n`;
      currentMessage += `Awaiting Confirmation: ${context?.awaitingConfirmation ? 'YES - user returned to a theme they already answered' : 'NO - present theme with Purpose + Why this matters + Outcomes + all 3 Guiding Questions together'}\n`;
      currentMessage += `Total Themes: 6\n\n`;

      // If returning to a theme they already answered, show their previous answer
      if (context?.awaitingConfirmation && context?.currentThemeIndex && context?.themeAnswers) {
        const previousAnswer = context.themeAnswers.get(context.currentThemeIndex);
        if (previousAnswer) {
          currentMessage += `=== PREVIOUS ANSWER FROM THIS THEME ===\n`;
          currentMessage += `${previousAnswer}\n\n`;
        }
      }

      // If user is asking for evidence (Theme 6), include their previous answers
      if (context?.currentThemeIndex === 6 && context?.themeAnswers && context.themeAnswers.size > 0) {
        currentMessage += `=== EVIDENCE FROM PREVIOUS THEMES ===\n`;
        context.themeAnswers.forEach((answer, themeIndex) => {
          currentMessage += `Theme ${themeIndex}: ${answer}\n`;
        });
        currentMessage += `\n`;
      }

      currentMessage += `=== USER MESSAGE ===\n${userMessage}`;
    } else if (mode === 'CLOSE' && context?.themeAnswers) {
      currentMessage = `=== USER'S ANSWERS ACROSS ALL THEMES ===\n\n`;

      context.themeAnswers.forEach((answer, themeIndex) => {
        currentMessage += `Theme ${themeIndex}:\n${answer}\n\n`;
      });

      currentMessage += `=== TASK ===\nSynthesize these answers and diagnose the field. Use the user's language to identify the underlying pattern.\n\n`;
      currentMessage += `User says: ${userMessage}`;
    } else {
      currentMessage = userMessage;
    }

    messages.push({ role: 'user', content: currentMessage });

    return messages;
  }
}
