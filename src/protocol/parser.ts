import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import { ParsedProtocol, ProtocolMetadata, ThemeContent } from './types';

export class ProtocolParser {
  private protocolPath: string;

  constructor(protocolPath: string) {
    this.protocolPath = protocolPath;
  }

  /**
   * Parse the markdown protocol file into structured chunks
   */
  parse(): ParsedProtocol {
    const fileContent = fs.readFileSync(this.protocolPath, 'utf-8');
    const { data: frontmatter, content } = matter(fileContent);

    const metadata: ProtocolMetadata = {
      id: frontmatter.id,
      title: frontmatter.title,
      version: frontmatter.version,
      entry_keys: frontmatter.entry_keys || [],
      themes: frontmatter.themes || [],
      stones: frontmatter.stones || [],
    };

    // Extract ENTRY chunk
    const entry_chunk = this.extractEntryChunk(content, metadata);

    // Extract WALK chunks (per theme)
    const theme_chunks = this.extractThemeChunks(content, metadata);

    return {
      metadata,
      entry_chunk,
      theme_chunks,
    };
  }

  /**
   * Extract the ENTRY chunk (Purpose, Why This Matters, Use This When, Outcomes)
   */
  private extractEntryChunk(content: string, metadata: ProtocolMetadata): string {
    const lines = content.split('\n');
    const sections: Record<string, string> = {};

    let currentSection = '';
    let sectionContent: string[] = [];

    for (const line of lines) {
      // Top-level heading (##)
      if (line.startsWith('## ')) {
        if (currentSection && sectionContent.length > 0) {
          sections[currentSection] = sectionContent.join('\n').trim();
        }
        currentSection = line.replace('## ', '').trim();
        sectionContent = [];
      }
      // Stop at Themes section
      else if (line.startsWith('## Themes')) {
        if (currentSection && sectionContent.length > 0) {
          sections[currentSection] = sectionContent.join('\n').trim();
        }
        break;
      }
      // Collect content
      else if (currentSection) {
        sectionContent.push(line);
      }
    }

    // Build entry chunk
    let entryChunk = `# ${metadata.title}\n\n`;

    if (sections['Purpose']) {
      entryChunk += `## Purpose\n${sections['Purpose']}\n\n`;
    }

    if (sections['Why This Matters']) {
      entryChunk += `## Why This Matters\n${sections['Why This Matters']}\n\n`;
    }

    if (sections['Use This When']) {
      entryChunk += `## Use This When\n${sections['Use This When']}\n\n`;
    }

    if (sections['Outcomes']) {
      entryChunk += `## Outcomes\n${sections['Outcomes']}\n\n`;
    }

    return entryChunk.trim();
  }

  /**
   * Extract WALK chunks (one per theme)
   */
  private extractThemeChunks(content: string, metadata: ProtocolMetadata): Map<number, string> {
    const theme_chunks = new Map<number, string>();
    const lines = content.split('\n');

    let inThemesSection = false;
    let currentThemeIndex: number | null = null;
    let themeContent: string[] = [];

    for (const line of lines) {
      // Enter Themes section
      if (line.startsWith('## Themes')) {
        inThemesSection = true;
        continue;
      }

      // Stop at Completion Prompts or end
      if (line.startsWith('## Completion Prompts') || line.startsWith('---')) {
        if (currentThemeIndex !== null && themeContent.length > 0) {
          theme_chunks.set(currentThemeIndex, this.buildThemeChunk(themeContent));
        }
        break;
      }

      if (inThemesSection) {
        // Theme heading (### N. Title)
        const themeMatch = line.match(/^### (\d+)\.\s+(.+)/);
        if (themeMatch) {
          // Save previous theme
          if (currentThemeIndex !== null && themeContent.length > 0) {
            theme_chunks.set(currentThemeIndex, this.buildThemeChunk(themeContent));
          }

          // Start new theme
          currentThemeIndex = parseInt(themeMatch[1]);
          themeContent = [line];
        } else if (currentThemeIndex !== null) {
          themeContent.push(line);
        }
      }
    }

    // Save last theme
    if (currentThemeIndex !== null && themeContent.length > 0) {
      theme_chunks.set(currentThemeIndex, this.buildThemeChunk(themeContent));
    }

    return theme_chunks;
  }

  /**
   * Build a single theme chunk from collected lines
   */
  private buildThemeChunk(lines: string[]): string {
    return lines.join('\n').trim();
  }

  /**
   * Parse theme content into structured format
   */
  parseThemeContent(themeChunk: string): ThemeContent {
    const lines = themeChunk.split('\n');
    const titleMatch = lines[0].match(/^### (\d+)\.\s+(.+?)\s+\*\((.+)\)\*/);

    const title = titleMatch ? titleMatch[2].trim() : '';
    const stone = titleMatch ? titleMatch[3].trim() : '';

    let purpose = '';
    let why_matters = '';
    let outcomes = '';
    const questions: string[] = [];

    let currentField = '';

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('**Purpose:**')) {
        currentField = 'purpose';
        purpose = line.replace('**Purpose:**', '').trim();
      } else if (line.startsWith('**Why this matters:**')) {
        currentField = 'why_matters';
        why_matters = line.replace('**Why this matters:**', '').trim();
      } else if (line.startsWith('**Outcomes:**')) {
        currentField = 'outcomes';
        continue;
      } else if (line.startsWith('**Guiding Questions:**')) {
        currentField = 'questions';
        continue;
      } else if (line.startsWith('- ')) {
        if (currentField === 'questions') {
          questions.push(line.replace('- ', '').trim());
        } else if (currentField === 'outcomes') {
          outcomes += line + '\n';
        }
      } else if (line.trim() && currentField === 'outcomes') {
        outcomes += line + '\n';
      }
    }

    return {
      title,
      stone,
      purpose,
      why_matters,
      outcomes: outcomes.trim(),
      questions,
    };
  }
}

/**
 * Load and parse the field diagnostic protocol
 */
export function loadProtocol(): ParsedProtocol {
  const protocolPath = path.join(__dirname, '../../protocols/field_diagnostic.md');
  const parser = new ProtocolParser(protocolPath);
  return parser.parse();
}
