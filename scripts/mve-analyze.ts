/**
 * MVE (Minimum Viable Experiment) - Week 1 Observability Analysis
 * Part of: Dual-Observation Experiment for Memory Architecture
 * Plan: ~/.claude/plans/parsed-swimming-avalanche.md
 * Safe to remove after: Memory layer implementation complete
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { ObservationEvent } from '../src/observability/mve-types';

interface AnnotatedEvent extends ObservationEvent {
  annotation?: {
    tags: string[];  // e.g., ["field_emergence", "breakthrough"]
    note?: string;
  };
}

/**
 * Parse JSONL file into array of events
 */
function parseJsonl(filePath: string): AnnotatedEvent[] {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  return lines.map(line => JSON.parse(line));
}

/**
 * Print session timeline (mode and theme progression)
 */
function printTimeline(events: AnnotatedEvent[]) {
  console.log('\n=== SESSION TIMELINE ===\n');

  const modeEvents = events.filter(e => e.event_type === 'mode_decision');
  const themeEvents = events.filter(e => e.event_type === 'theme_answer');

  console.log('Mode Progression:');
  modeEvents.forEach((e, i) => {
    if (e.event_type === 'mode_decision') {
      console.log(`  ${i + 1}. ${e.timestamp} → ${e.mode}`);
    }
  });

  console.log('\nTheme Progression:');
  themeEvents.forEach((e, i) => {
    if (e.event_type === 'theme_answer') {
      const spotlights = e.spotlight_flags.length > 0
        ? ` 🔦 [${e.spotlight_flags.join(', ')}]`
        : '';
      console.log(`  ${i + 1}. Theme ${e.theme_index}${spotlights}`);
    }
  });
}

/**
 * Print all spotlight hits (field emergence indicators)
 */
function printSpotlights(events: AnnotatedEvent[]) {
  console.log('\n=== SPOTLIGHT HITS ===\n');

  const themeEvents = events.filter(e =>
    e.event_type === 'theme_answer' && e.spotlight_flags.length > 0
  );

  if (themeEvents.length === 0) {
    console.log('No spotlight patterns detected.');
    return;
  }

  themeEvents.forEach(e => {
    if (e.event_type === 'theme_answer') {
      console.log(`Theme ${e.theme_index} - ${e.timestamp}`);
      console.log(`Flags: ${e.spotlight_flags.join(', ')}`);
      console.log(`Text: ${e.raw_text.substring(0, 150)}${e.raw_text.length > 150 ? '...' : ''}`);
      console.log('---');
    }
  });
}

/**
 * Print all manually annotated events
 */
function printAnnotations(events: AnnotatedEvent[]) {
  console.log('\n=== MANUAL ANNOTATIONS ===\n');

  const annotated = events.filter(e => e.annotation);

  if (annotated.length === 0) {
    console.log('No manual annotations found.');
    console.log('To add annotations, edit the JSONL file and add an "annotation" field:');
    console.log('{ ...event, "annotation": { "tags": ["field_emergence"], "note": "..." } }');
    return;
  }

  annotated.forEach(e => {
    console.log(`Event: ${e.event_type} at ${e.timestamp}`);
    console.log(`Tags: ${e.annotation!.tags.join(', ')}`);
    if (e.annotation!.note) {
      console.log(`Note: ${e.annotation!.note}`);
    }
    console.log('---');
  });
}

/**
 * Print classification accuracy summary
 */
function printClassifications(events: AnnotatedEvent[]) {
  console.log('\n=== CLASSIFICATION SUMMARY ===\n');

  const classEvents = events.filter(e => e.event_type === 'classification');

  if (classEvents.length === 0) {
    console.log('No classification events found.');
    return;
  }

  const labelCounts: Record<string, number> = {};
  let totalConfidence = 0;

  classEvents.forEach(e => {
    if (e.event_type === 'classification') {
      labelCounts[e.classification_label] = (labelCounts[e.classification_label] || 0) + 1;
      totalConfidence += e.confidence;
    }
  });

  console.log('Label Distribution:');
  Object.entries(labelCounts).forEach(([label, count]) => {
    console.log(`  ${label}: ${count} (${((count / classEvents.length) * 100).toFixed(1)}%)`);
  });

  console.log(`\nAverage Confidence: ${(totalConfidence / classEvents.length).toFixed(3)}`);
}

/**
 * Main analysis entry point
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: npm run mve:analyze <jsonl-file-or-directory>');
    console.log('Example: npm run mve:analyze ./mve-data/session-12345.jsonl');
    console.log('Example: npm run mve:analyze ./mve-data  # Analyze all files');
    process.exit(1);
  }

  const input = args[0];
  let files: string[] = [];

  // Check if input is a directory or file
  try {
    const stat = require('fs').statSync(input);
    if (stat.isDirectory()) {
      files = readdirSync(input)
        .filter(f => f.endsWith('.jsonl'))
        .map(f => join(input, f));
    } else {
      files = [input];
    }
  } catch (err) {
    console.error(`Error reading input: ${input}`);
    process.exit(1);
  }

  if (files.length === 0) {
    console.error('No JSONL files found.');
    process.exit(1);
  }

  console.log(`\nAnalyzing ${files.length} session(s)...\n`);

  files.forEach(file => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`FILE: ${file}`);
    console.log('='.repeat(60));

    const events = parseJsonl(file);
    console.log(`\nTotal events: ${events.length}`);

    printTimeline(events);
    printClassifications(events);
    printSpotlights(events);
    printAnnotations(events);
  });

  console.log('\n✅ Analysis complete.\n');
}

main();
