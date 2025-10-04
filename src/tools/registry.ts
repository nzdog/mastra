import { ParsedProtocol } from '../protocol/types';
import { ProtocolChunk, Mode } from '../types';

export class ProtocolRegistry {
  private protocol: ParsedProtocol;

  constructor(protocol: ParsedProtocol) {
    this.protocol = protocol;
  }

  /**
   * Retrieve the appropriate chunk based on mode and theme index
   * CRITICAL: Never mix ENTRY and WALK chunks
   */
  retrieve(mode: Mode, themeIndex: number | null): ProtocolChunk | null {
    if (mode === 'ENTRY') {
      return {
        id: `${this.protocol.metadata.id}:entry`,
        type: 'ENTRY',
        content: this.protocol.entry_chunk,
      };
    }

    if (mode === 'WALK' && themeIndex !== null) {
      console.log(`\n🗂️  REGISTRY: Looking for theme ${themeIndex}`);
      console.log(`   Available themes:`, Array.from(this.protocol.theme_chunks.keys()));
      const themeContent = this.protocol.theme_chunks.get(themeIndex);
      if (themeContent) {
        console.log(`   ✅ Found theme ${themeIndex}`);
        return {
          id: `${this.protocol.metadata.id}:theme:${themeIndex}`,
          type: 'WALK',
          content: themeContent,
          theme_index: themeIndex,
        };
      } else {
        console.log(`   ❌ Theme ${themeIndex} not found in chunks`);
      }
    }

    // CLOSE mode doesn't retrieve chunks, returns null
    if (mode === 'CLOSE') {
      return null;
    }

    return null;
  }

  /**
   * Get the total number of themes
   */
  getTotalThemes(): number {
    return this.protocol.metadata.themes.length;
  }

  /**
   * Get theme metadata by index
   */
  getThemeMetadata(index: number) {
    return this.protocol.metadata.themes.find((t) => t.index === index);
  }

  /**
   * Get protocol metadata
   */
  getMetadata() {
    return this.protocol.metadata;
  }
}
