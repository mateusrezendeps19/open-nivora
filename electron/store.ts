import { app } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Local persistence. The Trello desktop app ships `node-persist` and keeps
 * desktop state under the Electron userData directory; we persist the whole
 * board document the same way, as a single JSON file, so the clone works fully
 * offline with no account and no server.
 */

const FILE = 'boards.json';

function storePath(): string {
  return path.join(app.getPath('userData'), FILE);
}

export function getStorePath(): string {
  return storePath();
}

export async function readStore<T>(fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(storePath(), 'utf8');
    return JSON.parse(raw) as T;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') {
      console.error('[store] read failed, falling back to defaults:', error);
    }
    return fallback;
  }
}

export async function writeStore(data: unknown): Promise<void> {
  const target = storePath();
  const tmp = `${target}.tmp`;
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  // Atomic replace so a crash mid-write cannot truncate the user's boards.
  await fs.rename(tmp, target);
}
