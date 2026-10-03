import type { PieceView } from '../state/AppData';
import { useLongPress } from '../lib/useLongPress';
import { useTileDrag } from '../lib/useTileDrag';
import { CheckIcon } from './icons';
import { HOLD_HINT_SELECT, isMenuKey } from '../lib/a11y';
import './PieceTile.css';

/** Where a dragged tile can be dropped (the canvas). */
export type DropTarget = {
  drop(piece: PieceView, clientX: number, clientY: number): boolean;
  isOver(clientX: number, clientY: number): boolean;
};

export type TileSelection = {
  /** Selection mode is on: taps toggle, dragging is off. */
  active: boolean;
  isSelected(id: string): boolean;
  /** Press-and-hold (or context menu): enter selection mode with this piece. */
  onHold(piece: PieceView): void;
  onToggle(piece: PieceView): void;
};

type Props = {
  piece: PieceView;
  label: string;
  onPlace(piece: PieceView): void;
  dropTarget: DropTarget;
  selection: TileSelection;
  onDragStart?(): void;
  onDragEnd?(): void;
  size?: 'strip' | 'grid';
};

/**
 * A wardrobe tile. Drag it onto the canvas, or tap / press Enter to place it at
 * the center. Press and hold to start selecting pieces for deletion.
 */
export function PieceTile({
  piece,
  label,
  onPlace,
  dropTarget,
  selection,
  onDragStart,
  onDragEnd,
  size = 'strip',
}: Props) {
  const selected = selection.active && selection.isSelected(piece.id);
  const drag = useTileDrag({
    imageUrl: piece.thumbUrl,
    onDrop: (x, y) => dropTarget.drop(piece, x, y),
    isOverTarget: dropTarget.isOver,
    onDragStart,
    onDragEnd,
    disabled: selection.active,
    // In the drawer grid, vertical swipes scroll; a short hold lifts the tile for dragging.
    touchLiftMs: size === 'grid' ? 200 : undefined,
  });
  const press = useLongPress<HTMLButtonElement>({
    onHold: () => {
      // A drag that's already moving wins over a late hold.
      if (drag.isMoving()) return;
      drag.cancel();
      selection.onHold(piece);
    },
    disabled: selection.active,
  });

  return (
    <button
      type="button"
      className={`piece-tile piece-tile--${size} ${selected ? 'piece-tile--selected' : ''}`}
      data-piece-id={piece.id}
      aria-label={selection.active ? label : `${label}: place on canvas`}
      aria-pressed={selection.active ? selected : undefined}
      {...press}
      onPointerDown={(e) => {
        press.onPointerDown(e);
        drag.onPointerDown(e);
      }}
      onClickCapture={(e) => {
        press.onClickCapture(e);
        drag.onClickCapture(e);
      }}
      onContextMenu={(e) => {
        // Right-click / the context-menu key also start selection (desktop and keyboard).
        e.preventDefault();
        if (!selection.active) {
          drag.cancel();
          selection.onHold(piece);
        }
      }}
      onKeyDown={(e) => {
        if (isMenuKey(e) && !selection.active) {
          e.preventDefault();
          selection.onHold(piece);
        }
      }}
      aria-description={selection.active ? undefined : HOLD_HINT_SELECT}
      onClick={() => (selection.active ? selection.onToggle(piece) : onPlace(piece))}
    >
      <img src={piece.thumbUrl} alt="" draggable={false} />
      {selection.active &&
        (selected ? (
          <span className="piece-tile__check" aria-hidden="true">
            <CheckIcon />
          </span>
        ) : (
          <span className="piece-tile__circle" aria-hidden="true" />
        ))}
    </button>
  );
}
