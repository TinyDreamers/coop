import type { CoopProject } from '../types';

/**
 * Server-side persistence for the single coop project.
 *
 * The "database" is Vercel Blob: the whole project is one JSON document. Blob is
 * durable Vercel storage (NOT the ephemeral function filesystem), needs only a
 * single token, and requires no schema migrations — a good fit for a one-project
 * app. CSV/JSON exports are for backups, not the live store.
 *
 * If BLOB_READ_WRITE_TOKEN is not configured, every function throws
 * `StorageNotConfigured`. The API routes catch that and tell the client to fall
 * back to localStorage, so the app keeps working with zero setup.
 */

const PROJECT_PATH = 'coop/project.json';

export class StorageNotConfigured extends Error {
  constructor() {
    super('BLOB_READ_WRITE_TOKEN is not set — using local fallback.');
    this.name = 'StorageNotConfigured';
  }
}

export function isStorageConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/** Load the project document, or null if none has been saved yet. */
export async function loadProject(): Promise<CoopProject | null> {
  if (!isStorageConfigured()) throw new StorageNotConfigured();
  const { list } = await import('@vercel/blob');
  const { blobs } = await list({ prefix: PROJECT_PATH, limit: 1 });
  const found = blobs.find((b) => b.pathname === PROJECT_PATH) ?? blobs[0];
  if (!found) return null;
  // Cache-bust so we never read a stale CDN copy after an overwrite.
  const res = await fetch(`${found.url}?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return (await res.json()) as CoopProject;
}

/** Persist the project document (overwrites the single record). */
export async function saveProject(project: CoopProject): Promise<{ url: string }> {
  if (!isStorageConfigured()) throw new StorageNotConfigured();
  const { put } = await import('@vercel/blob');
  const res = await put(PROJECT_PATH, JSON.stringify(project), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 0,
  });
  return { url: res.url };
}

/** Upload a reference photo, returning its public URL + size. */
export async function uploadPhoto(
  filename: string,
  data: ArrayBuffer | Blob,
  contentType: string,
): Promise<{ url: string; sizeBytes: number }> {
  if (!isStorageConfigured()) throw new StorageNotConfigured();
  const { put } = await import('@vercel/blob');
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const res = await put(`coop/photos/${Date.now()}-${safe}`, data, {
    access: 'public',
    addRandomSuffix: true,
    contentType,
  });
  const sizeBytes = data instanceof Blob ? data.size : data.byteLength;
  return { url: res.url, sizeBytes };
}

/** Delete a photo blob by URL (best-effort). */
export async function deletePhoto(url: string): Promise<void> {
  if (!isStorageConfigured()) throw new StorageNotConfigured();
  const { del } = await import('@vercel/blob');
  await del(url);
}
