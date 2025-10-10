import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';

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

    constructor(protocolsDir?: string) {
        this.protocolsDir = protocolsDir || path.join(__dirname, '../../protocols');
    }

    /**
     * Scan the protocols directory and return metadata for all protocols
     */
    public listProtocols(): ProtocolMetadata[] {
        const protocols: ProtocolMetadata[] = [];

        try {
            const files = fs.readdirSync(this.protocolsDir);

            for (const file of files) {
                // Only process .md files, skip template and README
                if (!file.endsWith('.md') ||
                    file === 'PROTOCOL_TEMPLATE.md' ||
                    file === 'README.md') {
                    continue;
                }

                const filePath = path.join(this.protocolsDir, file);
                const metadata = this.getProtocolMetadata(filePath);

                if (metadata) {
                    protocols.push(metadata);
                }
            }
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
        return protocols.find(p => p.slug === slug) || null;
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
                file_path: filePath
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
}
