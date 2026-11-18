import type { Pixels } from './filter';

function empty(width: number, height: number): Pixels { return { width, height, data: new Uint8ClampedArray(width * height * 4) }; }

/** Bilinear sampling in premultiplied alpha prevents dark transparent fringes. */
function sample(source: Pixels, x: number, y: number, output: Uint8ClampedArray, at: number) {
  if (x < -.5 || y < -.5 || x > source.width - .5 || y > source.height - .5) return;
  x = Math.max(0, Math.min(source.width - 1, x)); y = Math.max(0, Math.min(source.height - 1, y));
  const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(x0 + 1, source.width - 1), y1 = Math.min(y0 + 1, source.height - 1);
  const fx = x - x0, fy = y - y0;
  const a = (y0 * source.width + x0) * 4, b = (y0 * source.width + x1) * 4, c = (y1 * source.width + x0) * 4, d = (y1 * source.width + x1) * 4;
  const wa = (1 - fx) * (1 - fy) * source.data[a + 3], wb = fx * (1 - fy) * source.data[b + 3], wc = (1 - fx) * fy * source.data[c + 3], wd = fx * fy * source.data[d + 3];
  const alpha = wa + wb + wc + wd;
  output[at + 3] = alpha;
  if (alpha > 0) for (let channel = 0; channel < 3; channel++) output[at + channel] = (source.data[a + channel] * wa + source.data[b + channel] * wb + source.data[c + channel] * wc + source.data[d + channel] * wd) / alpha;
}

/** Resize without distortion; unused canvas area remains transparent. */
export function fitImage(source: Pixels, width: number, height: number): Pixels {
  if (source.width === width && source.height === height) return source;
  const out = empty(width, height), scale = Math.min(width / source.width, height / source.height);
  const ox = (width - source.width * scale) / 2, oy = (height - source.height * scale) / 2;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) sample(source, (x + .5 - ox) / scale - .5, (y + .5 - oy) / scale - .5, out.data, (y * width + x) * 4);
  return out;
}

/** Positive angles turn clockwise. Expand the canvas to retain all four corners. */
export function rotateImage(source: Pixels, degrees: number): Pixels {
  const angle = ((degrees % 360) + 360) % 360;
  if (!angle) return source;
  const radians = angle * Math.PI / 180, cos = Math.cos(radians), sin = Math.sin(radians);
  const width = Math.ceil(Math.abs(source.width * cos) + Math.abs(source.height * sin) - 1e-8);
  const height = Math.ceil(Math.abs(source.width * sin) + Math.abs(source.height * cos) - 1e-8);
  const out = empty(width, height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const dx = x - (width - 1) / 2, dy = y - (height - 1) / 2;
    sample(source, cos * dx + sin * dy + (source.width - 1) / 2, -sin * dx + cos * dy + (source.height - 1) / 2, out.data, (y * width + x) * 4);
  }
  return out;
}

export function rotateQuadrants(grid: Pixels, angles: readonly number[]): Pixels {
  if (!angles.some(angle => angle % 360 !== 0)) return grid;
  const width = grid.width / 2, height = grid.height / 2, out = empty(grid.width, grid.height);
  for (let q = 0; q < 4; q++) {
    const ox = (q % 2) * width, oy = Math.floor(q / 2) * height, cell = empty(width, height);
    for (let y = 0; y < height; y++) { const start = ((oy + y) * grid.width + ox) * 4; cell.data.set(grid.data.subarray(start, start + width * 4), y * width * 4); }
    const rotated = fitImage(rotateImage(cell, angles[q] ?? 0), width, height);
    for (let y = 0; y < height; y++) out.data.set(rotated.data.subarray(y * width * 4, (y + 1) * width * 4), ((oy + y) * grid.width + ox) * 4);
  }
  return out;
}

export function adjustColor(source: Pixels, contrast: number, saturation: number): Pixels {
  if (!contrast && saturation === 100) return source;
  const out = empty(source.width, source.height), factor = (259 * (contrast + 255)) / (255 * (259 - contrast)), amount = saturation / 100;
  for (let i = 0; i < source.data.length; i += 4) {
    const luminance = .2126 * source.data[i] + .7152 * source.data[i + 1] + .0722 * source.data[i + 2];
    for (let c = 0; c < 3; c++) out.data[i + c] = factor * (luminance + (source.data[i + c] - luminance) * amount - 128) + 128;
    out.data[i + 3] = source.data[i + 3];
  }
  return out;
}

/** Running sums make box passes O(pixels), independent of radius. Edge pixels clamp. */
function boxPass(input: Float32Array, out: Float32Array, width: number, height: number, radius: number, vertical: boolean) {
  const lines = vertical ? width : height, length = vertical ? height : width;
  const step = vertical ? width * 4 : 4, lineStep = vertical ? 4 : width * 4, divisor = 2 * radius + 1;
  for (let line = 0; line < lines; line++) for (let c = 0; c < 4; c++) {
    const base = line * lineStep + c;
    let sum = 0;
    for (let k = -radius; k <= radius; k++) sum += input[base + Math.max(0, Math.min(length - 1, k)) * step];
    for (let i = 0; i < length; i++) {
      out[base + i * step] = sum / divisor;
      sum += input[base + Math.min(length - 1, i + radius + 1) * step] - input[base + Math.max(0, i - radius) * step];
    }
  }
}

/** Gaussian uses three variance-matched box passes, an efficient Gaussian approximation. */
export function blurImage(source: Pixels, type: 'none' | 'gaussian' | 'box', strength: number): Pixels {
  const radius = Math.max(0, Math.min(30, Math.round(strength)));
  if (type === 'none' || !radius) return source;
  let radii = [radius];
  if (type === 'gaussian') {
    const ideal = Math.sqrt(4 * radius * radius + 1);
    let lower = Math.floor(ideal); if (lower % 2 === 0) lower--;
    const upper = lower + 2;
    const count = Math.round((12 * radius * radius - 3 * lower * lower - 12 * lower - 9) / (-4 * lower - 4));
    radii = Array.from({ length: 3 }, (_, i) => ((i < count ? lower : upper) - 1) / 2);
  }
  const a = new Float32Array(source.data.length), b = new Float32Array(source.data.length);
  for (let i = 0; i < a.length; i += 4) { const alpha = source.data[i + 3] / 255; for (let c = 0; c < 3; c++) a[i + c] = source.data[i + c] * alpha; a[i + 3] = source.data[i + 3]; }
  for (const r of radii) { boxPass(a, b, source.width, source.height, r, false); boxPass(b, a, source.width, source.height, r, true); }
  const out = empty(source.width, source.height);
  for (let i = 0; i < a.length; i += 4) { const alpha = a[i + 3] / 255; for (let c = 0; c < 3; c++) out.data[i + c] = alpha ? a[i + c] / alpha : 0; out.data[i + 3] = a[i + 3]; }
  return out;
}

/** The unmirrored, unmodified source is ALWAYS the other branch of the blend. */
export function mixOriginal(result: Pixels, source: Pixels, intensity: number): Pixels {
  const mix = Math.max(0, Math.min(100, intensity)) / 100;
  if (mix === 1) return result;
  const original = fitImage(source, result.width, result.height);
  if (mix === 0) return original;
  const out = empty(result.width, result.height);
  for (let i = 0; i < out.data.length; i += 4) {
    const a = result.data[i + 3] * mix, b = original.data[i + 3] * (1 - mix), alpha = a + b;
    out.data[i + 3] = alpha;
    if (alpha) for (let c = 0; c < 3; c++) out.data[i + c] = (result.data[i + c] * a + original.data[i + c] * b) / alpha;
  }
  return out;
}
