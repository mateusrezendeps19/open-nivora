import { app, dialog, net, protocol, shell, type BrowserWindow } from 'electron';
import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Asset store for board backgrounds and card attachments.
 *
 * Files the user picks are copied into `userData/assets` and referenced from the
 * document by their name inside that directory. The renderer reads them back
 * over the `taskly://` scheme rather than `file://`, so the page keeps a tight
 * CSP and never gets a path to the rest of the disk.
 */

export const ASSET_SCHEME = 'taskly';
const ASSET_HOST = 'assets';
const MAX_BYTES = 25 * 1024 * 1024;

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.zip': 'application/zip',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.bmp', '.svg'];

export interface AssetRecord {
  id: string;
  name: string;
  mime: string;
  size: number;
  addedAt: string;
  asset: string;
  isImage: boolean;
}

function storeDir(): string {
  return path.join(app.getPath('userData'), 'assets');
}

function mimeFor(file: string): string {
  return MIME_BY_EXT[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
}

function isImage(file: string): boolean {
  return IMAGE_EXTS.includes(path.extname(file).toLowerCase());
}

/**
 * Keeps the stored name printable and free of separators, so a crafted
 * filename cannot climb out of the store.
 */
function safeName(original: string): string {
  const ext = path.extname(original).toLowerCase().slice(0, 12);
  const base = path
    .basename(original, path.extname(original))
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 48);
  return `${base || 'arquivo'}${ext}`;
}

/** Resolves a stored asset name to an absolute path, or null if it escapes. */
export function resolveAsset(asset: string): string | null {
  if (!asset || asset.includes('\0')) return null;
  const dir = storeDir();
  const resolved = path.resolve(dir, asset);
  const prefix = dir.endsWith(path.sep) ? dir : dir + path.sep;
  return resolved.startsWith(prefix) ? resolved : null;
}

/* ------------------------------------------------------------------ *
 * Import
 * ------------------------------------------------------------------ */

async function importOne(source: string): Promise<AssetRecord | null> {
  let stat;
  try {
    stat = await fs.stat(source);
  } catch {
    return null;
  }
  if (!stat.isFile()) return null;
  if (stat.size > MAX_BYTES) {
    console.warn(`[assets] ${source} ignorado: ${stat.size} bytes excede o limite`);
    return null;
  }

  const dir = storeDir();
  await fs.mkdir(dir, { recursive: true });

  // The content hash keeps the same file from being stored twice, and the name
  // stays readable for anyone looking in the directory.
  const data = await fs.readFile(source);
  const digest = createHash('sha256').update(data).digest('hex').slice(0, 16);
  const asset = `${digest}-${safeName(path.basename(source))}`;
  const target = path.join(dir, asset);

  try {
    await fs.access(target);
  } catch {
    const tmp = `${target}.part`;
    await fs.writeFile(tmp, data);
    await fs.rename(tmp, target);
  }

  return {
    id: randomUUID(),
    name: path.basename(source),
    mime: mimeFor(source),
    size: stat.size,
    addedAt: new Date().toISOString(),
    asset,
    isImage: isImage(source),
  };
}

export async function importPaths(paths: unknown): Promise<AssetRecord[]> {
  if (!Array.isArray(paths)) return [];
  const records: AssetRecord[] = [];
  for (const candidate of paths.slice(0, 20)) {
    if (typeof candidate !== 'string') continue;
    const record = await importOne(candidate);
    if (record) records.push(record);
  }
  return records;
}

export async function pickAndImport(
  window: BrowserWindow | null,
  kind: unknown,
): Promise<AssetRecord[]> {
  const imagesOnly = kind === 'image';
  const filters = imagesOnly
    ? [{ name: 'Imagens', extensions: IMAGE_EXTS.map((ext) => ext.slice(1)) }]
    : [
        { name: 'Todos os arquivos', extensions: ['*'] },
        { name: 'Imagens', extensions: IMAGE_EXTS.map((ext) => ext.slice(1)) },
      ];

  const result = window
    ? await dialog.showOpenDialog(window, {
        title: imagesOnly ? 'Escolher imagem' : 'Escolher arquivos',
        properties: ['openFile', 'multiSelections'],
        filters,
      })
    : await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'], filters });

  if (result.canceled) return [];
  return importPaths(result.filePaths);
}

/* ------------------------------------------------------------------ *
 * Removal
 * ------------------------------------------------------------------ */

export async function removeAsset(asset: unknown): Promise<boolean> {
  if (typeof asset !== 'string') return false;
  const resolved = resolveAsset(asset);
  if (!resolved) return false;
  try {
    await fs.unlink(resolved);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('[assets] falha ao remover', asset, error);
    }
    return false;
  }
}

/**
 * Deletes stored files the document no longer points at.
 *
 * The caller must pass the complete referenced set from a document that really
 * loaded; running this against a freshly seeded document would wipe the store.
 * `main.ts` enforces that, and an empty list is refused here as well.
 */
export async function sweepAssets(referenced: unknown): Promise<number> {
  if (!Array.isArray(referenced)) return 0;
  const keep = new Set(referenced.filter((value): value is string => typeof value === 'string'));

  let entries: string[];
  try {
    entries = await fs.readdir(storeDir());
  } catch {
    return 0;
  }

  // Nothing referenced but files on disk is the signature of a document that
  // failed to load, so leave the store alone.
  if (keep.size === 0 && entries.length > 0) {
    console.warn('[assets] varredura ignorada: nenhum ativo referenciado');
    return 0;
  }

  let removed = 0;
  for (const entry of entries) {
    if (keep.has(entry)) continue;
    if (await removeAsset(entry)) removed += 1;
  }
  if (removed > 0) console.log(`[assets] ${removed} ativo(s) orfao(s) removido(s)`);
  return removed;
}

/* ------------------------------------------------------------------ *
 * Opening in the host OS
 * ------------------------------------------------------------------ */

export async function openAsset(asset: unknown): Promise<boolean> {
  const resolved = typeof asset === 'string' ? resolveAsset(asset) : null;
  if (!resolved) return false;
  const error = await shell.openPath(resolved);
  if (error) console.error('[assets] openPath:', error);
  return !error;
}

export function revealAsset(asset: unknown): void {
  const resolved = typeof asset === 'string' ? resolveAsset(asset) : null;
  if (resolved) shell.showItemInFolder(resolved);
}

/* ------------------------------------------------------------------ *
 * taskly:// protocol
 * ------------------------------------------------------------------ */

/** Must run before `app.whenReady`, which is why it is separate. */
export function registerAssetScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: ASSET_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
    },
  ]);
}

export function handleAssetProtocol(): void {
  protocol.handle(ASSET_SCHEME, async (request) => {
    const url = new URL(request.url);
    if (url.host !== ASSET_HOST) return new Response('not found', { status: 404 });

    const asset = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
    const resolved = resolveAsset(asset);
    if (!resolved) return new Response('forbidden', { status: 403 });

    try {
      return await net.fetch(pathToFileURL(resolved).toString(), { bypassCustomProtocolHandlers: true });
    } catch {
      return new Response('not found', { status: 404 });
    }
  });
}
