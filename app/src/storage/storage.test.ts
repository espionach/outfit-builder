import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDBForTests, SEED_CATEGORIES } from './db';
import * as storage from './index';

const blob = (text = 'img') => new Blob([text], { type: 'image/webp' });

const newPiece = (categoryId: string, name?: string): storage.NewPiece => ({
  name,
  categoryId,
  image: blob(),
  thumb: blob('thumb'),
  width: 800,
  height: 1200,
});

const layout: storage.PlacedPiece[] = [{ pieceId: 'p1', x: 0.1, y: 0.2, w: 0.3, h: 0.4, z: 1 }];

beforeEach(async () => {
  await resetDBForTests();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('first run', () => {
  it('seeds the six categories in order', async () => {
    const data = await storage.loadAll();
    expect(data.categories.map((c) => c.name)).toEqual(SEED_CATEGORIES);
    expect(data.pieces).toEqual([]);
    expect(data.folders).toEqual([]);
    expect(data.outfits).toEqual([]);
    expect(data.draft).toBeNull();
  });
});

describe('categories', () => {
  it('adds, renames and keeps order', async () => {
    const added = await storage.addCategory('  Swimwear ');
    await storage.renameCategory(added.id, 'Swim');
    const { categories } = await storage.loadAll();
    expect(categories.at(-1)).toMatchObject({ id: added.id, name: 'Swim', order: 6 });
  });

  it('moves pieces to another category on delete', async () => {
    const [tops, bottoms] = (await storage.loadAll()).categories;
    const piece = await storage.addPiece(newPiece(tops.id));
    await storage.deleteCategory(tops.id, bottoms.id);
    const data = await storage.loadAll();
    expect(data.categories.find((c) => c.id === tops.id)).toBeUndefined();
    expect(data.pieces[0]).toMatchObject({ id: piece.id, categoryId: bottoms.id });
  });

  it('refuses to delete a category with pieces and no destination', async () => {
    const [tops] = (await storage.loadAll()).categories;
    await storage.addPiece(newPiece(tops.id));
    await expect(storage.deleteCategory(tops.id, null)).rejects.toThrow();
    expect((await storage.loadAll()).categories).toHaveLength(6);
  });
});

describe('pieces', () => {
  it('stores the image blobs and metadata', async () => {
    const [tops] = (await storage.loadAll()).categories;
    const piece = await storage.addPiece(newPiece(tops.id, ' Peach cardigan '));
    const [loaded] = (await storage.loadAll()).pieces;
    expect(loaded).toMatchObject({ id: piece.id, name: 'Peach cardigan', width: 800, height: 1200 });
    expect(await loaded.image.text()).toBe('img');
    expect(await loaded.thumb.text()).toBe('thumb');
  });

  it('drops a blank name', async () => {
    const [tops] = (await storage.loadAll()).categories;
    const piece = await storage.addPiece(newPiece(tops.id, '   '));
    expect(piece.name).toBeUndefined();
  });

  it('soft-deletes, restores and purges', async () => {
    const [tops] = (await storage.loadAll()).categories;
    const a = await storage.addPiece(newPiece(tops.id, 'a'));
    const b = await storage.addPiece(newPiece(tops.id, 'b'));

    await storage.softDeletePieces([a.id, b.id]);
    expect((await storage.loadAll()).pieces).toEqual([]);

    await storage.restorePieces([a.id]);
    expect((await storage.loadAll()).pieces.map((p) => p.id)).toEqual([a.id]);

    // Purge only removes records still marked deleted.
    await storage.purgePieces([a.id, b.id]);
    await storage.softDeletePieces([a.id]);
    await storage.restorePieces([a.id]);
    expect((await storage.loadAll()).pieces.map((p) => p.id)).toEqual([a.id]);
  });

  it('purges soft-deleted records on the next start', async () => {
    const [tops] = (await storage.loadAll()).categories;
    const piece = await storage.addPiece(newPiece(tops.id));
    await storage.softDeletePieces([piece.id]);
    await storage.purgeAllDeleted();
    await storage.restorePieces([piece.id]); // nothing left to restore
    expect((await storage.loadAll()).pieces).toEqual([]);
  });

  it('updates name and category', async () => {
    const [tops, bottoms] = (await storage.loadAll()).categories;
    const piece = await storage.addPiece(newPiece(tops.id));
    await storage.updatePiece(piece.id, { name: 'Jeans', categoryId: bottoms.id });
    expect((await storage.loadAll()).pieces[0]).toMatchObject({ name: 'Jeans', categoryId: bottoms.id });
  });
});

describe('folders', () => {
  it('assigns accent colors in rotation', async () => {
    const colors = [];
    for (let i = 0; i < 6; i++) colors.push((await storage.addFolder(`F${i}`)).color);
    expect(colors).toEqual([...storage.FOLDER_COLORS, storage.FOLDER_COLORS[0]]);
  });

  it('renames a folder', async () => {
    const folder = await storage.addFolder('Weekend');
    await storage.renameFolder(folder.id, 'Weekends');
    expect((await storage.loadAll()).folders[0].name).toBe('Weekends');
  });

  it('moves outfits back to All when a folder is deleted', async () => {
    const folder = await storage.addFolder('Weekend');
    const outfit = await storage.addOutfit({ name: 'Brunch', folderId: folder.id, layout, snapshot: blob() });
    await storage.deleteFolder(folder.id);
    const data = await storage.loadAll();
    expect(data.folders).toEqual([]);
    expect(data.outfits[0]).toMatchObject({ id: outfit.id, folderId: null });
  });
});

describe('outfits', () => {
  it('saves layout and snapshot, newest first', async () => {
    const first = await storage.addOutfit({ name: 'One', folderId: null, layout, snapshot: blob('s1') });
    vi.spyOn(Date, 'now').mockReturnValue(first.createdAt + 1000);
    const second = await storage.addOutfit({ name: 'Two', folderId: null, layout: [], snapshot: blob('s2') });
    const { outfits } = await storage.loadAll();
    expect(outfits.map((o) => o.id)).toEqual([second.id, first.id]);
    expect(outfits[1].layout).toEqual(layout);
    expect(await outfits[1].snapshot.text()).toBe('s1');
  });

  it('renames and moves between folders', async () => {
    const folder = await storage.addFolder('Work');
    const outfit = await storage.addOutfit({ name: 'Old', folderId: null, layout, snapshot: blob() });
    const updated = await storage.updateOutfit(outfit.id, { name: 'New', folderId: folder.id });
    expect(updated).toMatchObject({ name: 'New', folderId: folder.id });
    expect((await storage.loadAll()).outfits[0]).toMatchObject({ name: 'New', folderId: folder.id });
  });

  it('soft-deletes and restores', async () => {
    const outfit = await storage.addOutfit({ name: 'X', folderId: null, layout, snapshot: blob() });
    await storage.softDeleteOutfits([outfit.id]);
    expect((await storage.loadAll()).outfits).toEqual([]);
    await storage.restoreOutfits([outfit.id]);
    expect((await storage.loadAll()).outfits).toHaveLength(1);
  });
});

describe('draft', () => {
  it('saves and overwrites the current draft', async () => {
    await storage.saveDraft(layout);
    await storage.saveDraft([...layout, { ...layout[0], pieceId: 'p2', z: 2 }]);
    const { draft } = await storage.loadAll();
    expect(draft?.id).toBe('current');
    expect(draft?.layout.map((p) => p.pieceId)).toEqual(['p1', 'p2']);
  });
});

describe('quota errors', () => {
  it('reports QuotaExceededError as StorageFullError and emits an event', async () => {
    const events: storage.StorageEvent[] = [];
    const off = storage.onStorageEvent((e) => events.push(e));
    vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    await expect(storage.addFolder('Big')).rejects.toBeInstanceOf(storage.StorageFullError);
    expect(events).toContainEqual({ type: 'quota' });
    off();
  });
});

describe('persistence across connections', () => {
  it('keeps data after the connection is reopened', async () => {
    await storage.addFolder('Survives');
    const { getDB } = await import('./db');
    (await getDB()).close();
    // Simulate a reload by forcing a fresh connection.
    vi.resetModules();
    const fresh = await import('./index');
    expect((await fresh.loadAll()).folders.map((f) => f.name)).toEqual(['Survives']);
  });
});

describe('backup', () => {
  it('round-trips everything through a zip', async () => {
    const [tops] = (await storage.loadAll()).categories;
    const extra = await storage.addCategory('Swim');
    const piece = await storage.addPiece({ ...newPiece(tops.id, 'Tee'), image: blob('full-image') });
    const gone = await storage.addPiece(newPiece(extra.id, 'Deleted'));
    await storage.softDeletePieces([gone.id]);
    const folder = await storage.addFolder('Weekend');
    const outfit = await storage.addOutfit({ name: 'Brunch', folderId: folder.id, layout, snapshot: blob('snap') });
    await storage.saveDraft(layout);

    const zip = await storage.exportBackup();
    expect(zip.type).toBe('application/zip');

    // Wipe the database, as if site data had been cleared.
    await resetDBForTests();
    expect((await storage.loadAll()).pieces).toEqual([]);

    const parsed = await storage.readBackup(zip);
    expect(parsed.summary).toMatchObject({ pieces: 1, outfits: 1, categories: 7, folders: 1 });
    await storage.importBackup(parsed);

    const data = await storage.loadAll();
    expect(data.categories.map((c) => c.name)).toContain('Swim');
    expect(data.pieces).toHaveLength(1);
    expect(data.pieces[0]).toMatchObject({ id: piece.id, name: 'Tee', categoryId: tops.id });
    expect(await data.pieces[0].image.text()).toBe('full-image');
    expect(data.pieces[0].image.type).toBe('image/webp');
    expect(data.folders[0]).toMatchObject({ id: folder.id, name: 'Weekend' });
    expect(data.outfits[0]).toMatchObject({ id: outfit.id, folderId: folder.id, layout });
    expect(await data.outfits[0].snapshot.text()).toBe('snap');
    expect(data.draft?.layout).toEqual(layout);
  });

  it('replaces existing data on import', async () => {
    await storage.addFolder('Old');
    const zip = await storage.exportBackup();
    await storage.addFolder('Newer');
    await storage.importBackup(await storage.readBackup(zip));
    expect((await storage.loadAll()).folders.map((f) => f.name)).toEqual(['Old']);
  });

  it('rejects files that are not backups', async () => {
    await expect(storage.readBackup(new Blob(['hello']))).rejects.toBeInstanceOf(storage.BackupError);
  });
});
