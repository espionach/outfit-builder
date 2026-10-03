// Export / import backups (BUILD_SPEC.md §5.4): one .zip with data.json plus the image files.

import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { getDB, SCHEMA_VERSION } from './db';
import type { Category, Draft, Folder, Outfit, Piece } from './types';

const FORMAT = 'outfit-builder-backup';
const FORMAT_VERSION = 1;

type FileRef = { path: string; type: string };

type PieceRecord = Omit<Piece, 'image' | 'thumb' | 'deletedAt'> & { image: FileRef; thumb: FileRef };
type OutfitRecord = Omit<Outfit, 'snapshot' | 'deletedAt'> & { snapshot: FileRef };

type BackupJson = {
  format: typeof FORMAT;
  formatVersion: number;
  schemaVersion: number;
  exportedAt: number;
  categories: Category[];
  pieces: PieceRecord[];
  folders: Folder[];
  outfits: OutfitRecord[];
  draft: Draft | null;
};

export type BackupSummary = {
  exportedAt: number;
  pieces: number;
  outfits: number;
  categories: number;
  folders: number;
};

export type ParsedBackup = {
  summary: BackupSummary;
  data: { categories: Category[]; pieces: Piece[]; folders: Folder[]; outfits: Outfit[]; draft: Draft | null };
};

export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

const EXT: Record<string, string> = { 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg' };
const ext = (type: string) => EXT[type] ?? 'bin';

async function bytes(blob: Blob) {
  return new Uint8Array(await blob.arrayBuffer());
}

/** Build a backup of everything except records waiting on an undo. */
export async function exportBackup(): Promise<Blob> {
  const db = await getDB();
  const tx = db.transaction(['categories', 'pieces', 'folders', 'outfits', 'draft']);
  const [categories, pieces, folders, outfits, draft] = await Promise.all([
    tx.objectStore('categories').getAll(),
    tx.objectStore('pieces').getAll(),
    tx.objectStore('folders').getAll(),
    tx.objectStore('outfits').getAll(),
    tx.objectStore('draft').get('current'),
  ]);

  // Images are already compressed, so store them as-is (level 0); deflate only the JSON.
  const files: Zippable = {};
  const addFile = async (path: string, blob: Blob): Promise<FileRef> => {
    files[path] = [await bytes(blob), { level: 0 }];
    return { path, type: blob.type };
  };

  const pieceRecords: PieceRecord[] = [];
  for (const p of pieces.filter((p) => !p.deletedAt)) {
    const { image, thumb, deletedAt: _deleted, ...rest } = p;
    pieceRecords.push({
      ...rest,
      image: await addFile(`images/pieces/${p.id}.${ext(image.type)}`, image),
      thumb: await addFile(`images/thumbs/${p.id}.${ext(thumb.type)}`, thumb),
    });
  }

  const outfitRecords: OutfitRecord[] = [];
  for (const o of outfits.filter((o) => !o.deletedAt)) {
    const { snapshot, deletedAt: _deleted, ...rest } = o;
    outfitRecords.push({
      ...rest,
      snapshot: await addFile(`images/outfits/${o.id}.${ext(snapshot.type)}`, snapshot),
    });
  }

  const json: BackupJson = {
    format: FORMAT,
    formatVersion: FORMAT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: Date.now(),
    categories,
    pieces: pieceRecords,
    folders,
    outfits: outfitRecords,
    draft: draft ?? null,
  };
  files['data.json'] = strToU8(JSON.stringify(json, null, 2));

  const zipped = zipSync(files);
  return new Blob([zipped.slice().buffer], { type: 'application/zip' });
}

/** Read and check a backup file without touching the database. */
export async function readBackup(file: Blob): Promise<ParsedBackup> {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(await bytes(file));
  } catch {
    throw new BackupError("That file isn't a backup from this app.");
  }
  const raw = entries['data.json'];
  if (!raw) throw new BackupError("That file isn't a backup from this app.");

  let json: BackupJson;
  try {
    json = JSON.parse(strFromU8(raw));
  } catch {
    throw new BackupError('The backup is damaged and cannot be read.');
  }
  if (json.format !== FORMAT || !Array.isArray(json.pieces) || !Array.isArray(json.categories)) {
    throw new BackupError("That file isn't a backup from this app.");
  }
  if (json.schemaVersion > SCHEMA_VERSION || json.formatVersion > FORMAT_VERSION) {
    throw new BackupError('This backup was made by a newer version of the app.');
  }

  const blobOf = (ref: FileRef) => {
    const data = entries[ref.path];
    if (!data) throw new BackupError('The backup is missing some photos and cannot be restored.');
    return new Blob([data.slice().buffer], { type: ref.type });
  };

  const pieces: Piece[] = json.pieces.map(({ image, thumb, ...rest }) => ({
    ...rest,
    image: blobOf(image),
    thumb: blobOf(thumb),
  }));
  const outfits: Outfit[] = (json.outfits ?? []).map(({ snapshot, ...rest }) => ({
    ...rest,
    snapshot: blobOf(snapshot),
  }));
  const folders = json.folders ?? [];

  return {
    summary: {
      exportedAt: json.exportedAt,
      pieces: pieces.length,
      outfits: outfits.length,
      categories: json.categories.length,
      folders: folders.length,
    },
    data: { categories: json.categories, pieces, folders, outfits, draft: json.draft ?? null },
  };
}

/** Replace everything in the database with a parsed backup, in one transaction. */
export async function restoreBackup(backup: ParsedBackup): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['categories', 'pieces', 'folders', 'outfits', 'draft'], 'readwrite');
  const { categories, pieces, folders, outfits, draft } = backup.data;
  await Promise.all([
    tx.objectStore('categories').clear(),
    tx.objectStore('pieces').clear(),
    tx.objectStore('folders').clear(),
    tx.objectStore('outfits').clear(),
    tx.objectStore('draft').clear(),
  ]);
  for (const c of categories) await tx.objectStore('categories').put(c);
  for (const p of pieces) await tx.objectStore('pieces').put(p);
  for (const f of folders) await tx.objectStore('folders').put(f);
  for (const o of outfits) await tx.objectStore('outfits').put(o);
  if (draft) await tx.objectStore('draft').put({ ...draft, id: 'current' });
  await tx.done;
}
