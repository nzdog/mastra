/**
 * COHERENCE ENGINE
 * Main entry point
 */

import { startServer } from './api/server';

// Get port from environment or default to 3000
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Start the server
startServer(PORT);

