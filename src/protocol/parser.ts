import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import { ParsedProtocol, ProtocolMetadata, ThemeContent, EntrySection } from './types';

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
      entry_sections: frontmatter.entry_sections || undefined,
      themes: frontmatter.themes || [],
      stones: frontmatter.stones || [],
    };

    // console.log('\n📄 PARSER: Parsing protocol file...');
    // console.log(`   Protocol ID: ${metadata.id}`);
    // console.log(`   Expected themes: ${metadata.themes.length}`);

    // Extract ENTRY sections
    const entry_sections = this.extractEntrySections(content, metadata);
    // console.log(`   ✅ Entry sections extracted: ${entry_sections.length}`);

    // Extract WALK chunks (per theme)
    const theme_chunks = this.extractThemeChunks(content, metadata);
    // console.log(`   ✅ Theme chunks extracted: ${theme_chunks.size} themes`);
    // console.log(`   Theme indices:`, Array.from(theme_chunks.keys()));

    // Extract summary instructions (CLOSE mode)
    const summary_instructions = this.extractSummaryInstructions(content);
    // console.log(`   ✅ Summary instructions extracted: ${summary_instructions ? 'yes' : 'no'}`);

    return {
      metadata,
      entry_sections,
      theme_chunks,
      summary_instructions,
    };
  }

  /**
   * Extract ENTRY sections based on frontmatter configuration or default sections
   */
  private extractEntrySections(content: string, metadata: ProtocolMetadata): EntrySection[] {
    const lines = content.split('\n');
    const allSections: Record<string, string> = {};

    let currentSection = '';
    let sectionContent: string[] = [];

    // Parse all sections from the markdown content
    for (const line of lines) {
      // Top-level heading (##)
      if (line.startsWith('## ')) {
        if (currentSection && sectionContent.length > 0) {
          allSections[currentSection] = sectionContent.join('\n').trim();
        }
        currentSection = line.replace('## ', '').trim();
        sectionContent = [];
      }
      // Stop at Themes section
      else if (line.startsWith('## Themes')) {
        if (currentSection && sectionContent.length > 0) {
          allSections[currentSection] = sectionContent.join('\n').trim();
        }
        break;
      }
      // Collect content
      else if (currentSection) {
        sectionContent.push(line);
      }
    }

    // Build entry sections array based on frontmatter config or defaults
    const entrySections: EntrySection[] = [];

    if (metadata.entry_sections && metadata.entry_sections.length > 0) {
      // Use configured sections from frontmatter
      for (const config of metadata.entry_sections) {
        const sectionKey = config.marker.replace('## ', '').trim();
        if (allSections[sectionKey]) {
          entrySections.push({
            title: config.title,
            content: allSections[sectionKey],
          });
        }
      }
    } else {
      // Fall back to default sections
      const defaultSections = ['Purpose', 'Why This Matters', 'Use This When', 'Outcomes'];
      for (const sectionKey of defaultSections) {
        if (allSections[sectionKey]) {
          entrySections.push({
            title: sectionKey,
            content: allSections[sectionKey],
          });
        }
      }
    }

    return entrySections;
  }

  /**
   * Extract WALK chunks (one per theme)
   */
  private extractThemeChunks(content: string, metadata: ProtocolMetadata): Map<number, string> {
    const theme_chunks = new Map<number, string>();
    const lines = content.split('\n');

    // console.log('\n📋 PARSER: Extracting themes from content...');
    // console.log(`   Total lines: ${lines.length}`);

    let inThemesSection = false;
    let currentThemeIndex: number | null = null;
    let themeContent: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Enter Themes section
      if (line.startsWith('## Themes')) {
        inThemesSection = true;
        // console.log(`   ✅ Found "## Themes" at line ${i + 1}`);
        continue;
      }

      // Stop at Completion Prompts or second horizontal rule
      if (inThemesSection && (line.startsWith('## Completion Prompts') || (line.startsWith('---') && i > 20))) {
        // console.log(`   ⏹️  Stopping at line ${i + 1}: "${line.substring(0, 50)}"`);
        if (currentThemeIndex !== null && themeContent.length > 0) {
          theme_chunks.set(currentThemeIndex, this.buildThemeChunk(themeContent));
          // console.log(`   ✅ Saved theme ${currentThemeIndex} (${themeContent.length} lines)`);
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
            // console.log(`   ✅ Saved theme ${currentThemeIndex} (${themeContent.length} lines)`);
          }

          // Start new theme
          currentThemeIndex = parseInt(themeMatch[1]);
          themeContent = [line];
          // console.log(`   🆕 Started theme ${currentThemeIndex}: "${themeMatch[2].substring(0, 30)}..."`);
        } else if (currentThemeIndex !== null) {
          themeContent.push(line);
        }
      }
    }

    // Save last theme
    if (currentThemeIndex !== null && themeContent.length > 0) {
      theme_chunks.set(currentThemeIndex, this.buildThemeChunk(themeContent));
      // console.log(`   ✅ Saved final theme ${currentThemeIndex} (${themeContent.length} lines)`);
    }

    // console.log(`\n   📊 Total themes extracted: ${theme_chunks.size}`);
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
    let completion_prompt = '';
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
      } else if (line.startsWith('**Completion Prompt:**')) {
        currentField = 'completion_prompt';
        continue;
      } else if (line.startsWith('- ')) {
        if (currentField === 'questions') {
          questions.push(line.replace('- ', '').trim());
        } else if (currentField === 'outcomes') {
          outcomes += line + '\n';
        }
      } else if (line.trim() && currentField === 'outcomes') {
        outcomes += line + '\n';
      } else if (line.trim() && currentField === 'completion_prompt') {
        completion_prompt = line.trim();
      }
    }

    return {
      title,
      stone,
      purpose,
      why_matters,
      outcomes: outcomes.trim(),
      questions,
      completion_prompt,
    };
  }

  /**
   * Extract summary instructions section (for CLOSE mode)
   */
  private extractSummaryInstructions(content: string): string | undefined {
    const lines = content.split('\n');
    let inSummarySection = false;
    const summaryLines: string[] = [];

    for (const line of lines) {
      // Start collecting when we hit ## Summary Instructions
      if (line.startsWith('## Summary Instructions')) {
        inSummarySection = true;
        continue;
      }

      // Collect everything after ## Summary Instructions until end of file
      if (inSummarySection) {
        summaryLines.push(line);
      }
    }

    // Return undefined if no summary instructions found
    if (summaryLines.length === 0) {
      return undefined;
    }

    return summaryLines.join('\n').trim();
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
