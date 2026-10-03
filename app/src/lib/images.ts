// Photo pipeline (BUILD_SPEC.md §5.3): fix orientation, downscale, encode.

export const MAX_EDGE = 1200;
export const THUMB_EDGE = 256;

export type ProcessedPhoto = { image: Blob; thumb: Blob; width: number; height: number };

function fit(width: number, height: number, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** WebP at 0.85 (keeps transparency); PNG where the browser can't encode WebP. */
export async function encode(canvas: HTMLCanvasElement): Promise<Blob> {
  const webp = await canvasToBlob(canvas, 'image/webp', 0.85);
  if (webp && webp.type === 'image/webp') return webp;
  const png = await canvasToBlob(canvas, 'image/png');
  if (!png) throw new Error('Could not encode image');
  return png;
}

function draw(source: CanvasImageSource, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

export async function processPhoto(file: Blob): Promise<ProcessedPhoto> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const size = fit(bitmap.width, bitmap.height, MAX_EDGE);
    const full = draw(bitmap, size.width, size.height);
    const thumbSize = fit(size.width, size.height, THUMB_EDGE);
    const [image, thumb] = await Promise.all([encode(full), encode(draw(full, thumbSize.width, thumbSize.height))]);
    return { image, thumb, width: size.width, height: size.height };
  } finally {
    bitmap.close();
  }
}
