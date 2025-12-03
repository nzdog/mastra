/**
 * COHERENCE ENGINE
 * Main entry point
 */

import { startServer } from './api/server';
import { validateEnv, getPort } from './utils/env';
import { logger } from './utils/logger';

try {
  // Validate environment variables
  validateEnv();

  // Get port and start server
  const PORT = getPort();
  logger.info('Starting Coherence Engine', {
    port: PORT,
    env: process.env.NODE_ENV || 'development',
  });

  startServer(PORT);
} catch (error) {
  logger.error('Failed to start server', { error });
  process.exit(1);
}
