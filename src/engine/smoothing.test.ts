import { describe, expect, it } from 'vitest';
import { smoothPixels, smoothPixelsCpu } from './smoothing';
import type { Pixels } from './filter';
const pixels = (width: number, colors: number[][]): Pixels => ({ width, height: colors.length / width, data: new Uint8ClampedArray(colors.flat()) });
const corner = pixels(3, [0, 0, 255, 0, 255, 255, 255, 255, 255].map(v => [v, v, v, 255]));
describe('emulator-inspired pixel smoothing', () => {
  it('softens stair-step corners with an adjustable strength', () => {
    expect(smoothPixelsCpu(corner, 100).data[16]).toBe(191);
    expect(smoothPixelsCpu(corner, 50).data[16]).toBe(223);
    expect(smoothPixelsCpu(corner, 0)).toBe(corner);
    expect(corner.data[16]).toBe(255);
  });
  it('preserves straight pixel edges rather than blurring the whole image', () => {
    const source = pixels(5, Array.from({ length: 25 }, (_, i) => i % 5 < 2 ? [0, 0, 0, 255] : [255, 255, 255, 255]));
    expect(smoothPixelsCpu(source, 100)).toEqual(source);
  });
  it('preserves isolated single-pixel details', () => {
    const dot = pixels(3, Array.from({ length: 9 }, (_, i) => i === 4 ? [255, 255, 255, 255] : [0, 0, 0, 255]));
    expect(smoothPixelsCpu(dot, 100)).toEqual(dot);
  });
  it('preserves uniform colors, dimensions and semitransparent alpha', () => {
    const source = pixels(2, Array.from({ length: 6 }, () => [33, 99, 155, 128]));
    expect(smoothPixelsCpu(source, 100)).toEqual(source);
    expect(smoothPixelsCpu(pixels(1, [[23, 55, 99, 255]]), 100)).toEqual(pixels(1, [[23, 55, 99, 255]]));
  });
  it('smooths transparent edges without black fringes', () => {
    const source = pixels(3, [0, 0, 255, 0, 255, 255, 255, 255, 255].map(v => v ? [255, 0, 0, 255] : [0, 0, 0, 0]));
    expect(Array.from(smoothPixelsCpu(source, 100).data.slice(16, 20))).toEqual([255, 0, 0, 191]);
  });
  it('falls back to the CPU implementation when OffscreenCanvas is unavailable', () => {
    expect(smoothPixels(corner, 100)).toEqual(smoothPixelsCpu(corner, 100));
  });
});
