// Protocol-specific types

export interface ProtocolMetadata {
  id: string;
  title: string;
  version: string;
  entry_keys: string[];
  themes: ThemeMetadata[];
  stones: string[];
}

export interface ThemeMetadata {
  index: number;
  title: string;
}

export interface ParsedProtocol {
  metadata: ProtocolMetadata;
  entry_chunk: string;
  theme_chunks: Map<number, string>;
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
