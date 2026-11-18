import { describe, expect, it } from 'vitest';
import { adjustColor, blurImage, fitImage, mixOriginal, rotateImage, rotateQuadrants } from './effects';
import { defaults, mirrorGrid, processImage } from './filter';
import type { Pixels } from './filter';
const rgba = (width: number, height: number, values: number[][]): Pixels => ({ width, height, data: new Uint8ClampedArray(values.flat()) });
const reds = (p: Pixels) => Array.from({ length: p.width * p.height }, (_, i) => p.data[i * 4]);
describe('rotation, color, blur and original blending', () => {
  const asymmetric = rgba(2, 3, [1, 2, 3, 4, 5, 6].map(n => [n, n, n, 255]));
  it('rotates quarter turns exactly and swaps rectangular dimensions', () => {
    const cw = rotateImage(asymmetric, 90);
    expect([cw.width, cw.height]).toEqual([3, 2]);
    expect(reds(cw)).toEqual([5, 3, 1, 6, 4, 2]);
    expect(reds(rotateImage(asymmetric, -90))).toEqual([2, 4, 6, 1, 3, 5]);
    expect(reds(rotateImage(asymmetric, 180))).toEqual([6, 5, 4, 3, 2, 1]);
    expect(rotateImage(asymmetric, 360)).toBe(asymmetric);
  });
  it('expands arbitrary rotations and leaves corners transparent', () => {
    const out = rotateImage(asymmetric, 45);
    expect([out.width, out.height]).toEqual([4, 4]); expect(out.data[3]).toBe(0);
  });
  it('rotates each quadrant independently before strip processing', () => {
    const grid = mirrorGrid(rgba(2, 2, [1, 2, 3, 4].map(n => [n, n, n, 255])));
    const out = rotateQuadrants(grid, [90, 0, 0, 0]);
    expect(reds(out)).toEqual([3, 1, 2, 1, 4, 2, 4, 3, 3, 4, 4, 3, 1, 2, 2, 1]);
    expect(reds(grid)).toEqual([1, 2, 2, 1, 3, 4, 4, 3, 3, 4, 4, 3, 1, 2, 2, 1]);
  });
  it('fits non-square quadrants and originals without stretching or cropping', () => {
    const out = fitImage(asymmetric, 6, 6);
    expect(out.data[3]).toBe(0); expect(out.data[(2 * 6 + 2) * 4 + 3]).toBe(255);
    const grid = rotateQuadrants(mirrorGrid(asymmetric), [90, 270, 180, 0]);
    expect([grid.width, grid.height]).toEqual([4, 6]);
  });
  it('desaturates with luminance weights and preserves alpha', () => {
    const source = rgba(1, 1, [[255, 0, 0, 128]]);
    expect(Array.from(adjustColor(source, 0, 0).data)).toEqual([54, 54, 54, 128]);
    expect(adjustColor(source, 0, 100)).toBe(source);
  });
  for (const type of ['box', 'gaussian'] as const) {
    it(`${type} preserves a uniform image, including semitransparent pixels`, () => {
      const source = rgba(3, 2, Array.from({ length: 6 }, () => [33, 99, 155, 128]));
      expect(blurImage(source, type, 12)).toEqual(source); expect(blurImage(source, type, 0)).toBe(source);
    });
    it(`${type} blurs in premultiplied alpha without dark fringes`, () => {
      const source = rgba(3, 1, [[255, 0, 0, 255], [0, 0, 0, 0], [0, 0, 0, 0]]);
      const out = blurImage(source, type, 1);
      expect(out.data[4]).toBe(255); expect(out.data[7]).toBeGreaterThan(0); expect(out.data[7]).toBeLessThan(255);
      expect(source.data[7]).toBe(0);
    });
  }
  it('box has the expected impulse kernel and differs from gaussian', () => {
    const source = rgba(9, 1, Array.from({ length: 9 }, (_, i) => [i === 4 ? 255 : 0, 0, 0, 255]));
    expect(reds(blurImage(source, 'box', 1))).toEqual([0, 0, 0, 85, 85, 85, 0, 0, 0]);
    expect(blurImage(source, 'gaussian', 2).data).not.toEqual(blurImage(source, 'box', 2).data);
  });
  it('mixes original and result using premultiplied alpha', () => {
    const original = rgba(1, 1, [[0, 0, 255, 255]]), result = rgba(1, 1, [[255, 0, 0, 255]]);
    expect(Array.from(mixOriginal(result, original, 50).data)).toEqual([128, 0, 128, 255]);
    expect(mixOriginal(result, original, 0)).toBe(original); expect(mixOriginal(result, original, 100)).toBe(result);
    expect(Array.from(mixOriginal(result, rgba(1, 1, [[0, 0, 0, 0]]), 50).data)).toEqual([255, 0, 0, 128]);
  });
  it('zero intensity bypasses all effects on the original branch', () => {
    const out = processImage(asymmetric, { ...defaults, mix: 0, saturation: 0, contrast: 70, blurType: 'gaussian', blurStrength: 8, rotation: 90, quadrantRotations: [90, 0, 270, 180] });
    expect(out).toEqual(fitImage(asymmetric, out.width, out.height));
  });
});
