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
   * Escape special regex characters in a string
   */
  private escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

    // Check 1: Theme title should be present and exact
    const themeTitlePattern = new RegExp(`Theme ${themeIndex}\\s*[–-]\\s*${this.escapeRegExp(themeContent.title)}`, 'i');
    if (!themeTitlePattern.test(response)) {
      issues.push(`Missing or incorrect theme title. Expected: "Theme ${themeIndex} – ${themeContent.title}"`);
    }

    // Additional check: make sure it's not using a completely different theme title
    const wrongThemeTitles = [
      'Underlying Assumptions',
      'Field Recognition',
      'Field Effects',
      'Current Field Signature',
      'Checking the Signal',
      'Spotting Distortions',
    ];

    for (const wrongTitle of wrongThemeTitles) {
      if (response.includes(wrongTitle)) {
        issues.push(`Hallucinated theme title detected: "${wrongTitle}". Expected: "${themeContent.title}"`);
      }
    }

    // Check 2: All three guiding questions should be present (strict matching)
    const questionsPresent = themeContent.questions.map(question => {
      // Normalize for matching but keep it strict - must match at least 70% of the question
      const questionWords = question.toLowerCase().split(/\s+/);
      const responseNormalized = response.toLowerCase().replace(/\s+/g, ' ');

      // Count how many words from the question appear in the response
      const matchedWords = questionWords.filter(word =>
        word.length > 3 && responseNormalized.includes(word)
      );

      // Require at least 70% of significant words to match
      const matchRatio = matchedWords.length / questionWords.filter(w => w.length > 3).length;
      return matchRatio >= 0.7;
    });

    const missingQuestions = themeContent.questions.filter((_, i) => !questionsPresent[i]);
    if (missingQuestions.length > 0) {
      issues.push(`Missing or altered ${missingQuestions.length} guiding question(s). Expected these exact questions: ${missingQuestions.join(' | ')}`);
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
