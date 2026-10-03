import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Category } from '../storage';
import { useAppData, type PieceView } from '../state/AppData';
import { CategoryTabs, type TabValue } from './CategoryTabs';
import { CollapseIcon, PlusIcon, SearchIcon } from './icons';
import { isAnyModalOpen } from './Modal';
import { PieceTile, type DropTarget, type TileSelection } from './PieceTile';
import './WardrobeDrawer.css';

type Props = {
  tab: TabValue;
  onTab(tab: TabValue): void;
  focusSearch: boolean;
  onClose(): void;
  onAddPhoto(): void;
  onManageCategory(category: Category, anchor: HTMLElement): void;
  onPlace(piece: PieceView): void;
  dropTarget: DropTarget;
  selection: TileSelection;
  selectionBar?: ReactNode;
};

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Full wardrobe: a sheet that slides up over the lower part of the builder (BUILD_SPEC.md §4.3). */
export function WardrobeDrawer({
  tab,
  onTab,
  focusSearch,
  onClose,
  onAddPhoto,
  onManageCategory,
  onPlace,
  dropTarget,
  selection,
  selectionBar,
}: Props) {
  const { pieces, categories } = useAppData();
  const [query, setQuery] = useState('');
  const sheetRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const selectingRef = useRef(selection.active);
  selectingRef.current = selection.active;

  // Focus, Esc, focus trap and background scroll lock.
  useEffect(() => {
    const sheet = sheetRef.current!;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    (focusSearch ? searchRef.current : closeRef.current)?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (isAnyModalOpen()) return;
      if (e.key === 'Escape') {
        // Esc ends selection mode first (handled by useSelection), then closes the drawer.
        if (selectingRef.current) return;
        if (document.querySelector('[role="menu"]')) return;
        e.preventDefault();
        onCloseRef.current();
      } else if (e.key === 'Tab') {
        const items = [...sheet.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || !sheet.contains(document.activeElement))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (document.activeElement === last || !sheet.contains(document.activeElement))) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const root = document.documentElement;
    root.classList.add('drawer-open');
    return () => {
      document.removeEventListener('keydown', onKey);
      root.classList.remove('drawer-open');
      previouslyFocused?.focus?.({ preventScroll: true });
    };
    // Runs once per opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categoryName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const q = query.trim().toLowerCase();
  const groups = useMemo(() => {
    const matches = (p: PieceView) =>
      !q ||
      (p.name ?? '').toLowerCase().includes(q) ||
      (categoryName.get(p.categoryId) ?? '').toLowerCase().includes(q);
    return categories
      .filter((c) => tab === 'all' || c.id === tab)
      .map((c) => ({ category: c, pieces: pieces.filter((p) => p.categoryId === c.id && matches(p)) }))
      .filter((g) => g.pieces.length > 0);
  }, [categories, pieces, tab, q, categoryName]);

  const selectedCategory = tab === 'all' ? null : categories.find((c) => c.id === tab);

  return (
    <>
      <div className="drawer-scrim" onClick={onClose} aria-hidden="true" />
      <section
        ref={sheetRef}
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Wardrobe"
        data-covers-canvas
      >
        {selectionBar}
        <div className="drawer__grabber" aria-hidden="true" />
        <div className="drawer__head">
          <div className="drawer__title">
            <h2>Wardrobe</h2>
            <span className="drawer__count">
              {pieces.length} {pieces.length === 1 ? 'piece' : 'pieces'}
            </span>
          </div>
          <div className="drawer__actions">
            <button type="button" className="drawer__add" onClick={onAddPhoto}>
              <PlusIcon size={16} />
              Add photo
            </button>
            <button
              ref={closeRef}
              type="button"
              className="icon-btn drawer__close"
              aria-label="Close full wardrobe"
              title="Back to compact view"
              onClick={onClose}
            >
              <CollapseIcon />
            </button>
          </div>
        </div>

        <label className="drawer__search">
          <SearchIcon size={16} />
          <input
            ref={searchRef}
            type="search"
            placeholder="Search your wardrobe"
            aria-label="Search your wardrobe"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              // First Esc clears the search; the next one closes the drawer.
              if (e.key === 'Escape' && query) {
                e.preventDefault();
                e.nativeEvent.stopImmediatePropagation();
                setQuery('');
              }
            }}
          />
        </label>

        <CategoryTabs
          selected={tab}
          onSelect={onTab}
          onManage={onManageCategory}
          size="sm"
          label="Wardrobe categories"
        />

        <div className="drawer__body">
          {groups.length === 0 ? (
            <p className="drawer__empty">
              {q
                ? `Nothing matches '${query.trim()}'`
                : selectedCategory
                  ? `No pieces in ${selectedCategory.name} yet`
                  : 'Add your first piece'}
            </p>
          ) : (
            groups.map(({ category, pieces: list }) => (
              <section key={category.id} className="drawer__group" aria-label={category.name}>
                <h3 className="caps drawer__group-title">
                  {category.name} <span className="caps__soft">· {list.length}</span>
                </h3>
                <div className="drawer__grid">
                  {list.map((piece) => (
                    <PieceTile
                      key={piece.id}
                      piece={piece}
                      size="grid"
                      label={piece.name || category.name}
                      onPlace={onPlace}
                      dropTarget={dropTarget}
                      selection={selection}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </section>
    </>
  );
}
