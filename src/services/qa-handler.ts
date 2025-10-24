/**
 * Q&A Handler Service
 *
 * Handles user questions about their field diagnosis using Claude API
 */

import Anthropic from '@anthropic-ai/sdk';

export interface QARequest {
  question: string;
  field_diagnosis: string;
  protocol_name: string;
  user_answers?: Record<number, string>; // Theme answers if available
}

export interface QAResponse {
  answer: string;
  timestamp: string;
}

/**
 * Answer user questions about their field diagnosis
 */
export async function answerFieldQuestion(
  apiKey: string,
  request: QARequest
): Promise<QAResponse> {
  const anthropic = new Anthropic({ apiKey });

  // Build context from field diagnosis and user answers
  let context = `# Field Diagnosis Context\n\n`;
  context += `**Protocol:** ${request.protocol_name}\n\n`;
  context += `**Diagnosed Field:**\n${request.field_diagnosis}\n\n`;

  if (request.user_answers && Object.keys(request.user_answers).length > 0) {
    context += `**User's Theme Answers:**\n`;
    Object.entries(request.user_answers).forEach(([themeIndex, answer]) => {
      context += `\nTheme ${themeIndex}: ${answer}\n`;
    });
  }

  const systemPrompt = `You are an expert guide helping someone understand their field diagnosis.

The user has completed a Field Diagnostic Protocol and received a diagnosis about the invisible field shaping their behavior and decisions.

Your role is to:
1. Answer questions clearly and directly
2. Draw on the specific context of their diagnosis
3. Provide practical, actionable insights when relevant
4. Maintain the protocol's tone: clear, nonjudgmental, factual
5. Help them see patterns and connections they might miss
6. Avoid generic advice - stay grounded in their specific diagnosis

**Key Concepts:**
- A "field" is the invisible architecture of forces shaping what feels normal, possible, or rewarded
- Fields train behavior through rewards and punishments
- Recognizing the field is the first step to choosing how to respond
- Fields aren't personal failures - they're systemic patterns

Be concise but thorough. Aim for 2-4 paragraphs per answer.`;

  const userMessage = `${context}\n\n**User Question:**\n${request.question}`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
      system: systemPrompt,
    });

    // Extract text content from response
    const answerText =
      message.content[0].type === 'text'
        ? message.content[0].text
        : 'Unable to generate response';

    return {
      answer: answerText,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error in Q&A handler:', error);
    throw new Error(
      `Failed to generate answer: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Validate question input
 */
export function validateQuestion(question: string): { valid: boolean; error?: string } {
  if (!question || typeof question !== 'string') {
    return { valid: false, error: 'Question must be a non-empty string' };
  }

  const trimmed = question.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: 'Question cannot be empty' };
  }

  if (trimmed.length < 5) {
    return { valid: false, error: 'Question too short (minimum 5 characters)' };
  }

  if (trimmed.length > 500) {
    return { valid: false, error: 'Question too long (maximum 500 characters)' };
  }

  return { valid: true };
}
