import { ClaudeClient } from './composer/client';
import { CLASSIFIER_PROMPT } from './composer/prompts';
import { ClassificationResult, ConversationTurn, SessionState } from './types';

export class IntentClassifier {
  private client: ClaudeClient;

  constructor(apiKey: string) {
    this.client = new ClaudeClient(apiKey);
  }

  /**
   * Classify user intent based on conversation history and current state
   */
  async classify(
    userMessage: string,
    conversationHistory: ConversationTurn[],
    state: SessionState
  ): Promise<ClassificationResult> {
    // Build context for classifier
    const contextMessage = this.buildContextMessage(conversationHistory, state, userMessage);

    try {
      const result = await this.client.getStructuredResponse<ClassificationResult>(
        CLASSIFIER_PROMPT,
        [{ role: 'user', content: contextMessage }],
        512
      );

      // Apply fallback rules
      return this.applyFallbackRules(result, state);
    } catch (error) {
      console.error('Classification error:', error);
      // Fallback to safe default
      return {
        intent: 'discover',
        continuity: false,
        protocol_pointer: {
          protocol_slug: 'field_diagnostic',
          theme_index: null,
        },
        confidence: 0.5,
      };
    }
  }

  /**
   * Build context message for the classifier
   */
  private buildContextMessage(
    conversationHistory: ConversationTurn[],
    state: SessionState,
    userMessage: string
  ): string {
    const recentTurns = conversationHistory.slice(-6); // Last 6 turns

    let context = '=== CONTEXT ===\n';
    context += `Active Protocol: ${state.active_protocol || 'none'}\n`;
    context += `Current Mode: ${state.mode}\n`;
    context += `Theme Index: ${state.theme_index ?? 'none'}\n`;
    context += `Last Completion Confirmed: ${state.last_completion_confirmed}\n`;
    context += `Turn Counter: ${state.turn_counter}\n\n`;

    if (recentTurns.length > 0) {
      context += '=== RECENT CONVERSATION ===\n';
      recentTurns.forEach((turn) => {
        context += `${turn.role.toUpperCase()}: ${turn.content}\n`;
      });
      context += '\n';
    }

    context += '=== CURRENT USER MESSAGE ===\n';
    context += userMessage;

    return context;
  }

  /**
   * Apply fallback rules to classification result
   */
  private applyFallbackRules(
    result: ClassificationResult,
    state: SessionState
  ): ClassificationResult {
    // If confidence < 0.55 → default to ENTRY mode
    if (result.confidence < 0.55) {
      return {
        intent: 'discover',
        continuity: false,
        protocol_pointer: {
          protocol_slug: 'field_diagnostic',
          theme_index: null,
        },
        confidence: result.confidence,
      };
    }

    // If intent=walk but no active protocol → downgrade to ENTRY
    if (result.intent === 'walk' && !state.active_protocol) {
      return {
        ...result,
        intent: 'discover',
        continuity: false,
      };
    }

    // If intent=memory but no prior state → ENTRY
    if (result.intent === 'memory' && !state.active_protocol) {
      return {
        ...result,
        intent: 'discover',
        continuity: false,
      };
    }

    return result;
  }
}
