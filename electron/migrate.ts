import { cpSync, existsSync } from 'node:fs';
import path from 'node:path';

/** What the app was called before it was Taskly; Electron named userData after it. */
export const LEGACY_NAME = 'Nivora';

/**
 * Carries the boards over from the folder the app used under its old name.
 *
 * Electron names userData after the product, so the rename alone would have
 * opened an empty Taskly while the user's boards sat in `Nivora`. This copies
 * them across once: only when the new folder has no document yet, so it can
 * never overwrite one, and by copying, so the old folder stays as a backup.
 *
 * The assets go first and boards.json last. A copy cut short leaves no
 * document behind, and the next start simply tries again.
 */
export function migrateUserData(from: string, to: string): boolean {
  if (path.resolve(from) === path.resolve(to)) return false;
  if (existsSync(path.join(to, 'boards.json'))) return false;
  if (!existsSync(path.join(from, 'boards.json'))) return false;

  if (existsSync(path.join(from, 'assets'))) {
    cpSync(path.join(from, 'assets'), path.join(to, 'assets'), { recursive: true });
  }
  cpSync(path.join(from, 'boards.json'), path.join(to, 'boards.json'));
  return true;
}
