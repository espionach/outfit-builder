import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as storage from '../storage';
import type { Category, Folder, ID, NewOutfit, NewPiece, Outfit, Piece, PlacedPiece } from '../storage';

export type PieceView = Piece & { thumbUrl: string; imageUrl: string };
export type OutfitView = Outfit & { snapshotUrl: string };

type State = {
  categories: Category[];
  pieces: PieceView[];
  folders: Folder[];
  outfits: OutfitView[];
};

export type AppData = State & {
  /** The draft canvas as it was when the app loaded. */
  initialDraft: PlacedPiece[];

  addCategory(name: string): Promise<Category>;
  renameCategory(id: ID, name: string): Promise<void>;
  deleteCategory(id: ID, moveTo: ID | null): Promise<void>;

  addPiece(input: NewPiece): Promise<PieceView>;
  updatePiece(id: ID, patch: Partial<Pick<Piece, 'name' | 'categoryId'>>): Promise<void>;
  deletePieces(ids: ID[]): Promise<void>;
  restorePieces(ids: ID[]): Promise<void>;
  purgePieces(ids: ID[]): Promise<void>;

  addFolder(name: string): Promise<Folder>;
  renameFolder(id: ID, name: string): Promise<void>;
  deleteFolder(id: ID): Promise<void>;

  addOutfit(input: NewOutfit): Promise<OutfitView>;
  updateOutfit(id: ID, patch: Partial<Pick<Outfit, 'name' | 'folderId'>>): Promise<void>;
  deleteOutfits(ids: ID[]): Promise<void>;
  restoreOutfits(ids: ID[]): Promise<void>;
  purgeOutfits(ids: ID[]): Promise<void>;

  saveDraft(layout: PlacedPiece[]): Promise<void>;
  /** Replace everything (after a backup import). */
  reload(): Promise<void>;
};

const Ctx = createContext<AppData | null>(null);

export function useAppData(): AppData {
  const value = useContext(Ctx);
  if (!value) throw new Error('useAppData must be used inside <AppDataProvider>');
  return value;
}

const toPieceView = (p: Piece): PieceView => ({
  ...p,
  thumbUrl: URL.createObjectURL(p.thumb),
  imageUrl: URL.createObjectURL(p.image),
});
const toOutfitView = (o: Outfit): OutfitView => ({ ...o, snapshotUrl: URL.createObjectURL(o.snapshot) });
const revokePiece = (p: PieceView) => {
  URL.revokeObjectURL(p.thumbUrl);
  URL.revokeObjectURL(p.imageUrl);
};
const byCreated = (a: { createdAt: number }, b: { createdAt: number }) => a.createdAt - b.createdAt;
const newestFirst = (a: { createdAt: number }, b: { createdAt: number }) => b.createdAt - a.createdAt;

type ProviderProps = { children: ReactNode; fallback: ReactNode; failed: ReactNode };

