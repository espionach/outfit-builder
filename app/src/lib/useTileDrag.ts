import { useCallback, useEffect, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { MOVE_TOLERANCE } from './useLongPress';

type Options = {
  /** Image shown in the floating ghost. */
  imageUrl: string;
  /** Called on release; return true if the piece was placed. */
  onDrop(clientX: number, clientY: number): boolean;
  /** Tells the canvas whether a point is a valid drop target (for the ghost's hover state). */
  isOverTarget(clientX: number, clientY: number): boolean;
  onDragStart?(): void;
  onDragEnd?(): void;
  disabled?: boolean;
  /**
   * Touch only: hold still this long to "lift" the tile before dragging.
   * Moving earlier is left to the browser (scrolling). Used in the drawer,
   * where dragging up to the canvas and scrolling the grid are the same motion.
   */
  touchLiftMs?: number;
};

/**
 * Drag a wardrobe tile onto the canvas with Pointer Events (BUILD_SPEC.md §6).
 * A drag starts once the pointer moves past the tolerance. With touch, the
 * strip's `touch-action: pan-x` lets sideways swipes scroll (the browser then
 * sends pointercancel), while other movement becomes a drag. The click that
 * follows a drag is swallowed, so a plain tap still means "place at center".
 *
 * Moves are tracked on `window` from pointerdown on, because a fast mouse can
 * leave the tile before the first pointermove reaches it.
 */
export function useTileDrag({
  imageUrl,
  onDrop,
  isOverTarget,
  onDragStart,
  onDragEnd,
  disabled,
  touchLiftMs,
}: Options) {
  const justDragged = useRef(false);
  /** True while a drag is under way and the pointer has actually moved. */
  const moving = useRef(false);
  const stop = useRef<(() => void) | null>(null);
  const opts = useRef({ onDrop, isOverTarget, onDragStart, onDragEnd, imageUrl });
  opts.current = { onDrop, isOverTarget, onDragStart, onDragEnd, imageUrl };

  useEffect(() => () => stop.current?.(), []);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      justDragged.current = false;
      if (disabled || e.button !== 0) return;
      stop.current?.();

      const tile = e.currentTarget;
      const { pointerId } = e;
      const startX = e.clientX;
      const startY = e.clientY;
      const needsLift = e.pointerType === 'touch' && !!touchLiftMs;
      let ghost: HTMLElement | null = null;
      let liftTimer: number | undefined;

      const moveGhost = (x: number, y: number) => {
        if (!ghost) return;
        ghost.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
        ghost.classList.toggle('drag-ghost--over', opts.current.isOverTarget(x, y));
      };

      // Once lifted, stop the browser from scrolling under the finger.
      const blockScroll = (ev: TouchEvent) => {
        if (ev.cancelable) ev.preventDefault();
      };

      const begin = (x: number, y: number) => {
        try {
          tile.setPointerCapture(pointerId);
        } catch {
          // Pointer already gone; the window listeners still see the rest.
        }
        window.addEventListener('touchmove', blockScroll, { passive: false });
        document.documentElement.classList.add('is-dragging-piece');
        ghost = document.createElement('div');
        ghost.className = 'drag-ghost';
        ghost.setAttribute('data-drag-ghost', '');
        ghost.setAttribute('aria-hidden', 'true');
        const img = document.createElement('img');
        img.src = opts.current.imageUrl;
        img.alt = '';
        ghost.appendChild(img);
        document.body.appendChild(ghost);
        moveGhost(x, y);
        opts.current.onDragStart?.();
      };

      if (needsLift) {
        liftTimer = window.setTimeout(() => {
          liftTimer = undefined;
          navigator.vibrate?.(8);
          begin(startX, startY);
        }, touchLiftMs);
      }

      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        if (!ghost) {
          if (Math.hypot(ev.clientX - startX, ev.clientY - startY) <= MOVE_TOLERANCE) return;
          // Moved before the lift: this is a scroll, not a drag.
          if (needsLift) return finish();
          begin(ev.clientX, ev.clientY);
        }
        ev.preventDefault();
        moving.current = true;
        moveGhost(ev.clientX, ev.clientY);
      };

      const onUp = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        // A lift with no movement is still a tap; only a real move counts as a drag.
        const moved = Math.hypot(ev.clientX - startX, ev.clientY - startY) > MOVE_TOLERANCE;
        const wasDragging = !!ghost && moved;
        finish();
        if (wasDragging) {
          justDragged.current = true;
          opts.current.onDrop(ev.clientX, ev.clientY);
        }
      };

      const onCancel = (ev: PointerEvent) => {
        if (ev.pointerId === pointerId) finish();
      };

      const finish = () => {
        moving.current = false;
        window.clearTimeout(liftTimer);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
        window.removeEventListener('touchmove', blockScroll);
        stop.current = null;
        if (ghost) {
          ghost.remove();
          ghost = null;
          document.documentElement.classList.remove('is-dragging-piece');
          opts.current.onDragEnd?.();
        }
      };

      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
      stop.current = finish;
    },
    [disabled, touchLiftMs],
  );

  const onClickCapture = useCallback((e: ReactMouseEvent<HTMLElement>) => {
    if (justDragged.current) {
      justDragged.current = false;
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  /** Stop tracking the current gesture (e.g. a press-and-hold just took over). */
  const cancel = useCallback(() => stop.current?.(), []);

  const isMoving = useCallback(() => moving.current, []);

  return { onPointerDown, onClickCapture, cancel, isMoving };
}
