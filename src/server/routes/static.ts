/**
 * Static Content Routes
 *
 * Provides static asset and page serving endpoints:
 * - GET /test-route - Simple test endpoint
 * - GET /lichen-logo.png - Logo asset
 * - GET / - Production frontend (index.html)
 * - GET /test - Test interface (test-frontend.html)
 */

import { Router, Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Create static content router
 *
 * @returns Express router with static content endpoints
 */
export function createStaticRouter(): Router {
  const router = Router();

  // GET /test-route - Simple test endpoint
  router.get('/test-route', (_req: Request, res: Response) => {
    console.log('✅ Test route hit!');
    res.send('Test route works!');
  });

  // GET /lichen-logo.png - Logo asset
  router.get('/lichen-logo.png', (_req: Request, res: Response) => {
    console.log(`🖼️  Logo route hit!`);
    const logoPath = path.join(__dirname, '../../lichen-logo.png');
    console.log(`🖼️  Serving logo from: ${logoPath}`);
    console.log(`🖼️  File exists: ${fs.existsSync(logoPath)}`);

    try {
      const imageBuffer = fs.readFileSync(logoPath);
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Length', imageBuffer.length);
      res.send(imageBuffer);
      console.log(`✅ Logo served successfully`);
    } catch (error) {
      console.error(`❌ Error serving logo:`, error);
      res.status(404).send('Logo not found');
    }
  });

  // GET / - Root endpoint - Serve the production frontend
  router.get('/', (_req: Request, res: Response) => {
    const indexPath = path.join(__dirname, '../../index.html');

    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res
        .status(404)
        .send('Frontend not found. Please ensure index.html exists in the project root.');
    }
  });

  // GET /test - Test interface
  router.get('/test', (_req: Request, res: Response) => {
    const testFilePath = path.join(__dirname, '../../test-frontend.html');

    if (fs.existsSync(testFilePath)) {
      res.sendFile(testFilePath);
    } else {
      res
        .status(404)
        .send(
          'Test interface not found. Please ensure test-frontend.html exists in the project root.'
        );
    }
  });

  return router;
}
