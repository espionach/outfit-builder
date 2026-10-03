import { useCallback, useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from 'react';

export const HOLD_MS = 500;
export const MOVE_TOLERANCE = 8;

type Options<T extends HTMLElement> = {
  onHold(el: T): void;
  disabled?: boolean;
};

/**
 * Press-and-hold detection with Pointer Events (BUILD_SPEC.md §6): a 500ms timer
 * starts on pointerdown and is cancelled if the pointer moves more than 8px,
 * lifts, or the browser takes the gesture over for scrolling (pointercancel).
 * The click that follows a successful hold is swallowed.
 */
export function useLongPress<T extends HTMLElement>({ onHold, disabled }: Options<T>) {
  const timer = useRef<number | undefined>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);
  const held = useRef(false);
  const onHoldRef = useRef(onHold);
  onHoldRef.current = onHold;

  const cancel = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    start.current = null;
  }, []);

  useEffect(() => cancel, [cancel]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<T>) => {
      held.current = false;
      if (disabled || e.button !== 0) return;
      const el = e.currentTarget;
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(() => {
        held.current = true;
        start.current = null;
        navigator.vibrate?.(10);
        onHoldRef.current(el);
      }, HOLD_MS);
    },
    [disabled],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<T>) => {
      if (!start.current) return;
      if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > MOVE_TOLERANCE) cancel();
    },
    [cancel],
  );

  const onClickCapture = useCallback((e: ReactMouseEvent<T>) => {
    if (held.current) {
      held.current = false;
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  // Stop the long-press callout / context menu on touch devices.
  const onContextMenu = useCallback((e: ReactMouseEvent<T>) => {
    if (start.current || held.current) e.preventDefault();
  }, []);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onClickCapture,
    onContextMenu,
  };
}
