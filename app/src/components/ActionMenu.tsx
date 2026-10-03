import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import './ActionMenu.css';

/** `onSelect` must also close the menu (typically by replacing it with a pop-up). */
export type MenuItem = { label: string; onSelect(): void; danger?: boolean; disabled?: boolean };

type Props = {
  /** Element the menu opens next to. */
  anchor: HTMLElement;
  items: MenuItem[];
  label: string;
  onClose(): void;
};

/** Small popover menu (e.g. Rename / Delete after press-and-hold on a tab or folder). */
export function ActionMenu({ anchor, items, label, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const a = anchor.getBoundingClientRect();
    const menu = ref.current!.getBoundingClientRect();
    const margin = 8;
    let top = a.bottom + 6;
    if (top + menu.height > window.innerHeight - margin) top = a.top - menu.height - 6;
    const left = Math.min(Math.max(margin, a.left), window.innerWidth - menu.width - margin);
    setPos({ top, left });
  }, [anchor]);

  useEffect(() => {
    const menu = ref.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const onDown = (e: PointerEvent) => {
      if (!menu?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    // Defer so the pointerup/click that opened the menu doesn't close it.
    const id = window.setTimeout(() => document.addEventListener('pointerdown', onDown, true));
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onClose);
    window.addEventListener('scroll', onClose, true);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('scroll', onClose, true);
      if (document.activeElement === document.body || menu?.contains(document.activeElement)) {
        previouslyFocused?.focus?.();
      }
    };
  }, [onClose]);

  // Focus the first item once the menu is positioned (hidden elements can't take focus).
  const placed = pos !== null;
  useEffect(() => {
    if (placed) ref.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus();
  }, [placed]);

  const onMenuKey = (e: ReactKeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const els = [...ref.current!.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])')];
    const i = els.indexOf(document.activeElement as HTMLElement);
    const next = e.key === 'ArrowDown' ? (i + 1) % els.length : (i - 1 + els.length) % els.length;
    els[next]?.focus();
  };

  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label={label}
      className="action-menu"
      style={pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden' }}
      onKeyDown={onMenuKey}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          className={`action-menu__item ${item.danger ? 'action-menu__item--danger' : ''}`}
          disabled={item.disabled}
          // The item decides what happens next (usually swapping the menu for a pop-up).
          onClick={item.onSelect}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}
