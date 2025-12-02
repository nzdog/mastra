/**
 * MVE (Minimum Viable Experiment) - Week 1 Observability
 * Part of: Dual-Observation Experiment for Memory Architecture
 * Plan: ~/.claude/plans/parsed-swimming-avalanche.md
 * Safe to remove after: Memory layer implementation complete
 */

import { writeFile, appendFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { Observer, ObservationEvent } from './mve-types';

/**
 * JSONL sink - writes observation events to newline-delimited JSON files
 * with buffering and graceful shutdown
 */
export class JsonSink implements Observer {
  private buffer: ObservationEvent[] = [];
  private readonly bufferSize: number;
  private readonly outputDir: string;
  private readonly filename: string;
  private enabled: boolean;
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(options: {
    outputDir?: string;
    filename?: string;
    bufferSize?: number;
    autoFlushIntervalMs?: number;
  } = {}) {
    this.outputDir = options.outputDir || './mve-data';
    this.filename = options.filename || `session-${Date.now()}.jsonl`;
    this.bufferSize = options.bufferSize || 10;
    this.enabled = process.env.OBSERVABILITY_ENABLED === 'true';

    // Auto-flush every N milliseconds
    if (options.autoFlushIntervalMs && this.enabled) {
      this.flushInterval = setInterval(() => {
        this.flush().catch(err =>
          console.error('[MVE] Auto-flush error:', err)
        );
      }, options.autoFlushIntervalMs);
    }

    // Ensure output directory exists
    if (this.enabled) {
      this.ensureOutputDir().catch(err =>
        console.error('[MVE] Failed to create output directory:', err)
      );
    }
  }

  private async ensureOutputDir(): Promise<void> {
    if (!existsSync(this.outputDir)) {
      await mkdir(this.outputDir, { recursive: true });
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async observe(event: ObservationEvent): Promise<void> {
    if (!this.enabled) return;

    this.buffer.push(event);

    // Auto-flush when buffer is full
    if (this.buffer.length >= this.bufferSize) {
      await this.flush();
    }
  }

  async flush(): Promise<void> {
    if (!this.enabled || this.buffer.length === 0) return;

    const filePath = join(this.outputDir, this.filename);
    const lines = this.buffer.map(event => JSON.stringify(event)).join('\n') + '\n';

    try {
      // Append to file (or create if doesn't exist)
      await appendFile(filePath, lines, 'utf-8');
      this.buffer = [];
    } catch (err) {
      console.error('[MVE] Failed to write events:', err);
      throw err;
    }
  }

  /**
   * Cleanup - flush remaining events and clear interval
   */
  async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    await this.flush();
  }
}
