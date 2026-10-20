import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 5173;
const DEV_URL = `http://localhost:${PORT}/`;

// The local CLIs are invoked through node directly: spawning npx.cmd would need
// `shell: true`, which on Windows concatenates arguments unescaped.
const VITE = path.join(root, 'node_modules/vite/bin/vite.js');
const ELECTRON = path.join(root, 'node_modules/electron/cli.js');

const children = [];
function shutdown(code = 0) {
  for (const child of children) child.kill();
  process.exit(code);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

function node(script, args = [], env = {}) {
  const child = spawn(process.execPath, [script, ...args], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  children.push(child);
  return child;
}

/**
 * Vite binds localhost, which on this machine resolves to ::1 only, so a probe
 * hardcoded to 127.0.0.1 never connects. Going through fetch lets Node resolve
 * the name the same way the browser will.
 */
async function waitForVite(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fetch(DEV_URL, { signal: AbortSignal.timeout(1_000) });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  throw new Error(`Vite nao subiu em ${DEV_URL} dentro do tempo limite.`);
}

// 1. Bundle main + preloads with sourcemaps.
const bundler = node(path.join(root, 'scripts/build-electron.mjs'), ['--dev']);
await new Promise((resolve, reject) =>
  bundler.on('exit', (code) =>
    code === 0 ? resolve() : reject(new Error(`build-electron falhou (${code})`)),
  ),
);

// 2. Vite dev server for the renderers.
node(VITE);
await waitForVite();

// 3. Electron, pointed at the dev server.
const electron = node(ELECTRON, ['.'], { VITE_DEV_SERVER_URL: DEV_URL });
electron.on('exit', (code) => shutdown(code ?? 0));
