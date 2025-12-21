#!/usr/bin/env node
/**
 * Protocol Validation CLI Tool
 *
 * Commands:
 * - npm run validate:protocols
 * - npm run validate:protocols -- --file protocols/my_protocol.md
 * - npm run validate:protocols --fix
 * - npm run validate:protocols --fix --yes
 * - npm run validate:protocols --fix --dry-run
 * - npm run validate:protocols --strict
 * - npm run validate:protocols --quiet
 */

import * as path from 'path';
import { ProtocolValidator } from '../protocol/validation';
import { ProtocolNormalizer } from '../protocol/normalization';
import { ValidationResult } from '../protocol/validation/types';
//import { NormalizationResult } from '../protocol/normalization/types';
import { error, success, warning, info, header, gray, confirm } from './cli-utils';
import { formatDiff, formatSummary } from './diff-formatter';

// Parse command line arguments
interface CliOptions {
  file?: string;
  fix: boolean;
  yes: boolean;
  dryRun: boolean;
  strict: boolean;
  quiet: boolean;
  formatFrontmatter: boolean;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    fix: false,
    yes: false,
    dryRun: false,
    strict: false,
    quiet: false,
    formatFrontmatter: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--file' && i + 1 < args.length) {
      options.file = args[i + 1];
      i++;
    } else if (arg === '--fix') {
      options.fix = true;
    } else if (arg === '--yes') {
      options.yes = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--strict') {
      options.strict = true;
    } else if (arg === '--quiet') {
      options.quiet = true;
    } else if (arg === '--format-frontmatter') {
      options.formatFrontmatter = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
Protocol Validation Tool

Usage:
  npm run validate:protocols [options]

Options:
  --file <path>           Validate specific file
  --fix                   Apply automatic formatting fixes
  --yes                   Auto-apply fixes without confirmation
  --dry-run               Show diff only, don't modify files
  --strict                Treat warnings as errors
  --quiet                 Show errors only
  --format-frontmatter    Reformat YAML frontmatter (warns about comment loss)
  --help, -h              Show this help message

Examples:
  # Validate all protocols
  npm run validate:protocols

  # Validate specific file
  npm run validate:protocols -- --file protocols/field_diagnostic.md

  # Show diff and prompt before fixing
  npm run validate:protocols --fix

  # Auto-apply fixes without confirmation
  npm run validate:protocols --fix --yes

  # Show diff only, don't modify
  npm run validate:protocols --fix --dry-run

  # Strict mode (warnings treated as errors)
  npm run validate:protocols --strict
`);
}

async function main(): Promise<void> {
  const options = parseArgs();
  const validator = new ProtocolValidator();
  const normalizer = new ProtocolNormalizer();

  const protocolsDir = path.join(process.cwd(), 'protocols');

  let results: ValidationResult[];

  // Validate single file or all files
  if (options.file) {
    const filePath = path.isAbsolute(options.file)
      ? options.file
      : path.join(process.cwd(), options.file);

    console.log(header(`\nValidating ${path.basename(filePath)}...\n`));
    const result = validator.validateFile(filePath);
    results = [result];
  } else {
    console.log(header('\nValidating all protocols...\n'));
    results = validator.validateDirectory(protocolsDir);
  }

  // Display results
  let hasAnyErrors = false;
  let hasAnyWarnings = false;

  for (const result of results) {
    const showFile = !options.file || results.length > 1;

    if (result.hasErrors) {
      hasAnyErrors = true;
      console.log(error(`${showFile ? `${result.filename}: ` : ''}ERRORS (${result.errorCount})`));

      if (!options.quiet) {
        result.errors.forEach((err) => {
          console.log(`  ❌ ${err.message}`);
          if (err.location) {
            console.log(gray(`     Location: ${err.location}`));
          }
          if (err.suggestion) {
            console.log(gray(`     Suggestion: ${err.suggestion}`));
          }
        });
        console.log('');
      }
    }

    if (result.hasWarnings && !options.quiet) {
      hasAnyWarnings = true;
      console.log(warning(`${showFile ? `${result.filename}: ` : ''}WARNINGS (${result.warningCount})`));

      result.warnings.forEach((warn) => {
        console.log(`  ⚠️  ${warn.message}`);
        if (warn.suggestion) {
          console.log(gray(`     Suggestion: ${warn.suggestion}`));
        }
      });
      console.log('');
    }

    if (result.info.length > 0 && !options.quiet) {
      result.info.forEach((i) => {
        console.log(info(i.message));
      });
      console.log('');
    }

    // If no errors and no warnings, show success
    if (!result.hasErrors && !result.hasWarnings && !options.quiet) {
      console.log(success(`${result.filename}: Valid`));
      console.log('');
    }

    // Apply fixes if requested
    if (options.fix && !result.hasErrors) {
      await applyFixes(result.filePath, normalizer, options);
    }
  }

  // Summary
  const totalErrors = results.reduce((sum, r) => sum + r.errorCount, 0);
  const totalWarnings = results.reduce((sum, r) => sum + r.warningCount, 0);

  console.log(header('\n=== Summary ==='));
  console.log(`Files validated: ${results.length}`);
  console.log(`Errors: ${totalErrors}`);
  console.log(`Warnings: ${totalWarnings}`);

  // Exit code
  if (hasAnyErrors) {
    console.log(error('\nValidation failed with errors'));
    process.exit(1);
  } else if (hasAnyWarnings && options.strict) {
    console.log(error('\nValidation failed (warnings treated as errors in strict mode)'));
    process.exit(1);
  } else if (hasAnyWarnings) {
    console.log(warning('\nValidation passed with warnings'));
    process.exit(0);
  } else {
    console.log(success('\nValidation passed'));
    process.exit(0);
  }
}

async function applyFixes(
  filePath: string,
  normalizer: ProtocolNormalizer,
  options: CliOptions
): Promise<void> {
  console.log(info(`Checking for auto-fixable issues in ${path.basename(filePath)}...`));

  // Normalize content (dry run first to check for changes)
  const dryRunResult = normalizer.normalizeFile(
    filePath,
    {
      fixWhitespace: true,
      fixBulletSpacing: true,
      fixOutcomesCasing: true,
      formatFrontmatter: options.formatFrontmatter,
    },
    true // dry run
  );

  if (!dryRunResult.success) {
    console.log(error(`Failed to normalize: ${dryRunResult.error}`));
    return;
  }

  const result = dryRunResult.result;

  if (!result.hasChanges) {
    console.log(success('No formatting issues found'));
    return;
  }

  // Show changes
  console.log(formatSummary(result.changeCount));
  console.log(header('\n📋 Proposed changes:\n'));
  console.log(formatDiff(result.changes));

  if (options.dryRun) {
    console.log(info('\n🔍 DRY RUN MODE - No files modified'));
    console.log(gray('   Remove --dry-run to apply changes'));
    return;
  }

  // Confirm changes (unless --yes)
  let shouldApply = options.yes;
  if (!shouldApply) {
    console.log(gray(`\n💾 Backup will be saved to: ${path.basename(filePath)}.backup\n`));
    shouldApply = await confirm('Apply changes?');
  }

  if (!shouldApply) {
    console.log(info('Changes not applied'));
    return;
  }

  // Apply changes
  const applyResult = normalizer.normalizeFile(
    filePath,
    {
      fixWhitespace: true,
      fixBulletSpacing: true,
      fixOutcomesCasing: true,
      formatFrontmatter: options.formatFrontmatter,
    },
    false // not a dry run
  );

  if (!applyResult.success) {
    console.log(error(`Failed to apply changes: ${applyResult.error}`));
    return;
  }

  if (applyResult.backupPath) {
    console.log(success(`Backup saved: ${path.basename(applyResult.backupPath)}`));
  }
  console.log(success(`Applied ${result.changeCount} formatting fix(es)`));
}

// Run CLI
main().catch((err) => {
  console.error(error(`Unexpected error: ${err.message}`));
  process.exit(1);
});
