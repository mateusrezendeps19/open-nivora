import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const testsDir = path.join(root, 'tests');
const outdir = path.join(root, 'dist/tests');

const entryPoints = readdirSync(testsDir)
  .filter((file) => file.endsWith('.test.ts'))
  .map((file) => path.join(testsDir, file));

if (entryPoints.length === 0) {
  console.error('nenhum arquivo *.test.ts em tests/');
  process.exit(1);
}

// Bundle the TypeScript tests to CJS, then hand them to the Node test runner.
await build({
  entryPoints,
  outdir,
  outExtension: { '.js': '.cjs' },
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  logLevel: 'warning',
});

const bundled = entryPoints.map((entry) =>
  path.join(outdir, `${path.basename(entry, '.ts')}.cjs`),
);

const result = spawnSync(process.execPath, ['--test', ...bundled], {
  stdio: 'inherit',
  cwd: root,
});
process.exit(result.status ?? 1);
