/**
 * CORS Configuration Module
 *
 * Provides explicit origin allowlist with environment-driven configuration.
 * Safe defaults: no wildcard with credentials, minimal exposed headers.
 *
 * Environment Variables:
 * - CORS_ALLOWED_ORIGINS: Comma-separated list of allowed origins
 * - CORS_ALLOW_CREDENTIALS: Enable credentials (true/false, default: false)
 * - CORS_MAX_AGE: Preflight cache duration in seconds (default: 600)
 * - CORS_ALLOW_METHODS: Allowed HTTP methods (default: GET,POST,PUT,PATCH,DELETE,OPTIONS)
 * - CORS_ALLOW_HEADERS: Allowed request headers (default: minimal set)
 * - CORS_EXPOSE_HEADERS: Headers exposed to client (default: x-api-version,x-spec-version)
 */

export interface CorsConfig {
  allowedOrigins: Set<string>;
  allowCredentials: boolean;
  maxAge: number;
  allowMethods: string[];
  allowHeaders: string[];
  exposeHeaders: string[];
}

/**
 * Parse and validate CORS configuration from environment
 */
export function parseCorsConfig(): CorsConfig {
  const env = process.env.NODE_ENV || 'development';

  // Parse allowed origins (comma-separated)
  const originsStr = process.env.CORS_ALLOWED_ORIGINS || '';
  const allowedOrigins = new Set<string>(
    originsStr
      .split(',')
      .map((o) => o.trim())
      .filter((o) => o.length > 0)
  );

  // If no origins specified, use safe defaults for development
  if (allowedOrigins.size === 0) {
    if (env === 'production') {
      // Add Railway URLs from environment variables
      const railwayPublicDomain = process.env.RAILWAY_PUBLIC_DOMAIN;
      const railwayStaticUrl = process.env.RAILWAY_STATIC_URL;

      if (railwayPublicDomain) {
        allowedOrigins.add(`https://${railwayPublicDomain}`);
      }
      if (railwayStaticUrl) {
        allowedOrigins.add(railwayStaticUrl);
      }

      if (allowedOrigins.size === 0) {
        console.warn(
          '⚠️  CORS: No origins configured for production. Set CORS_ALLOWED_ORIGINS environment variable.'
        );
      } else {
        console.warn('⚠️  CORS: Using Railway environment origins');
      }
    } else {
      // Development defaults
      allowedOrigins.add('http://localhost:3000');
      allowedOrigins.add('http://localhost:3001'); // ui-tweaks worktree
      allowedOrigins.add('http://localhost:5173'); // Vite dev server
      allowedOrigins.add('http://127.0.0.1:3000');
      allowedOrigins.add('http://127.0.0.1:3001'); // ui-tweaks worktree
      allowedOrigins.add('http://127.0.0.1:5173');

      // Add Railway URLs from environment variables (for preview deployments)
      const railwayPublicDomain = process.env.RAILWAY_PUBLIC_DOMAIN;
      const railwayStaticUrl = process.env.RAILWAY_STATIC_URL;

      if (railwayPublicDomain) {
        allowedOrigins.add(`https://${railwayPublicDomain}`);
      }
      if (railwayStaticUrl) {
        allowedOrigins.add(railwayStaticUrl);
      }

      console.warn('⚠️  CORS: Using default development origins');
    }
  }

  // Parse credentials flag
  const allowCredentials = process.env.CORS_ALLOW_CREDENTIALS === 'true';

  // CRITICAL: Verify we never allow credentials with wildcard
  if (allowCredentials && allowedOrigins.has('*')) {
    throw new Error('CORS_ALLOW_CREDENTIALS cannot be true with wildcard (*) origin');
  }

  // Parse max age (preflight cache duration)
  const maxAge = parseInt(process.env.CORS_MAX_AGE || '600', 10);
  if (isNaN(maxAge) || maxAge < 0) {
    throw new Error('CORS_MAX_AGE must be a non-negative integer');
  }

  // Parse allowed methods
  const allowMethods = (process.env.CORS_ALLOW_METHODS || 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
    .split(',')
    .map((m) => m.trim().toUpperCase())
    .filter((m) => m.length > 0);

  // Parse allowed headers (minimal set by default)
  const defaultAllowHeaders = [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-API-Version',
    'X-Trace-ID',
    'X-API-Key',
  ];
  const allowHeaders = process.env.CORS_ALLOW_HEADERS
    ? process.env.CORS_ALLOW_HEADERS.split(',')
        .map((h) => h.trim())
        .filter((h) => h.length > 0)
    : defaultAllowHeaders;

  // Parse exposed headers (minimal set by default)
  const defaultExposeHeaders = ['X-API-Version', 'X-Spec-Version'];
  const exposeHeaders = process.env.CORS_EXPOSE_HEADERS
    ? process.env.CORS_EXPOSE_HEADERS.split(',')
        .map((h) => h.trim())
        .filter((h) => h.length > 0)
    : defaultExposeHeaders;

  const config: CorsConfig = {
    allowedOrigins,
    allowCredentials,
    maxAge,
    allowMethods,
    allowHeaders,
    exposeHeaders,
  };

  // Log resolved configuration at startup
  console.log('🌐 CORS Configuration:');
  console.log(`   Environment: ${env}`);
  console.log(`   Allowed Origins: ${config.allowedOrigins.size} origin(s)`);
  config.allowedOrigins.forEach((origin) => {
    console.log(`     - ${origin}`);
  });
  console.log(`   Credentials: ${config.allowCredentials}`);
  console.log(`   Max Age: ${config.maxAge}s`);
  console.log(`   Methods: ${config.allowMethods.join(', ')}`);
  console.log(`   Allow Headers: ${config.allowHeaders.length} header(s)`);
  console.log(`   Expose Headers: ${config.exposeHeaders.join(', ')}`);

  return config;
}

/**
 * Check if an origin is allowed
 */
export function isOriginAllowed(origin: string | undefined, config: CorsConfig): boolean {
  if (!origin) {
    return false; // No origin header = reject
  }

  // Check if origin is in allowlist
  return config.allowedOrigins.has(origin);
}

/**
 * Get CORS headers for a given origin
 * Returns null if origin is not allowed
 */
export function getCorsHeaders(
  origin: string | undefined,
  config: CorsConfig
): Record<string, string> | null {
  if (!isOriginAllowed(origin, config)) {
    return null; // Reject - no CORS headers
  }

  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': origin!,
    'Access-Control-Allow-Methods': config.allowMethods.join(', '),
    'Access-Control-Allow-Headers': config.allowHeaders.join(', '),
    'Access-Control-Expose-Headers': config.exposeHeaders.join(', '),
    'Access-Control-Max-Age': config.maxAge.toString(),
  };

  // Only set credentials header if enabled
  if (config.allowCredentials) {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

/**
 * Get CORS headers for preflight (OPTIONS) request
 */
export function getPreflightHeaders(
  origin: string | undefined,
  config: CorsConfig
): Record<string, string> | null {
  // Preflight uses same logic as regular CORS
  return getCorsHeaders(origin, config);
}
