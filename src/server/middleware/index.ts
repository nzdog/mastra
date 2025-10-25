/**
 * Middleware Module
 *
 * Centralizes all Express middleware:
 * - Security headers (Helmet)
 * - CORS configuration and preflight handling
 * - API key validation
 * - Request body parsing
 */

import express, { Request, Response, NextFunction, Express } from 'express';
import helmet from 'helmet';
import { AppConfig } from '../config';
import { isOriginAllowed, getCorsHeaders, getPreflightHeaders } from '../../config/cors';
import {
  corsPreflightTotal,
  corsRejectTotal,
  corsPreflightDuration,
} from '../../observability/metrics';

/**
 * API Key validation middleware
 * Validates X-API-Key header against X_API_KEY environment variable
 * Returns 401 if key is missing or incorrect (when X_API_KEY is set)
 */
export function validateApiKey(req: Request, res: Response, next: NextFunction): void {
  const expectedKey = process.env.X_API_KEY;

  // If X_API_KEY not configured, skip validation (dev/test mode)
  if (!expectedKey) {
    next();
    return;
  }

  const providedKey = req.headers['x-api-key'];

  // Fail closed: reject if key is missing or incorrect
  if (!providedKey || providedKey !== expectedKey) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Valid X-API-Key header required',
    });
    return;
  }

  next();
}

/**
 * Apply all middleware to the Express app
 *
 * Order of middleware:
 * 1. Trust proxy (for rate limiting behind reverse proxies)
 * 2. Helmet (security headers)
 * 3. CORS middleware
 * 4. CORS preflight handler
 * 5. Additional security headers
 * 6. Body parser (JSON with size limit)
 *
 * @param app - Express application instance
 * @param config - Application configuration
 */
export function applyMiddleware(app: Express, config: AppConfig): void {
  // Trust proxy - Critical for rate limiting behind reverse proxies (Railway, Heroku, etc.)
  // Without this, all requests appear to come from the proxy's IP, breaking per-client rate limits
  app.set('trust proxy', 1);

  // Security Headers - Helmet configuration
  app.use(
    helmet({
      // Content Security Policy - prevents XSS attacks
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'], // Allow inline scripts and jsPDF CDN
          styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for frontend
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"], // API calls only to same origin
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
          upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
        },
      },
      // Strict Transport Security - forces HTTPS (disabled in dev)
      hsts:
        process.env.NODE_ENV === 'production'
          ? {
              maxAge: 31536000, // 1 year
              includeSubDomains: true,
              preload: true,
            }
          : false,
      // Hide X-Powered-By header
      hidePoweredBy: true,
      // Prevent clickjacking
      frameguard: { action: 'deny' },
      // Prevent MIME type sniffing
      noSniff: true,
      // XSS Protection (legacy but still useful)
      xssFilter: true,
    })
  );

  // CORS middleware - applies to all routes
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.get('Origin');

    if (isOriginAllowed(origin, config.corsConfig)) {
      const corsHeaders = getCorsHeaders(origin, config.corsConfig);
      if (corsHeaders) {
        Object.entries(corsHeaders).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
      }
    } else if (origin) {
      // Log rejection with route info (no PII)
      console.warn(`🚫 CORS: Rejected origin="${origin}" on route="${req.path}"`);
      corsRejectTotal.labels(req.path).inc();
    }

    next();
  });

  // Enhanced CORS middleware - handles preflight (OPTIONS) requests
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'OPTIONS') {
      const start = Date.now();
      const origin = req.get('Origin');
      const route = req.path;

      const preflightHeaders = getPreflightHeaders(origin, config.corsConfig);

      if (preflightHeaders) {
        // Origin allowed
        Object.entries(preflightHeaders).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
        corsPreflightTotal.labels(route, 'true').inc();
      } else {
        // Origin rejected - no CORS headers (but still return 200)
        corsPreflightTotal.labels(route, 'false').inc();
      }

      // Measure preflight duration
      const duration = Date.now() - start;
      corsPreflightDuration.observe(duration);

      // End OPTIONS request
      res.status(200).end();
      return;
    }

    next();
  });

  // Additional Security Headers (Phase 1.2: CORS Hardening)
  // Helmet provides most headers, but we add explicit ones per spec
  app.use((_req: Request, res: Response, next: NextFunction) => {
    // Referrer-Policy: no-referrer (privacy hardening)
    res.setHeader('Referrer-Policy', 'no-referrer');

    // X-Content-Type-Options: nosniff (already set by Helmet, but explicit)
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Permissions-Policy: minimal (disable unnecessary features)
    // Disable geolocation, microphone, camera, payment, USB, etc.
    res.setHeader(
      'Permissions-Policy',
      'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=()'
    );

    next();
  });

  // Request body parser with size limit for security
  app.use(express.json({ limit: '1mb' }));
}
