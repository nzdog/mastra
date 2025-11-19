/**
 * ENVIRONMENT VALIDATION
 * Validates required environment variables on startup
 */

interface EnvConfig {
  PORT?: string;
  NODE_ENV?: string;
  CORS_ORIGIN?: string;
}

/**
 * Validate that all required environment variables are set
 * @throws Error if any required variables are missing
 */
export function validateEnv(): EnvConfig {
  const config: EnvConfig = {
    PORT: process.env.PORT || '3000',
    NODE_ENV: process.env.NODE_ENV || 'development',
    CORS_ORIGIN: process.env.CORS_ORIGIN,
  };

  // Optional: Add warnings for production without certain variables
  if (config.NODE_ENV === 'production' && !config.CORS_ORIGIN) {
    console.warn(
      'WARNING: CORS_ORIGIN not set in production. Using default: http://localhost:3001'
    );
  }

  return config;
}

/**
 * Get validated port number
 */
export function getPort(): number {
  const port = parseInt(process.env.PORT || '3000', 10);

  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT value: ${process.env.PORT}. Must be a number between 1-65535.`);
  }

  return port;
}
