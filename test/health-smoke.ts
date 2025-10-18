import { spawn } from 'child_process';
import fetch from 'node-fetch';

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  // Start server in background
  const server = spawn('npm', ['run', 'server'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, SKIP_API_KEY_CHECK: 'true' },
  });

  try {
    // Phase 3.2: Poll /readyz endpoint with exponential backoff
    let retries = 0;
    const maxRetries = 30;
    let delay = 100;
    let ready = false;

    while (retries < maxRetries && !ready) {
      try {
        const res = await fetch('http://localhost:3000/readyz');
        if (res.status === 200) {
          ready = true;
          break;
        }
      } catch (err) {
        // Server not yet accepting connections
      }

      await wait(delay);
      retries++;
      delay = Math.min(delay * 1.5, 2000); // Exponential backoff, max 2s
    }

    if (!ready) {
      throw new Error(`Server did not become ready after ${maxRetries} retries`);
    }

    // Now test /v1/health endpoint
    const res = await fetch('http://localhost:3000/v1/health');
    if (res.status !== 200) {
      throw new Error(`Expected 200 but got ${res.status}`);
    }

    const json = await res.json();
    const required = ['status', 'active_sessions', 'memory_usage', 'version', 'policyVersion'];

    for (const k of required) {
      if (!(k in json)) {
        throw new Error(`Missing key in response: ${k}`);
      }
    }

    const apiVersion = res.headers.get('x-api-version');
    const specVersion = res.headers.get('x-spec-version');

    if (!apiVersion || !specVersion) {
      throw new Error('Missing required headers');
    }

    console.log('Health smoke test passed');
    process.exit(0);
  } catch (err) {
    console.error('Smoke test failed:', err);
    process.exit(2);
  } finally {
    // Kill server process
    server.kill();
  }
}

main();
