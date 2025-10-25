import { ProtocolParser } from './protocol/parser';
import { ProtocolRegistry } from './tools/registry';

/**
 * Walk Response Validator - Ensures Claude's responses match actual protocol content
 *
 * This validator prevents hallucination by verifying that the agent's WALK mode
 * responses contain the correct theme content from the protocol. It checks:
 * - Theme titles match exactly
 * - Questions are present and accurate
 * - No fabricated content is included
 *
 * **Purpose:** Maintain protocol fidelity and prevent LLM hallucination
 *
 * @example
 * ```typescript
 * const validator = new WalkResponseValidator(registry, protocolPath);
 * const result = validator.validateThemeResponse(
 *   claudeResponse,
 *   themeIndex,
 *   awaitingConfirmation
 * );
 * if (!result.valid) {
 *   console.error('Hallucination detected:', result.issues);
 * }
 * ```
 */
export class WalkResponseValidator {
  private registry: ProtocolRegistry;
  private parser: ProtocolParser;

  /**
   * Create a new WalkResponseValidator
   *
   * @param registry - Protocol registry containing theme chunks
   * @param protocolPath - Path to the protocol markdown file
   */
  constructor(registry: ProtocolRegistry, protocolPath: string) {
    this.registry = registry;
    this.parser = new ProtocolParser(protocolPath);
  }

  /**
   * Get the registry (for injecting next theme mentions)
   */
  getRegistry(): ProtocolRegistry {
    return this.registry;
  }

  /**
   * Get the parser (for parsing theme content)
   */
  getParser(): ProtocolParser {
    return this.parser;
  }

  /**
   * Escape special regex characters in a string
   */
  private escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Check if Claude's response contains the correct theme content
   *
   * Validates that the response includes the expected theme title and questions
   * from the protocol, preventing hallucination and ensuring protocol fidelity.
   *
   * @param response - Claude's generated response to validate
   * @param themeIndex - The theme number being presented (0-based)
   * @param awaitingConfirmation - Whether we're in the confirmation/reflection phase
   * @returns Object with `valid` boolean and array of `issues` found
   *
   * @example
   * ```typescript
   * const result = validator.validateThemeResponse(
   *   "### Theme 1: The Field\n\nQuestion 1: What field are you in?",
   *   0,
   *   false
   * );
   * console.log(result.valid); // true if content matches protocol
   * console.log(result.issues); // [] if valid, or list of problems
   * ```
   */
  validateThemeResponse(
    response: string,
    themeIndex: number,
    awaitingConfirmation: boolean = false
  ): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    // console.log('\n🔍 VALIDATOR: Starting validation for Theme', themeIndex);
    // console.log('📋 VALIDATOR: Awaiting confirmation:', awaitingConfirmation);

    // Get the actual theme content
    const chunk = this.registry.retrieve('WALK', themeIndex);
    if (!chunk) {
      // console.log('⚠️  VALIDATOR: No chunk found for theme', themeIndex);
      return { valid: true, issues: [] }; // Can't validate without chunk
    }

    const themeContent = this.parser.parseThemeContent(chunk.content);
    // console.log('📋 VALIDATOR: Expected theme title:', themeContent.title);

    if (!awaitingConfirmation) {
      // console.log('📋 VALIDATOR: Expected questions:');
      // themeContent.questions.forEach((q, i) => console.log(`   ${i + 1}. ${q}`));
    } else {
      // console.log('📋 VALIDATOR: Expected completion prompt:', themeContent.completion_prompt);
    }

    // When awaiting confirmation, we expect interpretation + completion prompt, NOT questions
    // So we should validate differently
    if (awaitingConfirmation) {
      // Check 1: Should contain the completion prompt
      const completionPromptNormalized = themeContent.completion_prompt
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
      const responseNormalized = response.toLowerCase().replace(/\s+/g, ' ');
      const hasCompletionPrompt = responseNormalized.includes(completionPromptNormalized);

      // console.log('🔍 VALIDATOR: Completion prompt match:', hasCompletionPrompt);

      if (!hasCompletionPrompt) {
        // console.log('❌ VALIDATOR: Missing completion prompt');
        issues.push(`Missing completion prompt. Expected: "${themeContent.completion_prompt}"`);
      }

      // Check 2: Should NOT re-present all the guiding questions (interpretation is okay, but not the formal question list)
      const hasGuidingQuestionsHeader = response.includes('**Guiding Questions:**');
      if (hasGuidingQuestionsHeader) {
        // console.log('❌ VALIDATOR: Should not re-present guiding questions when awaiting confirmation');
        issues.push(
          'Should provide interpretation + completion prompt, not re-present guiding questions'
        );
      }

      // Don't check for next theme mention - we'll inject it deterministically
      // console.log('✅ VALIDATOR: Skipping next theme mention check (will be injected)');

      return { valid: issues.length === 0, issues };
    }

