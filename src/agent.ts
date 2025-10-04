import { IntentClassifier } from './classifier';
import { Composer } from './composer';
import { ProtocolRegistry } from './tools/registry';
import { loadProtocol } from './protocol/parser';
import { WalkResponseValidator } from './validator';
import * as path from 'path';
import {
  SessionState,
  ConversationTurn,
  Mode,
  ClassificationResult,
  Intent,
} from './types';

export class FieldDiagnosticAgent {
  private classifier: IntentClassifier;
  private composer: Composer;
  private registry: ProtocolRegistry;
  private validator: WalkResponseValidator;
  private state: SessionState;
  private conversationHistory: ConversationTurn[] = [];
  private themeAnswers: Map<number, string> = new Map();

  constructor(apiKey: string) {
    this.classifier = new IntentClassifier(apiKey);

    // Load protocol
    const protocol = loadProtocol();
    this.registry = new ProtocolRegistry(protocol);

    // Create validator
    const protocolPath = path.join(__dirname, '../protocols/field_diagnostic.md');
    this.validator = new WalkResponseValidator(this.registry, protocolPath);

    // Create composer with validator
    this.composer = new Composer(apiKey, this.validator);

    // Initialize state
    this.state = this.createInitialState();
  }

  /**
   * Process a user message and return agent response
   */
  async processMessage(userMessage: string): Promise<string> {
    // Add user message to history
    this.conversationHistory.push({
      role: 'user',
      content: userMessage,
    });

    // Step 1: Classify intent
    const classification = await this.classifier.classify(
      userMessage,
      this.conversationHistory,
      this.state
    );

    // Step 2: Determine mode
    const mode = this.determineMode(classification);

    // Step 3: Determine theme index for this response (before state update)
    const themeIndexForResponse = this.getThemeIndexForResponse(mode, classification);

    // Step 3b: Determine awaiting confirmation state for this response
    const awaitingConfirmationForResponse = this.getAwaitingConfirmationForResponse(mode, classification);

    // Step 4: Retrieve appropriate chunk
    const chunk = this.registry.retrieve(mode, themeIndexForResponse);

    // Step 5: Compose response
    const response = await this.composer.compose(
      mode,
      chunk,
      this.conversationHistory,
      userMessage,
      {
        themeAnswers: this.themeAnswers,
        currentThemeIndex: themeIndexForResponse ?? undefined,
        awaitingConfirmation: awaitingConfirmationForResponse,
      }
    );

    // Step 6: Store user's answer BEFORE updating last_response
    // (need to check the PREVIOUS state to know if they just answered questions)
    // BUT: Don't store if they're asking for clarification (discover intent)
    if (mode === 'WALK' &&
        this.state.last_response === 'theme_questions' &&
        (classification.continuity || classification.intent === 'memory') &&
        classification.intent !== 'discover' &&
        themeIndexForResponse !== null) {
      this.themeAnswers.set(themeIndexForResponse, userMessage);
      console.log(`📝 AGENT: Stored answer for theme ${themeIndexForResponse}`);
    }

    // Step 7: Track what we just showed the user
    if (mode === 'WALK') {
      if (awaitingConfirmationForResponse) {
        this.state.last_response = 'interpretation_and_completion';
        console.log('📌 AGENT: Set last_response = interpretation_and_completion');
      } else {
        this.state.last_response = 'theme_questions';
        console.log('📌 AGENT: Set last_response = theme_questions');
      }
    }

    // Step 8: Update state
    this.updateState(mode, classification, userMessage, themeIndexForResponse);

    // Add assistant response to history
    this.conversationHistory.push({
      role: 'assistant',
      content: response,
    });

    return response;
  }

  /**
   * Determine what theme index will be used for this response
   * This needs to be calculated before state update but match the logic of updateState
   */
  private getThemeIndexForResponse(mode: Mode, classification: ClassificationResult): number | null {
    console.log(`\n🔍 AGENT: getThemeIndexForResponse - mode=${mode}, intent=${classification.intent}, current_theme=${this.state.theme_index}`);
    console.log(`   last_response=${this.state.last_response}`);

    if (mode !== 'WALK') {
      console.log('   → Returning null (not WALK mode)');
      return null;
    }

    // Starting the walk - handles both 'walk' intent and 'memory' when theme is null
    if (this.state.theme_index === null && (classification.intent === 'walk' || classification.intent === 'memory')) {
      console.log('   → Starting walk, returning 1');
      return 1;
    }

    // If we just showed interpretation + completion and user says continuity/memory (like "go", "yes"),
    // advance to next theme
    if (this.state.last_response === 'interpretation_and_completion' &&
        (classification.continuity || classification.intent === 'memory') &&
        this.state.theme_index !== null) {
      const totalThemes = this.registry.getTotalThemes();
      if (this.state.theme_index < totalThemes) {
        const nextTheme = this.state.theme_index + 1;
        console.log(`   → User confirming completion, advancing to next theme: ${nextTheme}`);
        return nextTheme;
      }
    }

    // Otherwise use current theme
    console.log(`   → Using current theme: ${this.state.theme_index}`);
    return this.state.theme_index;
  }

