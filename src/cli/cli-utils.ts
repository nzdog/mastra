/**
 * CLI Utilities
 *
 * Terminal output and confirmation prompts
 */

import * as readline from 'readline';

/**
 * Prompt user for yes/no confirmation
 */
export async function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${question} (y/n): `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes');
    });
  });
}

/**
 * Color codes for terminal output (simple ANSI escape codes)
 */
export const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

/**
 * Format error message
 */
export function error(message: string): string {
  return `${colors.red}❌ ${message}${colors.reset}`;
}

/**
 * Format success message
 */
export function success(message: string): string {
  return `${colors.green}✅ ${message}${colors.reset}`;
}

/**
 * Format warning message
 */
export function warning(message: string): string {
  return `${colors.yellow}⚠️  ${message}${colors.reset}`;
}

/**
 * Format info message
 */
export function info(message: string): string {
  return `${colors.cyan}ℹ️  ${message}${colors.reset}`;
}

/**
 * Format section header
 */
export function header(message: string): string {
  return `${colors.blue}${message}${colors.reset}`;
}

/**
 * Format gray text
 */
export function gray(message: string): string {
  return `${colors.gray}${message}${colors.reset}`;
}
