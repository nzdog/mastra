import Anthropic from '@anthropic-ai/sdk';

export class ClaudeClient {
  private client: Anthropic;
  private model: string = 'claude-sonnet-4-20250514';

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  /**
   * Send a message to Claude and get a response
   */
  async sendMessage(
    systemPrompt: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    maxTokens: number = 2048
  ): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
    });

    const firstContent = response.content[0];
    if (firstContent.type === 'text') {
      return firstContent.text;
    }

    throw new Error('Unexpected response format from Claude');
  }

  /**
   * Get structured JSON response from Claude
   */
  async getStructuredResponse<T>(
    systemPrompt: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    maxTokens: number = 1024
  ): Promise<T> {
    const response = await this.sendMessage(systemPrompt, messages, maxTokens);

    // Try multiple extraction strategies
    let jsonString: string | null = null;

    // Strategy 1: Try to find JSON in code blocks
    const codeBlockMatch = response.match(/```json\n([\s\S]+?)\n```/);
    if (codeBlockMatch) {
      jsonString = codeBlockMatch[1];
    }

    // Strategy 2: Try to find JSON object (handle nested braces properly)
    if (!jsonString) {
      const startIdx = response.indexOf('{');
      if (startIdx !== -1) {
        let braceCount = 0;
        let endIdx = -1;

        for (let i = startIdx; i < response.length; i++) {
          if (response[i] === '{') braceCount++;
          if (response[i] === '}') braceCount--;

          if (braceCount === 0) {
            endIdx = i;
            break;
          }
        }

        if (endIdx !== -1) {
          jsonString = response.substring(startIdx, endIdx + 1);
        }
      }
    }

    // Strategy 3: Clean up common issues
    if (!jsonString) {
      // Remove any markdown or extra text, try to extract just the JSON
      const cleaned = response.trim();
      if (cleaned.startsWith('{') && cleaned.includes('}')) {
        const endBrace = cleaned.lastIndexOf('}');
        jsonString = cleaned.substring(0, endBrace + 1);
      }
    }

    if (!jsonString) {
      // Return a safe default classification for cases where no JSON is found
      // This typically happens when the model responds naturally instead of with JSON
      return {
        intent: 'memory',
        continuity: true,
        protocol_pointer: {
          protocol_slug: 'field_diagnostic',
          theme_index: null,
        },
        confidence: 0.5,
      } as T;
    }

    try {
      const parsed = JSON.parse(jsonString) as T;

      // Add default confidence if missing (common issue with classifier)
      if (parsed && typeof parsed === 'object' && 'intent' in parsed && !('confidence' in parsed)) {
        (parsed as any).confidence = 0.7;
      }

      return parsed;
    } catch (parseError) {
      console.error('Failed to parse JSON:', jsonString);
      console.error('Parse error:', parseError);
      throw new Error(`Failed to parse JSON: ${parseError}`);
    }
  }
}
