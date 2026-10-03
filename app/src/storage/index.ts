// The only module that talks to IndexedDB. The UI calls these functions and
// never opens a transaction itself (BUILD_SPEC.md §2, §5).

import { restoreBackup, type ParsedBackup } from './backup';
import { getDB } from './db';
import type { AllData, Category, Draft, Folder, ID, Outfit, PlacedPiece, Piece } from './types';

export * from './types';
export { SCHEMA_VERSION } from './db';
export { BackupError, exportBackup, readBackup, type BackupSummary, type ParsedBackup } from './backup';

export const FOLDER_COLORS = ['#ff6b9d', '#5b9bd5', '#c9a0dc', '#f5b83d', '#7fd1ae'];

// ---------- Errors and events ----------

export class StorageFullError extends Error {
  constructor() {
    super('Storage is full: delete some pieces or export a backup');
    this.name = 'StorageFullError';
  }
}

export type StorageEvent = { type: 'quota' } | { type: 'persist-denied' };
type Listener = (event: StorageEvent) => void;
const listeners = new Set<Listener>();

/** Subscribe to storage problems the UI should surface. Returns an unsubscribe function. */
export function onStorageEvent(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(event: StorageEvent) {
  listeners.forEach((l) => l(event));
}

function isQuotaError(err: unknown): boolean {
  if (!(err instanceof Error) && !(err instanceof DOMException)) return false;
  const e = err as Error & { inner?: unknown; cause?: unknown };
  return (
    e.name === 'QuotaExceededError' ||
    // Aborted transactions sometimes carry the quota error as their cause.
    (e.name === 'AbortError' && isQuotaError(e.cause ?? e.inner))
  );
}

let persistRequested = false;

/** Ask the browser not to evict our data. Runs once, on the first write. */
async function requestPersistence() {
  if (persistRequested) return;
  persistRequested = true;
  try {
    if (!navigator.storage?.persist) return;
    if (await navigator.storage.persisted()) return;
    const granted = await navigator.storage.persist();
    if (!granted) emit({ type: 'persist-denied' });
  } catch {
    // Not supported: nothing to do.
  }
}

/** Every write goes through here so quota errors are reported consistently. */
async function write<T>(fn: () => Promise<T>): Promise<T> {
  void requestPersistence();
  try {
    return await fn();
  } catch (err) {
    if (isQuotaError(err)) {
      emit({ type: 'quota' });
      throw new StorageFullError();
    }
    throw err;
  }
}

const byOrder = (a: { order: number }, b: { order: number }) => a.order - b.order;
const byCreated = (a: { createdAt: number }, b: { createdAt: number }) => a.createdAt - b.createdAt;

// ---------- Loading ----------

/** Read everything the app needs before first render. Soft-deleted records are left out. */
export async function loadAll(): Promise<AllData> {
  const db = await getDB();
  const tx = db.transaction(['categories', 'pieces', 'folders', 'outfits', 'draft']);
  const [categories, pieces, folders, outfits, draft] = await Promise.all([
    tx.objectStore('categories').getAll(),
    tx.objectStore('pieces').getAll(),
    tx.objectStore('folders').getAll(),
    tx.objectStore('outfits').getAll(),
    tx.objectStore('draft').get('current'),
  ]);
  return {
    categories: categories.sort(byOrder),
    pieces: pieces.filter((p) => !p.deletedAt).sort(byCreated),
    folders: folders.sort(byOrder),
    outfits: outfits.filter((o) => !o.deletedAt).sort((a, b) => b.createdAt - a.createdAt),
    draft: draft ?? null,
  };
}

/** Hard-delete every soft-deleted piece and outfit. Called on app start. */
export async function purgeAllDeleted(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['pieces', 'outfits'], 'readwrite');
  for (const name of ['pieces', 'outfits'] as const) {
    let cursor = await tx.objectStore(name).openCursor();
    while (cursor) {
      if (cursor.value.deletedAt) await cursor.delete();
      cursor = await cursor.continue();
    }
  }
  await tx.done;
}

// ---------- Categories ----------

export async function addCategory(name: string): Promise<Category> {
  return write(async () => {
    const db = await getDB();
    const tx = db.transaction('categories', 'readwrite');
    const all = await tx.store.getAll();
    const category: Category = {
      id: crypto.randomUUID(),
      name: name.trim(),
      order: all.reduce((max, c) => Math.max(max, c.order), -1) + 1,
      createdAt: Date.now(),
    };
    await tx.store.add(category);
    await tx.done;
    return category;
  });
}

export async function renameCategory(id: ID, name: string): Promise<void> {
  return write(async () => {
    const db = await getDB();
    const tx = db.transaction('categories', 'readwrite');
    const category = await tx.store.get(id);
    if (category) await tx.store.put({ ...category, name: name.trim() });
    await tx.done;
  });
}

/**
 * Delete a category. Any pieces in it (including soft-deleted ones waiting on
 * an undo) move to `moveTo` in the same transaction.
 */
export async function deleteCategory(id: ID, moveTo: ID | null): Promise<void> {
  return write(async () => {
    const db = await getDB();
    const tx = db.transaction(['categories', 'pieces'], 'readwrite');
    const pieces = tx.objectStore('pieces');
    const inCategory = await pieces.index('categoryId').getAll(id);
    if (inCategory.length > 0) {
      if (!moveTo) throw new Error('This category has pieces; choose where to move them.');
      for (const piece of inCategory) await pieces.put({ ...piece, categoryId: moveTo });
    }
    await tx.objectStore('categories').delete(id);
    await tx.done;
  });
}

// ---------- Pieces ----------

