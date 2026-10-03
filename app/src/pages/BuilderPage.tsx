import { useCallback, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Category, ID, PlacedPiece } from '../storage';
import { useAppData, type PieceView } from '../state/AppData';
import { useDraft } from '../state/Draft';
import { useSelection } from '../lib/useSelection';
import { AddPiecePopup } from '../components/AddPiecePopup';
import { CategoryManager } from '../components/CategoryManager';
import type { TabValue } from '../components/CategoryTabs';
import { OutfitCanvas, type CanvasHandle } from '../components/OutfitCanvas';
import { PageHeader } from '../components/PageHeader';
import { SaveOutfitPopup } from '../components/SaveOutfitPopup';
import type { DropTarget, TileSelection } from '../components/PieceTile';
import { Modal, ModalActions } from '../components/Modal';
import { SelectionBar } from '../components/SelectionBar';
import { useToast } from '../components/Toast';
import { WardrobeCard } from '../components/WardrobeCard';
import { WardrobeDrawer } from '../components/WardrobeDrawer';
import './BuilderPage.css';

export function BuilderPage() {
  const { categories, pieces, outfits, deletePieces, restorePieces, purgePieces } = useAppData();
  const toast = useToast();
  const selection = useSelection<ID>();
  const [confirmDelete, setConfirmDelete] = useState<{ ids: ID[]; used: number } | null>(null);
  const { items, markSaved } = useDraft();
  const [saving, setSaving] = useState<PlacedPiece[] | null>(null);
  const [drawer, setDrawer] = useState<{ focusSearch: boolean } | null>(null);
  const [tab, setTab] = useState<TabValue>('all');
  const [addFiles, setAddFiles] = useState<File[] | null>(null);
  const [revealPieceId, setRevealPieceId] = useState<ID | null>(null);
  const [managing, setManaging] = useState<{ category: Category; anchor: HTMLElement } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const canvas = useRef<CanvasHandle>(null);

  const openPicker = () => fileInput.current?.click();

  const onAddClosed = (lastAdded: PieceView | null) => {
    setAddFiles(null);
    if (lastAdded) {
      setTab(lastAdded.categoryId);
      setRevealPieceId(lastAdded.id);
    }
  };

  const place = (piece: PieceView) => canvas.current?.placeCenter(piece);
  const dropTarget = useMemo<DropTarget>(
    () => ({
      drop: (piece, x, y) => canvas.current?.placeAt(piece, x, y) ?? false,
      isOver: (x, y) => canvas.current?.hitTest(x, y) ?? false,
    }),
    [],
  );

  const tileSelection = useMemo<TileSelection>(
    () => ({
      active: selection.active,
      isSelected: (id) => !!selection.selected?.has(id),
      onHold: (piece) => selection.start(piece.id),
      onToggle: (piece) => selection.toggle(piece.id),
    }),
    [selection],
  );

  const deleteNow = useCallback(
    async (ids: ID[]) => {
      try {
        await deletePieces(ids);
      } catch {
        toast({ message: "Couldn't delete those pieces. Try again." });
        return;
      }
      selection.exit();
      toast({
        message: `${ids.length} ${ids.length === 1 ? 'piece' : 'pieces'} deleted`,
        actionLabel: 'Undo',
        onAction: () => void restorePieces(ids).catch(() => toast({ message: "Couldn't undo. Try again." })),
        onDismiss: () => void purgePieces(ids).catch((err) => console.error('Purge failed', err)),
      });
    },
    [deletePieces, restorePieces, purgePieces, selection, toast],
  );

  const deleteSelected = () => {
    const ids = [...(selection.selected ?? [])];
    if (!ids.length) return;
    const used = ids.filter((id) => outfits.some((o) => o.layout.some((p) => p.pieceId === id))).length;
    if (used > 0) setConfirmDelete({ ids, used });
    else void deleteNow(ids);
  };

  const openDrawer = (focusSearch: boolean) => {
    // Bring the top of the canvas into view so pieces can be dragged onto it.
    const el = canvas.current?.getElement();
    if (el) window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - 12) });
    setDrawer({ focusSearch });
  };

  const selectionBar = selection.selected && (
    <SelectionBar
      placement="anchored"
      count={selection.selected.size}
      onCancel={selection.exit}
      onDelete={deleteSelected}
    />
  );

  const openSave = () => {
    const ids = new Set(pieces.map((p) => p.id));
    const layout = items
      .filter((i) => ids.has(i.pieceId))
      .map(({ pieceId, x, y, w, h, z }) => ({ pieceId, x, y, w, h, z }));
    if (layout.length) setSaving(layout);
  };

  return (
    <>
      <PageHeader
        title="Build your outfit"
        right={
          <Link to="/saved" className="pill pill--lilac">
            Saved outfits
          </Link>
        }
      />
      <main className="column builder">
        <OutfitCanvas ref={canvas} onSave={openSave} />
        <WardrobeCard
          tab={tab}
          onTab={setTab}
          onAddPhoto={openPicker}
          onOpenDrawer={openDrawer}
          onManageCategory={(category, anchor) => setManaging({ category, anchor })}
          revealPieceId={revealPieceId}
          onPlace={place}
          dropTarget={dropTarget}
          selection={tileSelection}
          selectionBar={drawer ? null : selectionBar}
        />
      </main>

      {drawer && (
        <WardrobeDrawer
          tab={tab}
          onTab={setTab}
          focusSearch={drawer.focusSearch}
          onClose={() => setDrawer(null)}
          onAddPhoto={openPicker}
          onManageCategory={(category, anchor) => setManaging({ category, anchor })}
          onPlace={(piece) => {
            place(piece);
            setDrawer(null);
          }}
          dropTarget={dropTarget}
          selection={tileSelection}
          selectionBar={selectionBar}
        />
      )}

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = ''; // allow picking the same file again
          if (files.length) setAddFiles(files);
        }}
      />

      {addFiles && (
        <AddPiecePopup
          files={addFiles}
          initialCategoryId={tab === 'all' || !categories.some((c) => c.id === tab) ? null : tab}
          onClose={onAddClosed}
        />
      )}

      {saving && <SaveOutfitPopup layout={saving} onSaved={markSaved} onClose={() => setSaving(null)} />}

      {confirmDelete && (
        <Modal title="Delete these pieces?" onClose={() => setConfirmDelete(null)} width={420}>
          <p className="confirm-text">
            {confirmDelete.used === 1
              ? '1 piece is used in saved outfits.'
              : `${confirmDelete.used} pieces are used in saved outfits.`}{' '}
            Those outfits will keep their picture.
          </p>
          <ModalActions>
            <button type="button" className="pill pill--outline" onClick={() => setConfirmDelete(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="pill pill--primary"
              onClick={() => {
                const { ids } = confirmDelete;
                setConfirmDelete(null);
                void deleteNow(ids);
              }}
            >
              Delete {confirmDelete.ids.length === 1 ? 'piece' : `${confirmDelete.ids.length} pieces`}
            </button>
          </ModalActions>
        </Modal>
      )}

      {managing && (
        <CategoryManager
          category={managing.category}
          anchor={managing.anchor}
          onDeleted={(id) => tab === id && setTab('all')}
          onClose={() => setManaging(null)}
        />
      )}
    </>
  );
}