  /**
   * Determine if we should be awaiting confirmation for this response
   * Returns true if we should show interpretation + completion prompt
   * Returns false if we should show theme questions
   */
  private getAwaitingConfirmationForResponse(mode: Mode, classification: ClassificationResult): boolean {
    console.log(`\n🔍 AGENT: getAwaitingConfirmationForResponse - mode=${mode}, intent=${classification.intent}`);
    console.log(`   last_response=${this.state.last_response}`);

    if (mode !== 'WALK') {
      console.log('   → Returning false (not WALK mode)');
      return false;
    }

    // If user is asking for clarification (discover intent), stay in current mode
    if (classification.intent === 'discover') {
      console.log('   → User asking for clarification, keeping current state');
      // Return current state - if we showed questions, show questions again
      // If we showed interpretation, we're probably still awaiting their answer
      return this.state.last_response === 'interpretation_and_completion';
    }

    // If we just showed theme questions and user is providing input, they're answering
    // So next response should be interpretation + completion
    if (this.state.last_response === 'theme_questions' &&
        (classification.continuity || classification.intent === 'memory')) {
      console.log('   → User answered questions, returning true (show interpretation + completion)');
      return true;
    }

    // If we just showed interpretation + completion and user is confirming,
    // next response should be new theme questions
    if (this.state.last_response === 'interpretation_and_completion' &&
        (classification.continuity || classification.intent === 'memory')) {
      console.log('   → User confirming, returning false (show next theme questions)');
      return false;
    }

    // Starting walk - show theme questions
    if (this.state.theme_index === null || this.state.last_response === 'none') {
      console.log('   → Starting walk, returning false (show theme questions)');
      return false;
    }

    // Default
    console.log(`   → Default: returning false`);
    return false;
  }

  /**
   * Determine the mode based on classification and current state
   */
  private determineMode(classification: ClassificationResult): Mode {
    const { intent, continuity } = classification;

    // If already in CLOSE mode, stay there
    if (this.state.mode === 'CLOSE') {
      return 'CLOSE';
    }

    // Check if should transition to CLOSE
    // After Theme 6 completion, when user confirms to move forward
    if (
      this.state.theme_index === 6 &&
      this.state.last_response === 'interpretation_and_completion' &&
      (intent === 'memory' || continuity) &&
      this.state.active_protocol
    ) {
      console.log('🎯 AGENT: Transitioning to CLOSE mode after Theme 6 completion');
      return 'CLOSE';
    }

    // Intent-based mode determination
    if (intent === 'discover' && !this.state.active_protocol) {
      // Only go to ENTRY if no protocol is active
      return 'ENTRY';
    }

    if (intent === 'discover' && this.state.active_protocol) {
      // If protocol is active and user asks for clarification, stay in WALK mode
      return 'WALK';
    }

    if (intent === 'walk') {
      return 'WALK';
    }

    if (intent === 'memory' && this.state.active_protocol) {
      return 'WALK';
    }

    // CRITICAL FIX: When intent is 'none' (greeting/off-topic), go to ENTRY mode
    // This ensures greetings like "hi" trigger the Field Diagnostic Protocol ENTRY
    if (intent === 'none') {
      return 'ENTRY';
    }

    if (continuity && this.state.active_protocol) {
      return 'WALK';
    }

    // Default to ENTRY
    return 'ENTRY';
  }

  /**
   * Update session state based on mode and classification
   */
  private updateState(
    mode: Mode,
    classification: ClassificationResult,
    userMessage: string,
    themeIndexForResponse: number | null
  ): void {
    this.state.mode = mode;
    this.state.turn_counter++;
    this.state.updated_at = new Date().toISOString();

    if (mode === 'ENTRY') {
      // Entering ENTRY mode - might be starting fresh
      if (!this.state.active_protocol) {
        this.state.active_protocol = 'field_diagnostic';
      }
    }

    if (mode === 'WALK') {
      // Ensure protocol is active
      if (!this.state.active_protocol) {
        this.state.active_protocol = 'field_diagnostic';
      }

      // Update theme index based on what we just showed
      if (themeIndexForResponse !== null) {
        this.state.theme_index = themeIndexForResponse;
      }

      // Store last chunk reference
      if (this.state.theme_index !== null) {
        this.state.last_chunk_refs = [
          `field_diagnostic:theme:${this.state.theme_index}`,
        ];
      }
    }

    if (mode === 'CLOSE') {
      // Field diagnosis mode
      this.state.resume_hint = 'none';
    }
  }

  /**
   * Reset the agent state
   */
  reset(): void {
    this.state = this.createInitialState();
    this.conversationHistory = [];
    this.themeAnswers.clear();
  }

  /**
   * Get current state (for debugging/display)
   */
  getState(): SessionState {
    return { ...this.state };
  }

  /**
   * Create initial session state
   */
  private createInitialState(): SessionState {
    return {
      active_protocol: null,
      mode: 'ENTRY',
      theme_index: null,
      last_response: 'none',
      resume_hint: 'none',
      last_answer_summary: '',
      last_chunk_refs: [],
      turn_counter: 0,
      updated_at: new Date().toISOString(),
    };
  }
}