export type NewPiece = Pick<Piece, 'name' | 'categoryId' | 'image' | 'thumb' | 'width' | 'height'>;

export async function addPiece(input: NewPiece): Promise<Piece> {
  return write(async () => {
    const piece: Piece = {
      id: crypto.randomUUID(),
      ...input,
      name: input.name?.trim() || undefined,
      createdAt: Date.now(),
    };
    const db = await getDB();
    await db.add('pieces', piece);
    return piece;
  });
}

export async function updatePiece(id: ID, patch: Partial<Pick<Piece, 'name' | 'categoryId'>>): Promise<void> {
  return write(async () => {
    const db = await getDB();
    const tx = db.transaction('pieces', 'readwrite');
    const piece = await tx.store.get(id);
    if (piece) await tx.store.put({ ...piece, ...patch });
    await tx.done;
  });
}

export function softDeletePieces(ids: ID[]): Promise<void> {
  return setDeleted('pieces', ids, Date.now());
}

export function restorePieces(ids: ID[]): Promise<void> {
  return setDeleted('pieces', ids, undefined);
}

export function purgePieces(ids: ID[]): Promise<void> {
  return purge('pieces', ids);
}

// ---------- Folders ----------

export async function addFolder(name: string): Promise<Folder> {
  return write(async () => {
    const db = await getDB();
    const tx = db.transaction('folders', 'readwrite');
    const all = (await tx.store.getAll()).sort(byOrder);
    const last = all[all.length - 1];
    // Colors rotate: each new folder takes the color after the newest folder's.
    const nextColor = last ? (FOLDER_COLORS.indexOf(last.color) + 1) % FOLDER_COLORS.length : 0;
    const folder: Folder = {
      id: crypto.randomUUID(),
      name: name.trim(),
      color: FOLDER_COLORS[nextColor],
      order: last ? last.order + 1 : 0,
      createdAt: Date.now(),
    };
    await tx.store.add(folder);
    await tx.done;
    return folder;
  });
}

export async function renameFolder(id: ID, name: string): Promise<void> {
  return write(async () => {
    const db = await getDB();
    const tx = db.transaction('folders', 'readwrite');
    const folder = await tx.store.get(id);
    if (folder) await tx.store.put({ ...folder, name: name.trim() });
    await tx.done;
  });
}

/** Delete a folder. Its outfits move back to "All" (folderId = null). */
export async function deleteFolder(id: ID): Promise<void> {
  return write(async () => {
    const db = await getDB();
    const tx = db.transaction(['folders', 'outfits'], 'readwrite');
    const outfits = tx.objectStore('outfits');
    for (const outfit of await outfits.index('folderId').getAll(id)) {
      await outfits.put({ ...outfit, folderId: null });
    }
    await tx.objectStore('folders').delete(id);
    await tx.done;
  });
}

// ---------- Outfits ----------

export type NewOutfit = Pick<Outfit, 'name' | 'folderId' | 'layout' | 'snapshot'>;

export async function addOutfit(input: NewOutfit): Promise<Outfit> {
  return write(async () => {
    const now = Date.now();
    const outfit: Outfit = {
      id: crypto.randomUUID(),
      ...input,
      name: input.name.trim(),
      createdAt: now,
      updatedAt: now,
    };
    const db = await getDB();
    await db.add('outfits', outfit);
    return outfit;
  });
}

export async function updateOutfit(
  id: ID,
  patch: Partial<Pick<Outfit, 'name' | 'folderId'>>,
): Promise<Outfit | undefined> {
  return write(async () => {
    const db = await getDB();
    const tx = db.transaction('outfits', 'readwrite');
    const outfit = await tx.store.get(id);
    let updated: Outfit | undefined;
    if (outfit) {
      updated = { ...outfit, ...patch, updatedAt: Date.now() };
      await tx.store.put(updated);
    }
    await tx.done;
    return updated;
  });
}

export function softDeleteOutfits(ids: ID[]): Promise<void> {
  return setDeleted('outfits', ids, Date.now());
}

export function restoreOutfits(ids: ID[]): Promise<void> {
  return setDeleted('outfits', ids, undefined);
}

export function purgeOutfits(ids: ID[]): Promise<void> {
  return purge('outfits', ids);
}

// ---------- Draft ----------

export async function saveDraft(layout: PlacedPiece[]): Promise<void> {
  return write(async () => {
    const db = await getDB();
    const draft: Draft = { id: 'current', layout, updatedAt: Date.now() };
    await db.put('draft', draft);
  });
}

// ---------- Shared soft-delete helpers ----------

async function setDeleted(store: 'pieces' | 'outfits', ids: ID[], deletedAt: number | undefined) {
  return write(async () => {
    const db = await getDB();
    const tx = db.transaction(store, 'readwrite');
    for (const id of ids) {
      const record = await tx.store.get(id);
      if (!record) continue;
      const next = { ...record, deletedAt };
      if (deletedAt === undefined) delete next.deletedAt;
      await tx.store.put(next);
    }
    await tx.done;
  });
}

/** Hard-delete records, but only those still marked deleted (an undo may have raced the purge). */
async function purge(store: 'pieces' | 'outfits', ids: ID[]) {
  const db = await getDB();
  const tx = db.transaction(store, 'readwrite');
  for (const id of ids) {
    const record = await tx.store.get(id);
    if (record?.deletedAt) await tx.store.delete(id);
  }
  await tx.done;
}

// ---------- Backup ----------

/** Replace everything with a backup read by `readBackup`. */
export function importBackup(backup: ParsedBackup): Promise<void> {
  return write(() => restoreBackup(backup));
}