export function AppDataProvider({ children, fallback, failed }: ProviderProps) {
  const [state, setState] = useState<State | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [initialDraft, setInitialDraft] = useState<PlacedPiece[]>([]);
  // Soft-deleted records wait here (with their object URLs) until undo or purge.
  const trashedPieces = useRef(new Map<ID, PieceView>());
  const trashedOutfits = useRef(new Map<ID, OutfitView>());
  const live = useRef<State | null>(null);
  live.current = state;

  const load = useCallback(async () => {
    await storage.purgeAllDeleted();
    const data = await storage.loadAll();
    // Revoke URLs from any previous load before replacing them.
    live.current?.pieces.forEach(revokePiece);
    live.current?.outfits.forEach((o) => URL.revokeObjectURL(o.snapshotUrl));
    setInitialDraft(data.draft?.layout ?? []);
    setState({
      categories: data.categories,
      pieces: data.pieces.map(toPieceView),
      folders: data.folders,
      outfits: data.outfits.map(toOutfitView),
    });
  }, []);

  useEffect(() => {
    load().catch((err) => {
      console.error(err);
      setLoadError(true);
    });
  }, [load]);

  const update = (fn: (s: State) => State) => setState((s) => (s ? fn(s) : s));

  const actions = useMemo(
    () => ({
      async addCategory(name: string) {
        const category = await storage.addCategory(name);
        update((s) => ({ ...s, categories: [...s.categories, category] }));
        return category;
      },
      async renameCategory(id: ID, name: string) {
        await storage.renameCategory(id, name);
        update((s) => ({ ...s, categories: s.categories.map((c) => (c.id === id ? { ...c, name: name.trim() } : c)) }));
      },
      async deleteCategory(id: ID, moveTo: ID | null) {
        await storage.deleteCategory(id, moveTo);
        const move = <T extends { categoryId: ID }>(p: T): T =>
          p.categoryId === id && moveTo ? { ...p, categoryId: moveTo } : p;
        trashedPieces.current.forEach((p, key) => trashedPieces.current.set(key, move(p)));
        update((s) => ({ ...s, categories: s.categories.filter((c) => c.id !== id), pieces: s.pieces.map(move) }));
      },

      async addPiece(input: NewPiece) {
        const view = toPieceView(await storage.addPiece(input));
        update((s) => ({ ...s, pieces: [...s.pieces, view] }));
        return view;
      },
      async updatePiece(id: ID, patch: Partial<Pick<Piece, 'name' | 'categoryId'>>) {
        await storage.updatePiece(id, patch);
        update((s) => ({ ...s, pieces: s.pieces.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
      },
      async deletePieces(ids: ID[]) {
        await storage.softDeletePieces(ids);
        const set = new Set(ids);
        live.current?.pieces.filter((p) => set.has(p.id)).forEach((p) => trashedPieces.current.set(p.id, p));
        update((s) => ({ ...s, pieces: s.pieces.filter((p) => !set.has(p.id)) }));
      },
      async restorePieces(ids: ID[]) {
        await storage.restorePieces(ids);
        const back = ids.map((id) => trashedPieces.current.get(id)).filter((p): p is PieceView => !!p);
        ids.forEach((id) => trashedPieces.current.delete(id));
        update((s) => ({ ...s, pieces: [...s.pieces, ...back].sort(byCreated) }));
      },
      async purgePieces(ids: ID[]) {
        await storage.purgePieces(ids);
        for (const id of ids) {
          const p = trashedPieces.current.get(id);
          if (p) revokePiece(p);
          trashedPieces.current.delete(id);
        }
      },

      async addFolder(name: string) {
        const folder = await storage.addFolder(name);
        update((s) => ({ ...s, folders: [...s.folders, folder] }));
        return folder;
      },
      async renameFolder(id: ID, name: string) {
        await storage.renameFolder(id, name);
        update((s) => ({ ...s, folders: s.folders.map((f) => (f.id === id ? { ...f, name: name.trim() } : f)) }));
      },
      async deleteFolder(id: ID) {
        await storage.deleteFolder(id);
        trashedOutfits.current.forEach(
          (o, key) => o.folderId === id && trashedOutfits.current.set(key, { ...o, folderId: null }),
        );
        update((s) => ({
          ...s,
          folders: s.folders.filter((f) => f.id !== id),
          outfits: s.outfits.map((o) => (o.folderId === id ? { ...o, folderId: null } : o)),
        }));
      },

      async addOutfit(input: NewOutfit) {
        const view = toOutfitView(await storage.addOutfit(input));
        update((s) => ({ ...s, outfits: [view, ...s.outfits] }));
        return view;
      },
      async updateOutfit(id: ID, patch: Partial<Pick<Outfit, 'name' | 'folderId'>>) {
        const updated = await storage.updateOutfit(id, patch);
        if (!updated) return;
        update((s) => ({
          ...s,
          outfits: s.outfits.map((o) => (o.id === id ? { ...o, ...patch, updatedAt: updated.updatedAt } : o)),
        }));
      },
      async deleteOutfits(ids: ID[]) {
        await storage.softDeleteOutfits(ids);
        const set = new Set(ids);
        live.current?.outfits.filter((o) => set.has(o.id)).forEach((o) => trashedOutfits.current.set(o.id, o));
        update((s) => ({ ...s, outfits: s.outfits.filter((o) => !set.has(o.id)) }));
      },
      async restoreOutfits(ids: ID[]) {
        await storage.restoreOutfits(ids);
        const back = ids.map((id) => trashedOutfits.current.get(id)).filter((o): o is OutfitView => !!o);
        ids.forEach((id) => trashedOutfits.current.delete(id));
        update((s) => ({ ...s, outfits: [...s.outfits, ...back].sort(newestFirst) }));
      },
      async purgeOutfits(ids: ID[]) {
        await storage.purgeOutfits(ids);
        for (const id of ids) {
          const o = trashedOutfits.current.get(id);
          if (o) URL.revokeObjectURL(o.snapshotUrl);
          trashedOutfits.current.delete(id);
        }
      },

      saveDraft: storage.saveDraft,
      reload: load,
    }),
    [load],
  );

  const value = useMemo<AppData | null>(
    () => (state ? { ...state, initialDraft, ...actions } : null),
    [state, initialDraft, actions],
  );

  if (loadError) return <>{failed}</>;
  if (!value) return <>{fallback}</>;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
