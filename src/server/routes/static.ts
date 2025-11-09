/**
 * Static Content Routes
 *
 * Provides static asset and page serving endpoints:
 * - GET /test-route - Simple test endpoint
 * - GET /lichen-logo.png - Logo asset
 * - GET /assets/css/*.css - CSS stylesheets
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
    // Use process.cwd() to get project root, works regardless of tsx or compiled code
    const logoPath = path.join(process.cwd(), 'lichen-logo.png');
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

  // GET /assets/css/*.css - CSS files
  router.get('/assets/css/:filename', (req: Request, res: Response) => {
    const filename = req.params.filename;

    // Security: Only allow .css files and prevent directory traversal
    if (!filename.endsWith('.css') || filename.includes('..') || filename.includes('/')) {
      return res.status(400).send('Invalid filename');
    }

    const cssPath = path.join(process.cwd(), 'assets', 'css', filename);
    console.log(`🎨 CSS route hit for: ${filename}`);
    console.log(`🎨 Serving CSS from: ${cssPath}`);

    if (fs.existsSync(cssPath)) {
      try {
        const cssContent = fs.readFileSync(cssPath, 'utf-8');
        res.setHeader('Content-Type', 'text/css');
        res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
        res.send(cssContent);
        console.log(`✅ CSS served: ${filename}`);
      } catch (error) {
        console.error(`❌ Error serving CSS ${filename}:`, error);
        res.status(500).send('Error loading CSS file');
      }
    } else {
      console.error(`❌ CSS file not found: ${cssPath}`);
      res.status(404).send(`CSS file not found: ${filename}`);
    }
  });

  // GET / - Root endpoint - Serve the production frontend
  router.get('/', (_req: Request, res: Response) => {
    // Use process.cwd() to get project root, works regardless of tsx or compiled code
    const indexPath = path.join(process.cwd(), 'index.html');
    console.log(`📄 Attempting to serve index.html from: ${indexPath}`);
    console.log(`📄 File exists: ${fs.existsSync(indexPath)}`);
    console.log(`📄 process.cwd(): ${process.cwd()}`);

    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send(`Frontend not found. Checked: ${indexPath}`);
    }
  });

  // GET /test - Test interface
  router.get('/test', (_req: Request, res: Response) => {
    // Use process.cwd() to get project root, works regardless of tsx or compiled code
    const testFilePath = path.join(process.cwd(), 'test-frontend.html');

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
