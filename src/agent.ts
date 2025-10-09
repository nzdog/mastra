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
  private highestThemeReached: number = 0; // Track the furthest theme user has progressed to
  private closeModeTimes: number = 0; // Track how many times CLOSE mode has been entered

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
    // If already in CLOSE mode, don't process additional user responses
    // The protocol is complete and should not continue
    if (this.state.mode === 'CLOSE') {
      return 'The Field Diagnostic Protocol is complete. You have successfully mapped and named the field that has been shaping your experience.';
    }

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

    // Step 2: Set is_revisiting flag BEFORE any calculations (if user requested a specific theme)
    if (classification.requested_theme !== undefined) {
      this.state.is_revisiting = true;
      console.log(`🔄 AGENT: Set is_revisiting = true (user requested theme ${classification.requested_theme})`);
    }

    // Step 3: Determine mode
    const mode = this.determineMode(classification);
    
    // CRITICAL: CLOSE mode gets special handling - skip all WALK logic
    if (mode === 'CLOSE') {
      // Prevent duplicate CLOSE processing
      if (this.closeModeTimes > 0) {
        console.log('⚠️ AGENT: Preventing duplicate CLOSE mode processing');
        return 'The Field Diagnostic Protocol is complete. You have successfully mapped and named the field that has been shaping your experience.';
      }
      
      this.closeModeTimes++;
      console.log(`📍 AGENT: Entering CLOSE mode - generating field diagnosis`);
      
      // Generate field diagnosis (no chunk, no theme logic needed)
      const response = await this.composer.compose(
        'CLOSE',
        null,
        this.conversationHistory,
        userMessage,
        {
          themeAnswers: this.themeAnswers,
        }
      );
      
      // Update state to CLOSE
      this.state.mode = 'CLOSE';
      this.state.turn_counter++;
      this.state.updated_at = new Date().toISOString();
      
      // Add response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: response,
      });
      
      console.log('✅ AGENT: Field diagnosis complete, protocol finished');
      return response;
    }

    // WALK/ENTRY mode: Continue with normal theme-based logic
    // Step 4: Determine theme index for this response (before state update)
    const themeIndexForResponse = this.getThemeIndexForResponse(mode, classification, userMessage);

    // Step 3b: Determine awaiting confirmation state for this response
    const awaitingConfirmationForResponse = this.getAwaitingConfirmationForResponse(mode, classification, themeIndexForResponse);

    // Step 4: Retrieve appropriate chunk
    const chunk = this.registry.retrieve(mode, themeIndexForResponse);

    // Step 4b: Get theme titles for context
    const currentThemeTitle = themeIndexForResponse ? this.registry.getThemeTitle(themeIndexForResponse) : null;
    const nextThemeTitle = themeIndexForResponse ? this.registry.getThemeTitle(themeIndexForResponse + 1) : null;

    // Step 5: Compose response
    const response = await this.composer.compose(
      mode,
      chunk,
      this.conversationHistory,
      userMessage,
      {
        themeAnswers: this.themeAnswers,
        currentThemeIndex: themeIndexForResponse ?? undefined,
        currentThemeTitle: currentThemeTitle ?? undefined,
        nextThemeTitle: nextThemeTitle ?? undefined,
        awaitingConfirmation: awaitingConfirmationForResponse,
        intent: classification.intent,
        userIntent: classification.user_wants_to,
      }
    );

    // Step 6: Store user's answer BEFORE updating last_response
    // (need to check the PREVIOUS state to know if they just answered questions)
    // BUT: Don't store if they're asking for clarification (discover intent)
    if (mode === 'WALK' &&
        (classification.continuity || classification.intent === 'memory') &&
        classification.intent !== 'discover' &&
        themeIndexForResponse !== null) {

      // Store answer if they just answered theme questions
      if (this.state.last_response === 'theme_questions') {
        this.themeAnswers.set(themeIndexForResponse, userMessage);
        console.log(`📝 AGENT: Stored answer for theme ${themeIndexForResponse}`);

        // Update highest theme reached ONLY when answering a theme for the first time
        if (themeIndexForResponse > this.highestThemeReached) {
          this.highestThemeReached = themeIndexForResponse;
          console.log(`📊 AGENT: Updated highestThemeReached to ${this.highestThemeReached} (first time answering)`);
        }
      }
      // Update answer if they're adding to a revisited theme
      else if (this.state.last_response === 'interpretation_and_completion' && this.state.is_revisiting) {
        const previousAnswer = this.themeAnswers.get(themeIndexForResponse);
        const updatedAnswer = `${previousAnswer}\n\n[Added]: ${userMessage}`;
        this.themeAnswers.set(themeIndexForResponse, updatedAnswer);
        console.log(`📝 AGENT: Updated answer for theme ${themeIndexForResponse} (revisit)`);
      }
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

    // Step 9: Update state
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
   * Uses AI-driven semantic intent from classification
   */
  private getThemeIndexForResponse(mode: Mode, classification: ClassificationResult, userMessage: string): number | null {
    console.log(`\n🔍 AGENT: getThemeIndexForResponse - mode=${mode}, intent=${classification.intent}, current_theme=${this.state.theme_index}`);
    console.log(`   last_response=${this.state.last_response}`);
    console.log(`   user_wants_to:`, classification.user_wants_to);

    if (mode !== 'WALK') {
      console.log('   → Returning null (not WALK mode)');
      return null;
    }

    // User explicitly navigating to a specific theme
    if (classification.user_wants_to.navigate_to_theme !== null) {
      console.log(`   → User navigating to theme ${classification.user_wants_to.navigate_to_theme}`);
      return classification.user_wants_to.navigate_to_theme;
    }

    // Starting the walk - handles both 'walk' intent and 'memory' when theme is null
    if (this.state.theme_index === null && (classification.intent === 'walk' || classification.intent === 'memory')) {
      console.log('   → Starting walk, returning 1');
      return 1;
    }

    // User wants to advance to next theme
    if (classification.user_wants_to.advance_to_next_theme && this.state.theme_index !== null) {
      const totalThemes = this.registry.getTotalThemes();
      if (this.state.theme_index < totalThemes) {
        const nextTheme = this.state.theme_index + 1;
        console.log(`   → User wants to advance, moving to theme: ${nextTheme}`);
        return nextTheme;
      }
    }

    // User wants elaboration or adding reflection - stay on current theme
    if (classification.user_wants_to.request_elaboration || classification.user_wants_to.add_more_reflection) {
      console.log(`   → User wants elaboration/more reflection, staying on theme: ${this.state.theme_index}`);
      return this.state.theme_index;
    }

    // Otherwise use current theme
    console.log(`   → Using current theme: ${this.state.theme_index}`);
    return this.state.theme_index;
  }

  /**
   * Determine if we should be awaiting confirmation for this response
   * Uses AI-driven semantic intent from classification
   * Returns true if we should show interpretation + completion prompt
   * Returns false if we should show theme questions
   */
  private getAwaitingConfirmationForResponse(mode: Mode, classification: ClassificationResult, themeIndexForResponse: number | null): boolean {
    console.log(`\n🔍 AGENT: getAwaitingConfirmationForResponse - mode=${mode}, intent=${classification.intent}`);
    console.log(`   last_response=${this.state.last_response}`);
    console.log(`   user_wants_to:`, classification.user_wants_to);
    console.log(`   themeIndexForResponse=${themeIndexForResponse}, current_theme=${this.state.theme_index}`);

    if (mode !== 'WALK') {
      console.log('   → Returning false (not WALK mode)');
      return false;
    }

    // If user explicitly navigating to a theme, check if already answered
    if (classification.user_wants_to.navigate_to_theme !== null) {
      const hasAnswer = this.themeAnswers.has(classification.user_wants_to.navigate_to_theme);
      console.log(`   → User navigating to theme ${classification.user_wants_to.navigate_to_theme}, has answer: ${hasAnswer}`);
      // If answered, show interpretation + advance option; otherwise show questions
      return hasAnswer;
    }

    // If user wants to advance to next theme, show next theme's questions
    if (classification.user_wants_to.advance_to_next_theme) {
      console.log('   → User wants to advance, returning false (show next theme questions)');
      return false;
    }

    // If user wants elaboration or adding more reflection, stay in interpretation mode
    if (classification.user_wants_to.request_elaboration || classification.user_wants_to.add_more_reflection) {
      console.log('   → User wants elaboration/more reflection, returning true (show interpretation + advance option)');
      return true;
    }

    // If we just showed theme questions and user provided substantive answer
    if (this.state.last_response === 'theme_questions' &&
        (classification.continuity || classification.intent === 'memory')) {
      console.log('   → User answered questions, returning true (show interpretation + completion)');
      return true;
    }

    // Starting walk - show theme questions
    if (this.state.theme_index === null || this.state.last_response === 'none') {
      console.log('   → Starting walk, returning false (show theme questions)');
      return false;
    }

    // Default: if in doubt, check what we last showed
    const result = this.state.last_response === 'interpretation_and_completion';
    console.log(`   → Default: returning ${result} (based on last_response)`);
    return result;
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
      // console.log('🎯 AGENT: Transitioning to CLOSE mode after Theme 6 completion');
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

      // Track if theme is changing
      const themeChanging = themeIndexForResponse !== null &&
                           this.state.theme_index !== null &&
                           themeIndexForResponse !== this.state.theme_index;

      // Reset conversation_depth when changing themes
      if (themeChanging) {
        this.state.conversation_depth = 0;
        this.state.has_answered_theme = false;
        console.log(`🔄 AGENT: Reset conversation_depth (theme changing from ${this.state.theme_index} to ${themeIndexForResponse})`);
      } else if (mode === 'WALK') {
        // Increment conversation depth if staying on same theme
        this.state.conversation_depth++;
        console.log(`📊 AGENT: Incremented conversation_depth to ${this.state.conversation_depth}`);
      }

      // Clear is_revisiting when advancing AWAY from a revisited theme
      // Only clear if we're moving to a HIGHER theme number (advancing forward)
      if (this.state.is_revisiting &&
          themeIndexForResponse !== null &&
          this.state.theme_index !== null &&
          themeIndexForResponse > this.state.theme_index) {
        this.state.is_revisiting = false;
        console.log(`✅ AGENT: Cleared is_revisiting (advancing from ${this.state.theme_index} to ${themeIndexForResponse})`);
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
    this.highestThemeReached = 0;
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
      is_revisiting: false,
      conversation_depth: 0,
      has_answered_theme: false,
      resume_hint: 'none',
      last_answer_summary: '',
      last_chunk_refs: [],
      turn_counter: 0,
      updated_at: new Date().toISOString(),
    };
  }
}
