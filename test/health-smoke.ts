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
    // Wait for server to boot
    await wait(1500);

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