    // Normal validation (when NOT awaiting confirmation - presenting theme questions)
    // Check 1: Theme title should be present and exact
    const themeTitlePattern = new RegExp(
      `Theme ${themeIndex}\\s*[–-]\\s*${this.escapeRegExp(themeContent.title)}`,
      'i'
    );
    const titleMatch = themeTitlePattern.test(response);
    // console.log('🔍 VALIDATOR: Theme title match:', titleMatch);

    if (!titleMatch) {
      // Extract what title was actually used
      const actualTitleMatch = response.match(/Theme \d+\s*[–-]\s*([^*\n]+)/);
      const actualTitle = actualTitleMatch ? actualTitleMatch[1].trim() : 'NOT FOUND';
      // console.log('❌ VALIDATOR: Actual title found:', actualTitle);
      issues.push(
        `Missing or incorrect theme title. Expected: "Theme ${themeIndex} – ${themeContent.title}", Got: "${actualTitle}"`
      );
    }

    // Additional check: make sure it's not using a completely different theme title
    // These are common hallucinations Claude makes up
    const wrongThemeTitles = [
      'Underlying Assumptions',
      'Field Recognition',
      'Field Effects',
      'Current Field Signature',
      'Checking the Signal',
      'Spotting Distortions',
      'Field Diagnosis',
      'Identifying the Field',
      'Decision-making patterns',
      'Field Gravity',
    ];

    for (const wrongTitle of wrongThemeTitles) {
      if (response.includes(wrongTitle)) {
        // console.log('❌ VALIDATOR: Hallucinated title detected:', wrongTitle);
        issues.push(
          `Hallucinated theme title detected: "${wrongTitle}". Expected: "${themeContent.title}"`
        );
      }
    }

    // Check 2: All three guiding questions should be present (EXACT matching)
    // console.log('\n🔍 VALIDATOR: Checking questions...');
    const questionsPresent = themeContent.questions.map((question, _idx) => {
      // Normalize whitespace but require exact text match
      const questionNormalized = question.toLowerCase().replace(/\s+/g, ' ').trim();
      const responseNormalized = response.toLowerCase().replace(/\s+/g, ' ');

      // Check if the exact question text appears in the response
      // Allow for bullet points and formatting but text must match exactly
      const found = responseNormalized.includes(questionNormalized);
      // console.log(`   Q${idx + 1} match:`, found ? '✅' : '❌');
      if (!found) {
        // console.log(`      Expected: "${question}"`);
      }
      return found;
    });

    const missingQuestions = themeContent.questions.filter((_, i) => !questionsPresent[i]);
    if (missingQuestions.length > 0) {
      // console.log('❌ VALIDATOR:', missingQuestions.length, 'question(s) missing or altered');
      issues.push(
        `Missing or altered ${missingQuestions.length} guiding question(s). Expected exact text: ${missingQuestions.join(' | ')}`
      );
    }

    // Check 3: If awaiting confirmation, completion prompt should be present
    if (response.includes('Completion Prompt:')) {
      const completionPromptNormalized = themeContent.completion_prompt
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
      const responseNormalized = response.toLowerCase().replace(/\s+/g, ' ');
      if (!responseNormalized.includes(completionPromptNormalized)) {
        issues.push(
          `Missing or incorrect completion prompt. Expected: "${themeContent.completion_prompt}"`
        );
      }
    }

    const isValid = issues.length === 0;
    // console.log('\n🔍 VALIDATOR: Validation result:', isValid ? '✅ VALID' : '❌ INVALID');
    if (!isValid) {
      // console.log('📋 VALIDATOR: Issues found:', issues.length);
      // issues.forEach((issue, i) => console.log(`   ${i + 1}. ${issue}`));
    }

    return {
      valid: isValid,
      issues,
    };
  }

  /**
   * Generate a deterministic fallback response using the actual protocol content
   */
  generateDeterministicThemeResponse(
    themeIndex: number,
    awaitingConfirmation: boolean,
    _userReflection?: string
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
      themeContent.questions.forEach((q) => {
        response += `• ${q}\n`;
      });
      response += `\nTake a moment with those, and when you're ready, share what comes up.`;
      return response;
    } else {
      // User shared reflection, provide completion prompt
      let response = '';

      // Don't add pleasantries in fallback - we're correcting a hallucination

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
