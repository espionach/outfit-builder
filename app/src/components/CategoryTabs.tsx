import { useMemo, useRef } from 'react';
import type { Category, ID } from '../storage';
import { useAppData } from '../state/AppData';
import { useLongPress } from '../lib/useLongPress';
import { useScrollEdges } from '../lib/useScrollEdges';
import { HOLD_HINT_MANAGE, isMenuKey } from '../lib/a11y';
import './CategoryTabs.css';

export type TabValue = ID | 'all';

type Props = {
  selected: TabValue;
  onSelect(value: TabValue): void;
  /** Press-and-hold (or right-click) on a category tab. */
  onManage?(category: Category, anchor: HTMLElement): void;
  size?: 'md' | 'sm';
  label?: string;
};

export function CategoryTabs({ selected, onSelect, onManage, size = 'md', label = 'Categories' }: Props) {
  const { categories, pieces } = useAppData();
  const rowRef = useRef<HTMLDivElement>(null);
  const edges = useScrollEdges(rowRef, [categories.length]);

  const counts = useMemo(() => {
    const map = new Map<ID, number>();
    pieces.forEach((p) => map.set(p.categoryId, (map.get(p.categoryId) ?? 0) + 1));
    return map;
  }, [pieces]);

  return (
    <div className={`tabs tabs--${size}`}>
      <div ref={rowRef} className="tabs__row" role="group" aria-label={label}>
        <Tab label="All" count={pieces.length} selected={selected === 'all'} onClick={() => onSelect('all')} />
        {categories.map((c) => (
          <Tab
            key={c.id}
            label={c.name}
            count={counts.get(c.id) ?? 0}
            selected={selected === c.id}
            onClick={() => onSelect(c.id)}
            onManage={onManage ? (el) => onManage(c, el) : undefined}
          />
        ))}
      </div>
      {edges.left && <div className="tabs__fade tabs__fade--left" aria-hidden="true" />}
      {edges.right && <div className="tabs__fade tabs__fade--right" aria-hidden="true" />}
    </div>
  );
}

type TabProps = {
  label: string;
  count: number;
  selected: boolean;
  onClick(): void;
  onManage?(el: HTMLElement): void;
};

function Tab({ label, count, selected, onClick, onManage }: TabProps) {
  const press = useLongPress<HTMLButtonElement>({ onHold: (el) => onManage?.(el), disabled: !onManage });
  return (
    <button
      type="button"
      className="tab"
      aria-pressed={selected}
      {...press}
      onClick={onClick}
      onContextMenu={(e) => {
        if (!onManage) return;
        e.preventDefault();
        onManage(e.currentTarget);
      }}
      onKeyDown={(e) => {
        if (onManage && isMenuKey(e)) {
          e.preventDefault();
          onManage(e.currentTarget);
        }
      }}
      aria-description={onManage ? HOLD_HINT_MANAGE : undefined}
    >
      {label}
      <span className="tab__count">{count}</span>
    </button>
  );
}
