/**
 * ENVIRONMENT VALIDATION
 * Validates required environment variables on startup
 */

interface EnvConfig {
  PORT?: string;
  NODE_ENV?: string;
  CORS_ORIGIN?: string;
  COHERENCE_API_KEY?: string;
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
    COHERENCE_API_KEY: process.env.COHERENCE_API_KEY,
  };

  // Warnings for production without certain variables
  if (config.NODE_ENV === 'production') {
    if (!config.CORS_ORIGIN) {
      console.warn(
        'WARNING: CORS_ORIGIN not set in production. Using default: http://localhost:3001'
      );
    }

    if (!config.COHERENCE_API_KEY) {
      console.warn(
        'WARNING: COHERENCE_API_KEY not set in production. API endpoints will be unprotected!'
      );
    }
  }

  // Warning for development if API key is not set
  if (config.NODE_ENV === 'development' && !config.COHERENCE_API_KEY) {
    console.warn(
      'INFO: COHERENCE_API_KEY not set. API endpoints will return 500 errors. Set COHERENCE_API_KEY to enable authentication.'
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
