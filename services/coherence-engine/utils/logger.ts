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

  if (process.env.NODE_ENV === 'production') {
    // JSON for log aggregation services
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
  } else {
    // Human-readable for development
    const colors = {
      error: '\x1b[31m',   // Red
      warn: '\x1b[33m',    // Yellow
      info: '\x1b[36m',    // Cyan
      debug: '\x1b[90m',   // Gray
    };
    const reset = '\x1b[0m';
    const color = colors[level];

    const timestamp = new Date().toISOString().split('T')[1].slice(0, 12); // Just time portion
    const dataStr = data ? ` ${JSON.stringify(data, null, 2)}` : '';

    console.log(`${color}[${level.toUpperCase()}]${reset} ${timestamp} ${message}${dataStr}`);
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
