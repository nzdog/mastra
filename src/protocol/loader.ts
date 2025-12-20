import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import { ProtocolValidator } from './validation';
import { ValidationResult } from './validation/types';

export interface ProtocolMetadata {
  id: string;
  slug: string;
  title: string;
  version: string;
  purpose?: string;
  why?: string;
  use_when?: string;
  theme_count: number;
  file_path: string;
}

export class ProtocolLoader {
  private protocolsDir: string;
  private static metadataCache: Map<string, ProtocolMetadata[]> | null = null;
  private static metadataCacheTime: number = 0;
  private static CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  // Validation cache (shares same TTL timestamp as metadata cache)
  private static validationCache: Map<string, ValidationResult> | null = null;

  constructor(protocolsDir?: string) {
    this.protocolsDir = protocolsDir || path.join(__dirname, '../../protocols');
  }

  /**
   * Scan the protocols directory and return metadata for all protocols
   * Uses in-memory cache to avoid repeated file I/O operations
   */
  public listProtocols(): ProtocolMetadata[] {
    const now = Date.now();
    const cacheKey = this.protocolsDir;

    // Check if cache is valid
    if (
      ProtocolLoader.metadataCache &&
      ProtocolLoader.metadataCacheTime > 0 &&
      now - ProtocolLoader.metadataCacheTime < ProtocolLoader.CACHE_TTL_MS
    ) {
      const cached = ProtocolLoader.metadataCache.get(cacheKey);
      if (cached) {
        console.log('📦 CACHE HIT: Protocol metadata loaded from cache');
        return cached;
      }
    }

    console.log('💾 CACHE MISS: Loading protocol metadata from disk');
    console.log('📁 Scanning directory:', this.protocolsDir);
    const protocols: ProtocolMetadata[] = [];

    // Initialize validator for discovery-time validation
    const validator = new ProtocolValidator();

    // Determine validation mode (environment-aware)
    const isProduction = process.env.NODE_ENV === 'production';
    const strictModeOverride = process.env.PROTOCOL_VALIDATION_STRICT;
    const strictMode =
      strictModeOverride !== undefined ? strictModeOverride === 'true' : isProduction;

    try {
      const files = fs.readdirSync(this.protocolsDir);
      console.log(`📋 Found ${files.length} files in protocols directory:`, files);

      for (const file of files) {
        console.log(`🔍 Processing file: ${file}`);

        // Only process .md files, skip template and README
        if (!file.endsWith('.md') || file === 'PROTOCOL_TEMPLATE.md' || file === 'README.md') {
          console.log(`   ⏭️  Skipped (not a protocol): ${file}`);
          continue;
        }

        const filePath = path.join(this.protocolsDir, file);
        console.log(`   📄 Protocol file: ${filePath}`);

        // CRITICAL: Validate file before loading metadata (discovery-time validation)
        const validationResult = this.validateProtocolFile(filePath, validator, now);
        console.log(
          `   🔬 Validation result: errors=${validationResult.errorCount}, warnings=${validationResult.warningCount}`
        );

        // Skip invalid protocols in both modes (primary enforcement)
        if (validationResult.hasErrors) {
          if (strictMode) {
            console.error(`❌ LOADER (STRICT): Skipping invalid protocol: ${file}`);
            console.error(`   Errors: ${validationResult.errorCount}`);
          } else {
            console.warn(`⚠️  LOADER (PERMISSIVE): Skipping invalid protocol: ${file}`);
            console.warn(`   Errors: ${validationResult.errorCount}`);
            console.warn(`   Run "npm run validate:protocols -- --file ${filePath}" for details`);
          }
          continue; // Skip this protocol - NEVER appears in /api/protocols
        }

        // Protocol is valid - load metadata
        const metadata = this.getProtocolMetadata(filePath);

        if (metadata) {
          console.log(`   ✅ Loaded protocol: ${metadata.title} (slug: ${metadata.slug})`);
          protocols.push(metadata);
        } else {
          console.log(`   ❌ Failed to extract metadata from: ${file}`);
        }
      }

      console.log(`\n📊 FINAL PROTOCOL LIST (${protocols.length} protocols):`);
      protocols.forEach((p) => console.log(`   - ${p.slug}: ${p.title}`));

      // Update cache
      if (!ProtocolLoader.metadataCache) {
        ProtocolLoader.metadataCache = new Map();
      }
      ProtocolLoader.metadataCache.set(cacheKey, protocols);
      ProtocolLoader.metadataCacheTime = now;
    } catch (error) {
      console.error('Error loading protocols:', error);
    }

    return protocols;
  }

  /**
   * Get metadata for a specific protocol by slug
   */
  public getProtocolBySlug(slug: string): ProtocolMetadata | null {
    const protocols = this.listProtocols();
    return protocols.find((p) => p.slug === slug) || null;
  }

  /**
   * Extract metadata from a protocol markdown file
   */
  private getProtocolMetadata(filePath: string): ProtocolMetadata | null {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const { data, content: markdown } = matter(content);

      // Extract slug from filename (remove .md extension)
      const filename = path.basename(filePath, '.md');
      const slug = filename.toLowerCase().replace(/\s+/g, '_');

      // Extract purpose from markdown content
      let purpose = '';
      const purposeMatch = markdown.match(/## Purpose\s*\n(.*?)(?=\n##|\n---)/s);
      if (purposeMatch) {
        purpose = purposeMatch[1].trim();
      }

      // Extract why from markdown content
      let why = '';
      const whyMatch = markdown.match(/## Why This Matters\s*\n(.*?)(?=\n##|\n---)/s);
      if (whyMatch) {
        why = whyMatch[1].trim();
      }

      // Extract use_when from markdown content
      let use_when = '';
      const useWhenMatch = markdown.match(/## Use This When\s*\n(.*?)(?=\n##|\n---)/s);
      if (useWhenMatch) {
        use_when = useWhenMatch[1].trim();
      }

      return {
        id: data.id || slug,
        slug: slug,
        title: data.title || filename,
        version: data.version || '1.0.0',
        purpose: purpose || undefined,
        why: why || undefined,
        use_when: use_when || undefined,
        theme_count: data.themes?.length || 0,
        file_path: filePath,
      };
    } catch (error) {
      console.error(`Error reading protocol metadata from ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Get the full file path for a protocol by slug
   */
  public getProtocolPath(slug: string): string | null {
    const protocol = this.getProtocolBySlug(slug);
    return protocol ? protocol.file_path : null;
  }

  /**
   * Validate a single protocol file and cache the result
   * Uses same cache timestamp as metadata cache for coherence
   */
  private validateProtocolFile(
    filePath: string,
    validator: ProtocolValidator,
    cacheTime: number
  ): ValidationResult {
    // Check validation cache (shares same timestamp as metadata cache)
    if (
      ProtocolLoader.validationCache &&
      ProtocolLoader.metadataCacheTime > 0 &&
      cacheTime - ProtocolLoader.metadataCacheTime < ProtocolLoader.CACHE_TTL_MS
    ) {
      const cached = ProtocolLoader.validationCache.get(filePath);
      if (cached) {
        return cached;
      }
    }

    // Validate file (not cached or cache expired)
    const result = validator.validateFile(filePath);

    // Update validation cache
    if (!ProtocolLoader.validationCache) {
      ProtocolLoader.validationCache = new Map();
    }
    ProtocolLoader.validationCache.set(filePath, result);

    // Note: We do NOT update metadataCacheTime here - it's updated once per cache rebuild
    // This ensures validation cache and metadata cache are rebuilt together

    return result;
  }
}
