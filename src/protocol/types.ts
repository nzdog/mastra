// Protocol-specific types

export interface EntrySectionConfig {
  title: string;
  marker: string;
}

export interface EntrySection {
  title: string;
  content: string;
}

export interface ProtocolMetadata {
  id: string;
  title: string;
  version: string;
  entry_keys: string[];
  entry_sections?: EntrySectionConfig[];
  themes: ThemeMetadata[];
  stones: string[];
}

export interface ThemeMetadata {
  index: number;
  title: string;
}

export interface ParsedProtocol {
  metadata: ProtocolMetadata;
  entry_sections: EntrySection[];
  theme_chunks: Map<number, string>;
  summary_instructions?: string;
}

export interface ThemeContent {
  title: string;
  stone: string;
  purpose: string;
  why_matters: string;
  outcomes: string;
  questions: string[];
  completion_prompt: string;
}
