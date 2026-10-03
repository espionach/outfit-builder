// Canvas geometry. Positions are stored as fractions of the canvas (0–1);
// these helpers work in pixels and convert.

export const MIN_SIZE_PX = 50;
/** Keep at least this much of a piece on the canvas so it can always be grabbed. */
export const KEEP_VISIBLE_PX = 32;
/** A newly placed piece's long edge, as a fraction of the canvas width. */
const PLACE_LONG_EDGE = 0.34;

export type Size = { width: number; height: number };
export type Box = { x: number; y: number; w: number; h: number }; // fractions

export type Corner = 'tl' | 'bl' | 'br';

/** Size (in fractions) for a freshly placed piece with the given natural aspect ratio. */
export function initialBox(aspect: number, canvas: Size, center: { x: number; y: number }): Box {
  const long = canvas.width * PLACE_LONG_EDGE;
  const wPx = aspect >= 1 ? long : long * aspect;
  const hPx = wPx / aspect;
  const w = wPx / canvas.width;
  const h = hPx / canvas.height;
  return clampBox({ x: center.x - w / 2, y: center.y - h / 2, w, h }, canvas);
}

/** Keep a box reachable: at least KEEP_VISIBLE_PX of it stays inside the canvas. */
export function clampBox(box: Box, canvas: Size): Box {
  const kx = KEEP_VISIBLE_PX / canvas.width;
  const ky = KEEP_VISIBLE_PX / canvas.height;
  return {
    ...box,
    x: Math.min(Math.max(box.x, kx - box.w), 1 - kx),
    y: Math.min(Math.max(box.y, ky - box.h), 1 - ky),
  };
}

/**
 * Resize from a corner with the aspect ratio locked (same approach as the
 * original app's initResize). `dx`/`dy` are pointer deltas in px.
 */
export function resizeFromCorner(start: Box, corner: Corner, dx: number, dy: number, canvas: Size): Box {
  const sw = start.w * canvas.width;
  const sh = start.h * canvas.height;
  const aspect = sw / sh;
  const sx = start.x * canvas.width;
  const sy = start.y * canvas.height;

  // Use whichever axis the pointer moved more along, so diagonal drags feel natural.
  const growX = corner === 'br' ? dx : -dx;
  const growY = corner === 'tl' ? -dy : dy;
  const grow = Math.abs(growX) > Math.abs(growY * aspect) ? growX : growY * aspect;

  const minW = aspect >= 1 ? MIN_SIZE_PX * aspect : MIN_SIZE_PX;
  const maxW = Math.min(canvas.width * 1.5, canvas.height * 1.5 * aspect);
  const w = Math.min(Math.max(minW, sw + grow), maxW);
  const h = w / aspect;

  let x = sx;
  let y = sy;
  if (corner === 'bl' || corner === 'tl') x = sx + (sw - w);
  if (corner === 'tl') y = sy + (sh - h);

  return clampBox({ x: x / canvas.width, y: y / canvas.height, w: w / canvas.width, h: h / canvas.height }, canvas);
}

/** Scale a box around its center by `factor` (keyboard +/-). */
export function scaleBox(box: Box, factor: number, canvas: Size): Box {
  const wPx = box.w * canvas.width;
  const hPx = box.h * canvas.height;
  const aspect = wPx / hPx;
  const minW = aspect >= 1 ? MIN_SIZE_PX * aspect : MIN_SIZE_PX;
  const w = Math.min(Math.max(minW, wPx * factor), canvas.width * 1.5) / canvas.width;
  const h = (w * canvas.width) / aspect / canvas.height;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  return clampBox({ x: cx - w / 2, y: cy - h / 2, w, h }, canvas);
}
