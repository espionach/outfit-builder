import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import type { Category, ID } from '../storage';
import { useAppData, type PieceView } from '../state/AppData';
import { useScrollEdges } from '../lib/useScrollEdges';
import { CategoryTabs, type TabValue } from './CategoryTabs';
import { ChevronLeft, ChevronRight, ExpandIcon, PlusIcon, SearchIcon } from './icons';
import { PieceTile, type DropTarget, type TileSelection } from './PieceTile';
import './WardrobeCard.css';

type Props = {
  tab: TabValue;
  onTab(tab: TabValue): void;
  onAddPhoto(): void;
  onOpenDrawer(focusSearch: boolean): void;
  onManageCategory(category: Category, anchor: HTMLElement): void;
  /** Scroll this piece into view (e.g. right after adding it). */
  revealPieceId: ID | null;
  onPlace(piece: PieceView): void;
  dropTarget: DropTarget;
  selection: TileSelection;
  /** Shown above the card in selection mode. */
  selectionBar?: ReactNode;
};

export function WardrobeCard({
  tab,
  onTab,
  onAddPhoto,
  onOpenDrawer,
  onManageCategory,
  revealPieceId,
  onPlace,
  dropTarget,
  selection,
  selectionBar,
}: Props) {
  const { pieces, categories } = useAppData();
  const stripRef = useRef<HTMLDivElement>(null);
  const visible = useMemo(() => (tab === 'all' ? pieces : pieces.filter((p) => p.categoryId === tab)), [pieces, tab]);
  const edges = useScrollEdges(stripRef, [visible.length]);
  const categoryName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  // Start each tab at the beginning.
  useEffect(() => {
    stripRef.current?.scrollTo({ left: 0 });
  }, [tab]);

  useEffect(() => {
    if (!revealPieceId) return;
    const el = stripRef.current?.querySelector<HTMLElement>(`[data-piece-id="${revealPieceId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
  }, [revealPieceId, visible]);

  const scrollBy = (dir: 1 | -1) => {
    const el = stripRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.75, behavior: 'smooth' });
  };

  return (
    <section className="wardrobe-card" aria-label="Wardrobe">
      {selectionBar}
      <div className="wardrobe-card__top">
        <CategoryTabs selected={tab} onSelect={onTab} onManage={onManageCategory} label="Wardrobe categories" />
        <button
          type="button"
          className="icon-btn"
          aria-label="Search wardrobe"
          title="Search wardrobe"
          onClick={() => onOpenDrawer(true)}
        >
          <SearchIcon />
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label="Open full wardrobe"
          title="Open full wardrobe"
          onClick={() => onOpenDrawer(false)}
        >
          <ExpandIcon />
        </button>
      </div>

      {pieces.length === 0 ? (
        <button type="button" className="add-first" onClick={onAddPhoto}>
          <PlusIcon size={20} />
          Add your first piece
        </button>
      ) : (
        <div className="strip">
          <div ref={stripRef} className="strip__scroller" role="list" aria-label="Pieces">
            <div role="listitem">
              <button type="button" className="add-tile" onClick={onAddPhoto}>
                <PlusIcon size={20} />
                Add photo
              </button>
            </div>
            {visible.map((piece) => (
              <div role="listitem" key={piece.id}>
                <PieceTile
                  piece={piece}
                  label={piece.name || categoryName.get(piece.categoryId) || 'Piece'}
                  onPlace={onPlace}
                  dropTarget={dropTarget}
                  selection={selection}
                />
              </div>
            ))}
          </div>
          {edges.left && <div className="strip__fade strip__fade--left" aria-hidden="true" />}
          {edges.right && <div className="strip__fade strip__fade--right" aria-hidden="true" />}
          {edges.left && (
            <button
              type="button"
              className="strip__arrow strip__arrow--left"
              aria-label="Scroll left"
              onClick={() => scrollBy(-1)}
            >
              <ChevronLeft />
            </button>
          )}
          {edges.right && (
            <button
              type="button"
              className="strip__arrow strip__arrow--right"
              aria-label="Scroll right"
              onClick={() => scrollBy(1)}
            >
              <ChevronRight />
            </button>
          )}
        </div>
      )}
    </section>
  );
}
