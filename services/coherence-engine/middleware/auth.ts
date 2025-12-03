/**
 * API KEY AUTHENTICATION MIDDLEWARE
 * Secures Coherence Engine API endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * API Key Authentication Middleware
 *
 * Validates API key from request headers
 * Expected header: x-api-key
 *
 * @param req - Express request
 * @param res - Express response
 * @param next - Express next function
 */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  const validApiKey = process.env.COHERENCE_API_KEY;

  // Allow unauthenticated access if no API key configured (development mode)
  if (!validApiKey) {
    if (process.env.NODE_ENV === 'production') {
      logger.error('COHERENCE_API_KEY not configured in production');
      res.status(500).json({
        error: 'Server configuration error',
        message: 'API authentication not properly configured',
      });
      return;
    }
    // Development: warn but allow
    logger.warn('COHERENCE_API_KEY not set - authentication bypassed');
    next();
    return;
  }

  // API key is configured, validate it
  const apiKey = req.headers['x-api-key'];

  // Check if API key is provided
  if (!apiKey) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'API key required. Provide via x-api-key header.',
    });
    return;
  }

  // Check if API key matches
  if (apiKey !== validApiKey) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key',
    });
    return;
  }

  // API key is valid, proceed
  next();
}
