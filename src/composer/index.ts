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
      awaitingConfirmation?: boolean;
    }
  ): Promise<string> {
    const systemPrompt = this.getSystemPrompt(mode);
    const messages = this.buildMessages(mode, chunk, conversationHistory, userMessage, context);

    // console.log(`\n📝 COMPOSER: Mode = ${mode}, Theme = ${context?.currentThemeIndex || 'N/A'}, Awaiting = ${context?.awaitingConfirmation || false}`);

    let response = await this.client.sendMessage(systemPrompt, messages);

    // Validate WALK mode responses
    // SKIP validation if user is asking for clarification (discover intent)
    // We detect this by checking if the user message looks like a question
    const isClarification = userMessage.toLowerCase().includes('evidence') ||
                            userMessage.toLowerCase().includes('what do you mean') ||
                            userMessage.toLowerCase().includes('example') ||
                            userMessage.toLowerCase().includes('clarif');

    if (mode === 'WALK' && this.validator && context?.currentThemeIndex && !isClarification) {
      // console.log('🔍 COMPOSER: Running validation...');
      const validation = this.validator.validateThemeResponse(
        response,
        context.currentThemeIndex,
        context.awaitingConfirmation || false
      );

      if (!validation.valid) {
        // console.log('\n⚠️  Validation failed. Issues detected:');
        validation.issues.forEach(issue => // console.log(`   - ${issue}`));

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
          // console.log('⚠️  Second validation failed. Using deterministic fallback.\n');

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
      currentMessage += `Awaiting Confirmation: ${context?.awaitingConfirmation ? 'YES - user just shared their reflection, provide interpretation + completion prompt' : 'NO - present theme with Frame + all 3 Guiding Questions together'}\n`;
      currentMessage += `Total Themes: 6\n\n`;

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
