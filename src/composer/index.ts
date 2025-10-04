import { ClaudeClient } from './client';
import { ENTRY_PROMPT, WALK_PROMPT, CLOSE_PROMPT } from './prompts';
import { Mode, ConversationTurn, ProtocolChunk } from '../types';

export class Composer {
  private client: ClaudeClient;

  constructor(apiKey: string) {
    this.client = new ClaudeClient(apiKey);
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

    return await this.client.sendMessage(systemPrompt, messages);
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
