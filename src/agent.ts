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
  private totalCost: number = 0; // Track cumulative API cost for this session
  private protocolPath: string;

  constructor(apiKey: string, registry?: ProtocolRegistry, protocolPath?: string) {
    this.classifier = new IntentClassifier(apiKey);

    // Use provided registry or load default field diagnostic protocol
    if (registry && protocolPath) {
      this.registry = registry;
      this.protocolPath = protocolPath;
    } else {
      const protocol = loadProtocol();
      this.registry = new ProtocolRegistry(protocol);
      this.protocolPath = path.join(__dirname, '../protocols/field_diagnostic.md');
    }

    // Create validator
    this.validator = new WalkResponseValidator(this.registry, this.protocolPath);

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
      const protocolMetadata = this.registry.getMetadata();
      return `The ${protocolMetadata.title} is complete. You have successfully completed all themes.`;
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

    // Track classifier cost
    this.totalCost += 0.0082; // Rough estimate for classifier call
    console.log(`💰 CLASSIFIER COST: ~$0.0082 | Total session cost: $${this.totalCost.toFixed(4)}`);

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
        const protocolMetadata = this.registry.getMetadata();
        return `The ${protocolMetadata.title} is complete. You have successfully completed all themes.`;
      }
      
      this.closeModeTimes++;
      console.log(`📍 AGENT: Entering CLOSE mode - generating field diagnosis`);
      
      // Generate field diagnosis (no chunk, no theme logic needed)
      console.log(`🤖 AI CALL: Generating field diagnosis (personalized)`);
      const response = await this.composer.compose(
        'CLOSE',
        null,
        this.conversationHistory,
        userMessage,
        {
          themeAnswers: this.themeAnswers,
        }
      );
      
      // Track composer cost
      this.totalCost += 0.0080; // Rough estimate for composer call
      console.log(`💰 COMPOSER COST: ~$0.0080 | Total session cost: $${this.totalCost.toFixed(4)}`);
      
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
    // OPTIMIZATION: Skip AI call for static content (ENTRY mode and theme questions)
    let response: string;
    const skipAI = mode === 'ENTRY' || (mode === 'WALK' && !awaitingConfirmationForResponse);
    
    if (skipAI) {
      console.log(`⚡ OPTIMIZATION: Skipping AI call for ${mode === 'ENTRY' ? 'ENTRY mode' : 'theme questions'} (using protocol content directly)`);
      response = this.buildStaticResponse(mode, chunk, themeIndexForResponse, nextThemeTitle);
      console.log(`📤 STATIC RESPONSE (first 200 chars): ${response.substring(0, 200)}`);
      console.log(`💰 SAVED ~$0.0080 by skipping AI call | Total session cost: $${this.totalCost.toFixed(4)}`);
    } else {
      console.log(`🤖 AI CALL: Generating ${mode === 'WALK' ? 'interpretation' : 'content'}`);
      response = await this.composer.compose(
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
      // Track composer cost
      this.totalCost += 0.0080; // Rough estimate for composer call
      console.log(`💰 COMPOSER COST: ~$0.0080 | Total session cost: $${this.totalCost.toFixed(4)}`);
    }

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
    // After final theme completion, when user confirms to move forward
    const totalThemes = this.registry.getTotalThemes();
    if (
      this.state.theme_index === totalThemes &&
      this.state.last_response === 'interpretation_and_completion' &&
      (intent === 'memory' || continuity) &&
      this.state.active_protocol
    ) {
      console.log(`🎯 AGENT: Transitioning to CLOSE mode after Theme ${totalThemes} completion`);
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
   * Build static response from protocol content (skips AI call)
   */
  private buildStaticResponse(mode: Mode, chunk: any, themeIndex: number | null, nextThemeTitle: string | null): string {
    if (mode === 'ENTRY') {
      // Return ENTRY mode protocol introduction
      // Extract the ENTRY chunk content dynamically
      const entryChunk = this.registry.retrieve('ENTRY', null);
      if (entryChunk) {
        const protocolMetadata = this.registry.getMetadata();
        const firstThemeTitle = this.registry.getThemeTitle(1);

        // Return the entry content followed by transition to Theme 1
        return `${entryChunk.content}\n\nWould you like me to now guide you into **Theme 1 – ${firstThemeTitle}**?`;
      }

      // Fallback (should never reach here if protocol is properly formatted)
      return 'Error: Unable to load protocol introduction.';
    } else if (mode === 'WALK' && themeIndex && chunk) {
      // Return theme questions from protocol content
      const content = chunk.content;
      const lines = content.split('\n');
      
      // Extract theme title, purpose, why this matters, and guiding questions
      let themeTitle = '';
      let purpose = '';
      let whyThisMatters = '';
      let questions: string[] = [];
      
      let inQuestions = false;
      
      for (const line of lines) {
        if (line.startsWith('###')) {
          // Parse: "### 1. Surface Behaviors *(Stone 4: Clarity Over Cleverness)*"
          // Extract just "Surface Behaviors"
          const titleMatch = line.match(/###\s*\d+\.\s*([^*]+)/);
          if (titleMatch) {
            themeTitle = titleMatch[1].trim();
          }
        } else if (line.startsWith('**Purpose:**')) {
          purpose = line.replace('**Purpose:**', '').trim();
        } else if (line.startsWith('**Why this matters:**')) {
          whyThisMatters = line.replace('**Why this matters:**', '').trim();
        } else if (line.startsWith('**Guiding Questions:**')) {
          inQuestions = true;
        } else if (inQuestions && line.startsWith('- ')) {
          questions.push('• ' + line.substring(2));
        } else if (inQuestions && line.startsWith('**')) {
          inQuestions = false;
        }
      }
      
      // Build response with proper formatting
      let response = `**Theme ${themeIndex} – ${themeTitle}**\n**Purpose:** ${purpose}\n`;
      response += `**Why This Matters**\n${whyThisMatters}\n`;
      response += `**Guiding Questions:**\n${questions.join('\n')}\n`;
      response += `Take a moment with those, and when you're ready, share what comes up.`;
      
      return response;
    }
    
    return ''; // Fallback (should never reach here)
  }

  /**
   * Get total cost for this session
   */
  getTotalCost(): number {
    return this.totalCost;
  }

  /**
   * Reset the agent state
   */
  reset(): void {
    this.state = this.createInitialState();
    this.conversationHistory = [];
    this.themeAnswers.clear();
    this.highestThemeReached = 0;
    this.totalCost = 0;
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
