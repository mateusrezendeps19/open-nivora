import { bridge, hasShell } from './bridge';
import { AssetChannel } from './channels';
import type { Attachment } from './types';

/**
 * Renderer side of the asset store. Everything here needs the Electron shell:
 * in a plain browser there is no place to copy a file to, so the callers show
 * the feature as unavailable instead of half-working.
 */

const SCHEME_ROOT = 'taskly://assets/';

/** URL for an `<img src>` or a link, from the stored asset name. */
export function assetUrl(asset: string): string {
  return SCHEME_ROOT + encodeURIComponent(asset);
}

export const assetsAvailable = hasShell;

export async function pickAssets(kind: 'image' | 'any'): Promise<Attachment[]> {
  if (!hasShell()) return [];
  try {
    return await bridge().ipc.invoke<Attachment[]>(AssetChannel.PICK, kind);
  } catch (error) {
    bridge().logger.error('falha ao escolher arquivos', error);
    return [];
  }
}

/**
 * Imports files dropped on the page. The paths come from the preload helper,
 * since the renderer cannot read them off the File object itself.
 */
export async function importDroppedFiles(files: FileList | File[]): Promise<Attachment[]> {
  if (!hasShell()) return [];
  const getPath = bridge().getPathForFile;
  if (!getPath) return [];

  const paths = Array.from(files)
    .map((file) => getPath(file))
    .filter((value): value is string => !!value);
  if (paths.length === 0) return [];

  try {
    return await bridge().ipc.invoke<Attachment[]>(AssetChannel.IMPORT, paths);
  } catch (error) {
    bridge().logger.error('falha ao importar arquivos', error);
    return [];
  }
}

export async function removeAsset(asset: string): Promise<void> {
  if (!hasShell()) return;
  try {
    await bridge().ipc.invoke(AssetChannel.REMOVE, asset);
  } catch (error) {
    bridge().logger.error('falha ao remover ativo', error);
  }
}

export async function openAsset(asset: string): Promise<void> {
  if (!hasShell()) return;
  try {
    await bridge().ipc.invoke(AssetChannel.OPEN, asset);
  } catch (error) {
    bridge().logger.error('falha ao abrir ativo', error);
  }
}

export function revealAsset(asset: string): void {
  if (!hasShell()) return;
  bridge().ipc.send(AssetChannel.REVEAL, asset);
}

/** Asks the main process to delete stored files the document dropped. */
export async function sweepAssets(referenced: string[]): Promise<void> {
  if (!hasShell() || referenced.length === 0) return;
  try {
    await bridge().ipc.invoke(AssetChannel.SWEEP, referenced);
  } catch (error) {
    bridge().logger.error('falha na varredura de ativos', error);
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
