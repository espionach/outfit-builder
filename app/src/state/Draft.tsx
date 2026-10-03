import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { PlacedPiece } from '../storage';
import { useAppData } from './AppData';

/** A placed piece plus an in-memory id, so the same piece can be on the canvas twice. */
export type CanvasItem = PlacedPiece & { uid: string };

type DraftContext = {
  items: CanvasItem[];
  setItems(update: (items: CanvasItem[]) => CanvasItem[]): void;
  /** Replace the canvas (Load into builder). The new layout counts as saved. */
  replace(layout: PlacedPiece[]): void;
  /** Remember the current canvas as saved, e.g. right after "Save outfit". */
  markSaved(): void;
  /** True when the canvas has pieces that differ from the last saved or loaded outfit. */
  isDirty: boolean;
  /** Forget an unwritten draft change (before a backup import replaces the draft). */
  discardPending(): void;
};

const Ctx = createContext<DraftContext | null>(null);

export function useDraft() {
  const value = useContext(Ctx);
  if (!value) throw new Error('useDraft must be used inside <DraftProvider>');
  return value;
}

const DEBOUNCE_MS = 300;

const withUid = (layout: PlacedPiece[]): CanvasItem[] => layout.map((p) => ({ ...p, uid: crypto.randomUUID() }));
const strip = (items: CanvasItem[]): PlacedPiece[] =>
  items.map(({ pieceId, x, y, w, h, z }) => ({ pieceId, x, y, w, h, z }));
const sameLayout = (a: PlacedPiece[], b: PlacedPiece[]) => JSON.stringify(a) === JSON.stringify(b);

export function DraftProvider({ children }: { children: ReactNode }) {
  const { initialDraft, pieces, saveDraft } = useAppData();
  const [items, setItemsState] = useState<CanvasItem[]>(() => {
    // Drop pieces that were deleted (and purged) since the draft was written.
    const ids = new Set(pieces.map((p) => p.id));
    return withUid(initialDraft.filter((p) => ids.has(p.pieceId)));
  });
  const [baseline, setBaseline] = useState<PlacedPiece[]>([]);

  // ---- Debounced write of the draft ----
  const pending = useRef<PlacedPiece[] | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    if (pending.current) {
      void saveDraft(pending.current).catch((err) => console.error('Draft not saved', err));
      pending.current = null;
    }
  }, [saveDraft]);

  const schedule = useCallback(
    (next: CanvasItem[]) => {
      pending.current = strip(next);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, DEBOUNCE_MS);
    },
    [flush],
  );

  useEffect(() => {
    const onHide = () => flush();
    window.addEventListener('pagehide', onHide);
    const onVisibility = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onVisibility);
      flush();
    };
  }, [flush]);

  // After a backup import the app reloads its data: take the imported draft.
  const loadedDraft = useRef(initialDraft);
  useEffect(() => {
    if (loadedDraft.current === initialDraft) return;
    loadedDraft.current = initialDraft;
    // Drop any edit still waiting to be written; it would overwrite the imported draft.
    window.clearTimeout(timer.current);
    pending.current = null;
    const ids = new Set(pieces.map((p) => p.id));
    setItemsState(withUid(initialDraft.filter((p) => ids.has(p.pieceId))));
    setBaseline([]);
    // Only a new initialDraft (a reload) should reset the canvas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDraft]);

  const setItems = useCallback(
    (update: (items: CanvasItem[]) => CanvasItem[]) => {
      setItemsState((prev) => {
        const next = update(prev);
        if (next !== prev) schedule(next);
        return next;
      });
    },
    [schedule],
  );

  const replace = useCallback(
    (layout: PlacedPiece[]) => {
      const next = withUid(layout);
      setItemsState(next);
      setBaseline(layout);
      schedule(next);
    },
    [schedule],
  );

  const discardPending = useCallback(() => {
    window.clearTimeout(timer.current);
    pending.current = null;
  }, []);

  const markSaved = useCallback(() => setBaseline(strip(items)), [items]);

  const isDirty = items.length > 0 && !sameLayout(strip(items), baseline);

  const value = useMemo(
    () => ({ items, setItems, replace, markSaved, isDirty, discardPending }),
    [items, setItems, replace, markSaved, isDirty, discardPending],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
