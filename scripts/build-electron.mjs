import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const dev = process.argv.includes('--dev');

/** Main process and preloads are bundled to CJS, which is what Electron loads. */
const common = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  external: ['electron'],
  sourcemap: dev,
  minify: !dev,
  define: { 'process.env.APP_VERSION': JSON.stringify(pkg.version) },
  logLevel: 'info',
};

await build({
  ...common,
  entryPoints: [path.join(root, 'electron/main.ts')],
  outfile: path.join(root, 'dist/main/index.js'),
});

await build({
  ...common,
  entryPoints: [
    path.join(root, 'electron/preload/main.ts'),
    path.join(root, 'electron/preload/window.ts'),
  ],
  outdir: path.join(root, 'dist/preload'),
});
