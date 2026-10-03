import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useAppData, type PieceView } from '../state/AppData';
import { useDraft, type CanvasItem } from '../state/Draft';
import { clampBox, initialBox, resizeFromCorner, scaleBox, type Box, type Corner, type Size } from '../lib/geometry';
import { announce } from '../lib/a11y';
import { useToast } from './Toast';
import './OutfitCanvas.css';

export type CanvasHandle = {
  /** Drop a piece centered on a screen point. Returns false if the point isn't over the canvas. */
  placeAt(piece: PieceView, clientX: number, clientY: number): boolean;
  /** Place a piece near the canvas center (tap / Enter on a tile). */
  placeCenter(piece: PieceView): void;
  /** Whether a screen point is over the visible canvas. */
  hitTest(clientX: number, clientY: number): boolean;
  getElement(): HTMLElement | null;
};

type Props = {
  onSave(): void;
};

type Gesture =
  | { kind: 'move'; uid: string; pointerId: number; startX: number; startY: number; start: Box }
  | { kind: 'resize'; uid: string; pointerId: number; startX: number; startY: number; start: Box; corner: Corner };

const NUDGE_PX = 4;
const NUDGE_BIG_PX = 24;

export const OutfitCanvas = forwardRef<CanvasHandle, Props>(function OutfitCanvas({ onSave }, ref) {
  const { pieces, categories } = useAppData();
  const { items, setItems } = useDraft();
  const toast = useToast();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size>({ width: 640, height: 760 });
  const [selected, setSelected] = useState<string | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const placeCount = useRef(0);

  const pieceById = useMemo(() => new Map(pieces.map((p) => [p.id, p])), [pieces]);
  const categoryName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  /** Spoken name: the piece's own name, or its category ("Tops"). */
  const nameOf = (piece: PieceView | undefined) =>
    piece?.name || (piece && categoryName.get(piece.categoryId)) || 'Piece';
  // Pieces deleted from the wardrobe disappear from the canvas (and come back on undo).
  const visible = useMemo(() => items.filter((i) => pieceById.has(i.pieceId)), [items, pieceById]);

  useEffect(() => {
    const el = canvasRef.current!;
    const ro = new ResizeObserver(() => setSize({ width: el.clientWidth, height: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const topZ = () => items.reduce((max, i) => Math.max(max, i.z), 0) + 1;

  const updateItem = useCallback(
    (uid: string, patch: Partial<CanvasItem>) =>
      setItems((list) => list.map((i) => (i.uid === uid ? { ...i, ...patch } : i))),
    [setItems],
  );

  const bringToFront = (uid: string) => {
    const item = items.find((i) => i.uid === uid);
    if (!item) return;
    const z = topZ();
    if (item.z !== z - 1 || items.filter((i) => i.z === item.z).length > 1) updateItem(uid, { z });
  };

  const addPiece = (piece: PieceView, center: { x: number; y: number }) => {
    const box = initialBox(piece.width / piece.height, size, center);
    const uid = crypto.randomUUID();
    setItems((list) => [
      ...list,
      { uid, pieceId: piece.id, ...box, z: list.reduce((m, i) => Math.max(m, i.z), 0) + 1 },
    ]);
    setSelected(uid);
    announce(`${nameOf(piece)} placed on the canvas`);
  };

  useImperativeHandle(ref, () => ({
    hitTest(clientX, clientY) {
      const el = canvasRef.current;
      if (!el) return false;
      const r = el.getBoundingClientRect();
      if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) return false;
      // Something (e.g. the wardrobe drawer) may be covering this part of the canvas.
      const top = document.elementsFromPoint(clientX, clientY).find((e) => !e.closest('[data-drag-ghost]'));
      return !!top && (el.contains(top) || !top.closest('[data-covers-canvas]'));
    },
    placeAt(piece, clientX, clientY) {
      if (!this.hitTest(clientX, clientY)) return false;
      const r = canvasRef.current!.getBoundingClientRect();
      addPiece(piece, { x: (clientX - r.left) / r.width, y: (clientY - r.top) / r.height });
      return true;
    },
    placeCenter(piece) {
      // Cascade taps a little so repeated placements don't stack exactly.
      const step = (placeCount.current++ % 6) - 2.5;
      addPiece(piece, { x: 0.5 + (step * 18) / size.width, y: 0.45 + (step * 18) / size.height });
    },
    getElement: () => canvasRef.current,
  }));

  // ---------- Pointer gestures ----------

  const startGesture = (e: ReactPointerEvent, g: Gesture) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    gesture.current = g;
  };

  const onItemPointerDown = (e: ReactPointerEvent<HTMLDivElement>, item: CanvasItem) => {
    if (e.button !== 0) return;
    setSelected(item.uid);
    bringToFront(item.uid);
    e.currentTarget.focus({ preventScroll: true });
    startGesture(e, {
      kind: 'move',
      uid: item.uid,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      start: item,
    });
  };

  const onHandlePointerDown = (e: ReactPointerEvent<HTMLDivElement>, item: CanvasItem, corner: Corner) => {
    if (e.button !== 0) return;
    startGesture(e, {
      kind: 'resize',
      uid: item.uid,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      start: item,
      corner,
    });
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId) return;
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    if (g.kind === 'move') {
      const box = clampBox({ ...g.start, x: g.start.x + dx / size.width, y: g.start.y + dy / size.height }, size);
      updateItem(g.uid, { x: box.x, y: box.y });
    } else {
      updateItem(g.uid, resizeFromCorner(g.start, g.corner, dx, dy, size));
    }
  };

  const endGesture = (e: ReactPointerEvent) => {
    if (gesture.current?.pointerId === e.pointerId) gesture.current = null;
  };

  const remove = (uid: string) => {
    const item = items.find((i) => i.uid === uid);
    setItems((list) => list.filter((i) => i.uid !== uid));
    announce(`${nameOf(item && pieceById.get(item.pieceId))} removed from the canvas`);
    setSelected(null);
    canvasRef.current?.focus({ preventScroll: true });
  };

  // ---------- Keyboard ----------

  const onItemKeyDown = (e: ReactKeyboardEvent, item: CanvasItem) => {
    const step = e.shiftKey ? NUDGE_BIG_PX : NUDGE_PX;
    const move = (dx: number, dy: number) => {
      const box = clampBox({ ...item, x: item.x + dx / size.width, y: item.y + dy / size.height }, size);
      updateItem(item.uid, { x: box.x, y: box.y });
    };
    switch (e.key) {
      case 'ArrowLeft':
        move(-step, 0);
        break;
      case 'ArrowRight':
        move(step, 0);
        break;
      case 'ArrowUp':
        move(0, -step);
        break;
      case 'ArrowDown':
        move(0, step);
        break;
      case '+':
      case '=':
        updateItem(item.uid, scaleBox(item, 1.1, size));
        break;
      case '-':
      case '_':
        updateItem(item.uid, scaleBox(item, 1 / 1.1, size));
        break;
      case 'Delete':
      case 'Backspace':
        remove(item.uid);
        break;
      case 'Escape':
        setSelected(null);
        canvasRef.current?.focus({ preventScroll: true });
        break;
      default:
        return;
    }
    e.preventDefault();
    e.stopPropagation();
  };

  // ---------- Clear all ----------

  const clearAll = () => {
    const before = items;
    setItems(() => []);
    setSelected(null);
    toast({
      message: 'Canvas cleared',
      actionLabel: 'Undo',
      onAction: () => setItems(() => before),
    });
  };

  const empty = visible.length === 0;

  return (
    <section
      ref={canvasRef}
      className="canvas dot-grid"
      aria-label="Outfit canvas"
      tabIndex={-1}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) setSelected(null);
      }}
    >
      {empty && <p className="canvas__empty">Drag pieces from your wardrobe to start an outfit</p>}

      {visible.map((item) => {
        const piece = pieceById.get(item.pieceId)!;
        const isSelected = selected === item.uid;
        return (
          <div
            key={item.uid}
            className={`placed ${isSelected ? 'placed--selected' : ''}`}
            style={{
              left: `${item.x * 100}%`,
              top: `${item.y * 100}%`,
              width: `${item.w * 100}%`,
              height: `${item.h * 100}%`,
              zIndex: item.z,
            }}
            tabIndex={0}
            role="group"
            aria-roledescription="placed piece"
            aria-label={`${nameOf(piece)} on canvas`}
            aria-description="Arrow keys move, plus and minus resize, Delete removes"
            onFocus={() => setSelected(item.uid)}
            onPointerDown={(e) => onItemPointerDown(e, item)}
            onPointerMove={onPointerMove}
            onPointerUp={endGesture}
            onPointerCancel={endGesture}
            onKeyDown={(e) => onItemKeyDown(e, item)}
          >
            <img src={piece.imageUrl} alt="" draggable={false} />
            {isSelected && (
              <>
                {(['tl', 'bl', 'br'] as const).map((corner) => (
                  <div
                    key={corner}
                    className={`placed__handle placed__handle--${corner}`}
                    aria-hidden="true"
                    onPointerDown={(e) => onHandlePointerDown(e, item, corner)}
                    onPointerMove={onPointerMove}
                    onPointerUp={endGesture}
                    onPointerCancel={endGesture}
                  />
                ))}
                <button
                  type="button"
                  className="placed__remove"
                  aria-label={`Remove ${nameOf(piece)} from canvas`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => remove(item.uid)}
                >
                  ×
                </button>
              </>
            )}
          </div>
        );
      })}

      <button
        type="button"
        className="pill pill--outline pill--small canvas__clear"
        onClick={clearAll}
        disabled={empty}
      >
        Clear all
      </button>
      <button type="button" className="pill pill--primary canvas__save" onClick={onSave} disabled={empty}>
        Save outfit
      </button>
    </section>
  );
});
