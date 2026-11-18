import { adjustColor, blurImage, mixOriginal, rotateImage, rotateQuadrants } from './effects';
export interface Pixels { width: number; height: number; data: Uint8ClampedArray }
export interface FilterParams { stripWidth: number; iterations: number; mirror: boolean; reverse: boolean; clockwise: boolean; mix: number; contrast: number; saturation: number; blurType: 'none' | 'gaussian' | 'box'; blurStrength: number; rotation: number; quadrantRotations: [number, number, number, number] }
export const defaults: FilterParams = { stripWidth: 8, iterations: 2, mirror: true, reverse: false, clockwise: false, mix: 100, contrast: 0, saturation: 100, blurType: 'none', blurStrength: 0, rotation: 0, quadrantRotations: [0, 0, 0, 0] };

/** Reflect about the central axes; every source pixel appears exactly four times. */
export function mirrorGrid(source: Pixels): Pixels {
  const { width: w, height: h, data } = source;
  const width = w * 2, height = h * 2, out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const sx = x < w ? x : width - 1 - x, sy = y < h ? y : height - 1 - y;
    const from = (sy * w + sx) * 4, to = (y * width + x) * 4;
    out.set(data.subarray(from, from + 4), to);
  }
  return { width, height, data: out };
}

/** Cut fixed-width columns, alternate left/right, rotate each strip and stack.
 * The last partial strip is retained, so no pixel is cropped or duplicated.
 * A pass transposes the dimensions. Two passes restore the original dimensions.
 */
export function weave(source: Pixels, thickness: number, reverse = false, clockwise = true): Pixels {
  const { width: w, height: h, data } = source;
  const size = Math.max(1, Math.min(w, Math.round(thickness)));
  const columns: { x: number; size: number }[] = [];
  for (let x = 0; x < w; x += size) columns.push({ x, size: Math.min(size, w - x) });
  const out = new Uint8ClampedArray(data.length);
  let left = 0, right = columns.length - 1, top = 0, turn = reverse;
  while (left <= right) {
    const strip = columns[turn ? right-- : left++];
    for (let dx = 0; dx < strip.size; dx++) for (let y = 0; y < h; y++) {
      const nx = clockwise ? h - 1 - y : y;
      const ny = top + (clockwise ? dx : strip.size - 1 - dx);
      const from = (y * w + strip.x + dx) * 4, to = (ny * h + nx) * 4;
      out.set(data.subarray(from, from + 4), to);
    }
    top += strip.size; turn = !turn;
  }
  return { width: h, height: w, data: out };
}

export function processImage(source: Pixels, params: FilterParams): Pixels {
  const base = params.mirror ? rotateQuadrants(mirrorGrid(source), params.quadrantRotations) : source;
  let result = base;
  const passes = Math.max(1, Math.min(12, Math.round(params.iterations)));
  for (let i = 0; i < passes; i++) result = weave(result, params.stripWidth, params.reverse, params.clockwise);
  result = adjustColor(result, params.contrast, params.saturation);
  result = blurImage(result, params.blurType, params.blurStrength);
  result = rotateImage(result, params.rotation);
  return mixOriginal(result, source, params.mix);
}
