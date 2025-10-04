import { ProtocolRegistry } from './tools/registry';
import { ProtocolParser } from './protocol/parser';

/**
 * Validates Claude's WALK mode output against the actual protocol content
 */
export class WalkResponseValidator {
  private registry: ProtocolRegistry;
  private parser: ProtocolParser;

  constructor(registry: ProtocolRegistry, protocolPath: string) {
    this.registry = registry;
    this.parser = new ProtocolParser(protocolPath);
  }

  /**
   * Check if Claude's response contains the correct theme content
   * Returns true if valid, false if hallucinating
   */
  validateThemeResponse(response: string, themeIndex: number): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Get the actual theme content
    const chunk = this.registry.retrieve('WALK', themeIndex);
    if (!chunk) {
      return { valid: true, issues: [] }; // Can't validate without chunk
    }

    const themeContent = this.parser.parseThemeContent(chunk.content);

    // Check 1: Theme title should be present
    const themeTitlePattern = new RegExp(`Theme ${themeIndex}\\s*[–-]\\s*${themeContent.title}`, 'i');
    if (!themeTitlePattern.test(response)) {
      issues.push(`Missing or incorrect theme title. Expected: "Theme ${themeIndex} – ${themeContent.title}"`);
    }

    // Check 2: All three guiding questions should be present (allowing for minor formatting differences)
    const questionsPresent = themeContent.questions.map(question => {
      // Normalize the question for matching (remove extra whitespace, case insensitive)
      const normalized = question.toLowerCase().replace(/\s+/g, ' ').trim();
      const responseNormalized = response.toLowerCase().replace(/\s+/g, ' ');
      return responseNormalized.includes(normalized);
    });

    const missingQuestions = themeContent.questions.filter((_, i) => !questionsPresent[i]);
    if (missingQuestions.length > 0) {
      issues.push(`Missing ${missingQuestions.length} guiding question(s): ${missingQuestions.join('; ')}`);
    }

    // Check 3: If awaiting confirmation, completion prompt should be present
    if (response.includes('Completion Prompt:')) {
      const completionPromptNormalized = themeContent.completion_prompt.toLowerCase().replace(/\s+/g, ' ').trim();
      const responseNormalized = response.toLowerCase().replace(/\s+/g, ' ');
      if (!responseNormalized.includes(completionPromptNormalized)) {
        issues.push(`Missing or incorrect completion prompt. Expected: "${themeContent.completion_prompt}"`);
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Generate a deterministic fallback response using the actual protocol content
   */
  generateDeterministicThemeResponse(
    themeIndex: number,
    awaitingConfirmation: boolean,
    userReflection?: string
  ): string {
    const chunk = this.registry.retrieve('WALK', themeIndex);
    if (!chunk) {
      return 'Error: Could not retrieve theme content.';
    }

    const themeContent = this.parser.parseThemeContent(chunk.content);
    const totalThemes = this.registry.getTotalThemes();

    if (!awaitingConfirmation) {
      // Presenting the theme
      let response = `**Theme ${themeIndex} – ${themeContent.title}**\n\n`;
      response += `**Frame:** ${themeContent.purpose}\n\n`;
      response += `**Guiding Questions:**\n`;
      themeContent.questions.forEach(q => {
        response += `• ${q}\n`;
      });
      response += `\nTake a moment with those, and when you're ready, share what comes up.`;
      return response;
    } else {
      // User shared reflection, provide completion prompt
      let response = '';

      if (userReflection) {
        response += `Thank you for sharing that reflection.\n\n`;
      }

      response += `**Completion Prompt:**\n`;
      response += `"${themeContent.completion_prompt}"\n\n`;

      if (themeIndex < totalThemes) {
        const nextChunk = this.registry.retrieve('WALK', themeIndex + 1);
        if (nextChunk) {
          const nextTheme = this.parser.parseThemeContent(nextChunk.content);
          response += `Shall we move into **Theme ${themeIndex + 1} – ${nextTheme.title}**?`;
        }
      } else {
        response += `That completes the diagnostic walk. Let me now synthesize what you've shared to name the field you're in.`;
      }

      return response;
    }
  }
}
