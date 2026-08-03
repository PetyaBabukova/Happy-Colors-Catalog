import { spawn } from 'node:child_process';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildE2eServerEnv, getE2eRuntimeSettings } from '../e2e/runtime-env.js';
import { loadTestEnv } from './loadTestEnv.js';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..');
const cacheDir = path.join(repoRoot, '.playwright-cache');
const playwrightCliPath = path.join(repoRoot, 'node_modules', '@playwright', 'test', 'cli.js');

loadTestEnv();

const sanitizedEnv = Object.fromEntries(
  Object.entries(process.env).filter(([key, value]) => (
    key &&
    !key.startsWith('=') &&
    typeof value !== 'undefined'
  ))
);

const settings = getE2eRuntimeSettings(process.env);

const testEnv = {
  ...buildE2eServerEnv(sanitizedEnv, settings),
  PWTEST_CACHE_DIR: process.env.PWTEST_CACHE_DIR || cacheDir,
};

function waitForServer(url, { timeoutMs = 120_000, isAborted = () => false } = {}) {
  const startedAt = Date.now();
  const client = url.startsWith('https:') ? https : http;

  return new Promise((resolve, reject) => {
    let isSettled = false;

    const settle = (callback, value) => {
      if (isSettled) {
        return;
      }

      isSettled = true;
      callback(value);
    };

    const poll = () => {
      if (isAborted()) {
        settle(reject, new Error('web server process exited before it became ready'));
        return;
      }

      const request = client.get(url, (response) => {
        response.resume();
        if (response.statusCode && response.statusCode >= 500) {
          if (Date.now() - startedAt > timeoutMs) {
            settle(reject, new Error(`web server returned HTTP ${response.statusCode}`));
            return;
          }

          setTimeout(poll, 500);
          return;
        }

        settle(resolve);
      });

      request.on('error', (error) => {
        if (Date.now() - startedAt > timeoutMs) {
          settle(reject, error);
          return;
        }

        setTimeout(poll, 500);
      });

      request.setTimeout(5_000, () => {
        request.destroy(new Error('request timed out'));
      });
    };

    poll();
  });
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, options);

    child.on('error', reject);
    child.on('exit', (code, signal) => {
      resolve({ code, signal });
    });
  });
}

function waitForProcessExit(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    const handleExit = () => {
      clearTimeout(timeout);
      resolve(true);
    };
    const timeout = setTimeout(() => {
      child.removeListener('exit', handleExit);
      resolve(false);
    }, timeoutMs);

    child.once('exit', handleExit);

    if (child.exitCode !== null || child.signalCode !== null) {
      handleExit();
    }
  });
}

let stopServerPromise;

function stopServer(serverProcess) {
  if (stopServerPromise) {
    return stopServerPromise;
  }

  stopServerPromise = stopServerProcess(serverProcess);
  return stopServerPromise;
}

async function stopServerProcess(serverProcess) {
  if (!serverProcess.pid || serverProcess.exitCode !== null || serverProcess.signalCode !== null) {
    return;
  }

  serverProcess.kill('SIGTERM');

  if (await waitForProcessExit(serverProcess, 5_000)) {
    return;
  }

  if (process.platform === 'win32' && serverProcess.pid) {
    await runCommand('taskkill.exe', ['/PID', String(serverProcess.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    }).catch(() => {});

    if (await waitForProcessExit(serverProcess, 5_000)) {
      return;
    }
  }

  serverProcess.kill('SIGKILL');

  if (!await waitForProcessExit(serverProcess, 5_000)) {
    throw new Error(`Unable to stop Playwright web server process ${serverProcess.pid}.`);
  }
}

const serverProcess = spawn(process.execPath, ['server.js'], {
  cwd: repoRoot,
  env: testEnv,
  stdio: 'inherit',
  windowsHide: true,
});

let serverExitedBeforeReady = false;

serverProcess.once('exit', () => {
  serverExitedBeforeReady = true;
});

async function run() {
  try {
    await waitForServer(settings.baseURL, {
      isAborted: () => serverExitedBeforeReady,
    });
  } catch (error) {
    throw new Error(`Playwright web server did not start at ${settings.baseURL}: ${error?.message || error}`);
  }

  if (serverExitedBeforeReady) {
    throw new Error('Playwright web server exited before tests started.');
  }

  const playwrightArgs = [
    playwrightCliPath,
    'test',
    '--config=e2e/playwright.config.js',
    ...process.argv.slice(2),
  ];

  const result = await runCommand(process.execPath, playwrightArgs, {
    cwd: repoRoot,
    env: {
      ...testEnv,
      E2E_MANAGED_SERVER: 'true',
    },
    stdio: 'inherit',
    windowsHide: true,
  });

  await stopServer(serverProcess);

  if (result.signal) {
    process.kill(process.pid, result.signal);
    return;
  }

  process.exitCode = result.code ?? 1;
}

process.once('SIGINT', async () => {
  await stopServer(serverProcess);
  process.exit(130);
});

process.once('SIGTERM', async () => {
  await stopServer(serverProcess);
  process.exit(143);
});

run().catch(async (error) => {
  await stopServer(serverProcess);
  console.error(error?.message || error);
  process.exitCode = 1;
});
