// Outfit snapshots (BUILD_SPEC.md §5.3): draw each placed piece onto an
// offscreen canvas at its saved position, on the white dot-grid background.

import type { PlacedPiece } from '../storage';
import { encode } from './images';

/** Snapshot size: the canvas' 5:6 shape (640×768 on desktop) at 1.5× for crisp cards. */
export const SNAPSHOT_WIDTH = 960;
export const SNAPSHOT_HEIGHT = 1152;

const DOT_COLOR = '#f6d5e2';
const DOT_SPACING = 22; // in design px (640-wide canvas)
const DOT_RADIUS = 1.2;

function drawDotGrid(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const scale = width / 640;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = DOT_COLOR;
  const step = DOT_SPACING * scale;
  const r = DOT_RADIUS * scale;
  // Match CSS radial-gradient tiles: a dot centered in each cell.
  for (let y = step / 2; y < height; y += step) {
    for (let x = step / 2; x < width; x += step) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/**
 * Render a layout to an image blob. `images` maps pieceId → a decodable image
 * source (the piece's stored full-size image). Missing pieces are skipped.
 */
export async function renderSnapshot(layout: PlacedPiece[], images: Map<string, Blob>): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = SNAPSHOT_WIDTH;
  canvas.height = SNAPSHOT_HEIGHT;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  drawDotGrid(ctx, canvas.width, canvas.height);

  const ordered = [...layout].sort((a, b) => a.z - b.z);
  const bitmaps = await Promise.all(
    ordered.map((p) => {
      const blob = images.get(p.pieceId);
      return blob ? createImageBitmap(blob).catch(() => null) : Promise.resolve(null);
    }),
  );

  ordered.forEach((p, i) => {
    const bitmap = bitmaps[i];
    if (!bitmap) return;
    ctx.drawImage(bitmap, p.x * canvas.width, p.y * canvas.height, p.w * canvas.width, p.h * canvas.height);
    bitmap.close();
  });

  return encode(canvas);
}
