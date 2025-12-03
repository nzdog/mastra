/**
 * LOGGING UTILITY
 * Centralized logging with levels and structured output
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: unknown;
}

/**
 * Format and output log entry
 */
function log(level: LogLevel, message: string, data?: unknown): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };

  if (data !== undefined) {
    entry.data = data;
  }

  // In production, this could be sent to a logging service
  // For now, output to console with appropriate method
  const output = JSON.stringify(entry);

  switch (level) {
    case 'error':
      console.error(output);
      break;
    case 'warn':
      console.warn(output);
      break;
    case 'info':
    case 'debug':
      console.log(output);
      break;
  }
}

/**
 * Logger interface
 */
export const logger = {
  info: (message: string, data?: unknown): void => log('info', message, data),
  warn: (message: string, data?: unknown): void => log('warn', message, data),
  error: (message: string, data?: unknown): void => log('error', message, data),
  debug: (message: string, data?: unknown): void => log('debug', message, data),
};
