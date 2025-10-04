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

    // Step 3: Retrieve appropriate chunk
    const chunk = this.registry.retrieve(mode, this.state.theme_index);

    // Step 4: Compose response
    const response = await this.composer.compose(
      mode,
      chunk,
      this.conversationHistory,
      userMessage,
      {
        themeAnswers: this.themeAnswers,
        currentThemeIndex: this.state.theme_index ?? undefined,
        awaitingConfirmation: this.state.awaiting_confirmation,
      }
    );

    // Step 5: Update state
    this.updateState(mode, classification, userMessage);

    // Add assistant response to history
    this.conversationHistory.push({
      role: 'assistant',
      content: response,
    });

    return response;
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
    if (
      this.state.theme_index === 6 &&
      this.state.last_completion_confirmed &&
      this.state.active_protocol
    ) {
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
    userMessage: string
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

      // Handle theme progression
      if (classification.intent === 'walk' && this.state.theme_index === null) {
        // Starting the walk - enter Theme 1
        this.state.theme_index = 1;
        this.state.awaiting_confirmation = false;
        this.state.last_completion_confirmed = false;
      } else if (classification.intent === 'discover') {
        // User is asking for clarification - don't change state
        // Just stay on the current theme
      } else if (this.state.awaiting_confirmation) {
        // User just shared their reflection
        // Now waiting for them to confirm completion prompt and move to next theme
        this.state.last_completion_confirmed = true;
        this.state.awaiting_confirmation = false;
        this.state.resume_hint = 'ready_to_advance';
      } else if (classification.continuity || classification.intent === 'memory') {
        // Check if advancing to next theme
        if (this.state.last_completion_confirmed && this.state.theme_index !== null) {
          // Advance to next theme
          const totalThemes = this.registry.getTotalThemes();
          if (this.state.theme_index < totalThemes) {
            this.state.theme_index++;
            this.state.awaiting_confirmation = false;
            this.state.last_completion_confirmed = false;
          }
        } else {
          // User is sharing their reflection on the theme questions
          if (this.state.theme_index !== null) {
            // Store their answer for this theme
            this.themeAnswers.set(this.state.theme_index, userMessage);

            // Set awaiting confirmation flag
            this.state.awaiting_confirmation = true;
          }
        }
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
      awaiting_confirmation: false,
      last_completion_confirmed: false,
      resume_hint: 'none',
      last_answer_summary: '',
      last_chunk_refs: [],
      turn_counter: 0,
      updated_at: new Date().toISOString(),
    };
  }
}
