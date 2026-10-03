import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction, type StoreNames } from 'idb';
import type { Category, Draft, Folder, Outfit, Piece } from './types';

export const DB_NAME = 'outfit-builder';
export const SCHEMA_VERSION = 1;

export const SEED_CATEGORIES = ['Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Shoes', 'Accessories'];

export interface OutfitDB extends DBSchema {
  categories: { key: string; value: Category };
  pieces: { key: string; value: Piece; indexes: { categoryId: string } };
  folders: { key: string; value: Folder };
  outfits: { key: string; value: Outfit; indexes: { folderId: string } };
  draft: { key: string; value: Draft };
}

type UpgradeTx = IDBPTransaction<OutfitDB, StoreNames<OutfitDB>[], 'versionchange'>;

/**
 * One entry per schema version. Each migration moves the database from
 * version (n - 1) to n. Add new versions here and bump SCHEMA_VERSION.
 */
const migrations: Record<number, (db: IDBPDatabase<OutfitDB>, tx: UpgradeTx) => void> = {
  1: (db, tx) => {
    db.createObjectStore('categories', { keyPath: 'id' });
    const pieces = db.createObjectStore('pieces', { keyPath: 'id' });
    pieces.createIndex('categoryId', 'categoryId');
    db.createObjectStore('folders', { keyPath: 'id' });
    const outfits = db.createObjectStore('outfits', { keyPath: 'id' });
    outfits.createIndex('folderId', 'folderId');
    db.createObjectStore('draft', { keyPath: 'id' });

    const now = Date.now();
    const categories = tx.objectStore('categories');
    SEED_CATEGORIES.forEach((name, order) => {
      categories.put({ id: crypto.randomUUID(), name, order, createdAt: now + order });
    });
  },
};

let dbPromise: Promise<IDBPDatabase<OutfitDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<OutfitDB>> {
  if (!dbPromise) {
    dbPromise = openDB<OutfitDB>(DB_NAME, SCHEMA_VERSION, {
      upgrade(db, oldVersion, newVersion, tx) {
        for (let v = oldVersion + 1; v <= (newVersion ?? SCHEMA_VERSION); v++) {
          migrations[v]?.(db, tx);
        }
      },
      blocking() {
        // Another tab wants a newer schema: step aside so it can upgrade.
        void dbPromise?.then((db) => db.close());
        dbPromise = null;
      },
    });
  }
  return dbPromise;
}

/** Test helper: close the connection and delete the database. */
export async function resetDBForTests(): Promise<void> {
  if (dbPromise) (await dbPromise).close();
  dbPromise = null;
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
