import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outfile = path.join(root, 'dist/tests/reducer.test.cjs');

// Bundle the TypeScript tests to CJS, then hand them to the Node test runner.
await build({
  entryPoints: [path.join(root, 'tests/reducer.test.ts')],
  outfile,
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  logLevel: 'warning',
});

const result = spawnSync(process.execPath, ['--test', outfile], { stdio: 'inherit', cwd: root });
process.exit(result.status ?? 1);
