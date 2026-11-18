import { describe, it, expect } from 'vitest';
import { defaults, mirrorGrid, processImage, weave } from './filter';
import type { Pixels } from './filter';
const fixture = (width: number, height: number): Pixels => ({ width, height, data: new Uint8ClampedArray(Array.from({ length: width * height }, (_, i) => [i + 1, (i + 1) * 2, 0, i % 2 ? 128 : 255]).flat()) });
const values = (p: Pixels) => Array.from({ length: p.width * p.height }, (_, i) => p.data[i * 4]);
describe('mirroring and strip recomposition', () => {
  it('reflects both axes with the source at top left', () => {
    const out = mirrorGrid(fixture(2, 2));
    expect([out.width, out.height]).toEqual([4, 4]);
    expect(values(out)).toEqual([1, 2, 2, 1, 3, 4, 4, 3, 3, 4, 4, 3, 1, 2, 2, 1]);
  });
  it('alternates left, right, next left, next right and rotates clockwise', () => {
    const out = weave(fixture(4, 2), 1);
    expect([out.width, out.height]).toEqual([2, 4]);
    expect(values(out)).toEqual([5, 1, 8, 4, 6, 2, 7, 3]);
  });
  it('supports right-first and counterclockwise rotation', () => {
    expect(values(weave(fixture(4, 2), 1, true, false))).toEqual([4, 8, 1, 5, 3, 7, 2, 6]);
  });
  it('preserves every RGBA pixel for partial strips and repeated passes', () => {
    const source = fixture(7, 5);
    const pixels = (p: Pixels) => Array.from({ length: p.data.length / 4 }, (_, i) => Array.from(p.data.slice(i * 4, i * 4 + 4)).join(',')).sort();
    for (const width of [1, 2, 3, 5, 7, 96]) for (const reverse of [true, false]) for (const clockwise of [true, false]) {
      let out = source;
      for (let pass = 0; pass < 4; pass++) { out = weave(out, width, reverse, clockwise); expect(pixels(out)).toEqual(pixels(source)); }
      expect([out.width, out.height]).toEqual([7, 5]);
    }
  });
  it('returns the unprocessed mirrored grid at zero intensity without mutating source', () => {
    const source = fixture(3, 2), copy = source.data.slice();
    const out = processImage(source, { ...defaults, stripWidth: 1, mix: 0 });
    expect(out).toEqual(mirrorGrid(source)); expect(source.data).toEqual(copy);
  });
  it('can bypass mirroring and transposes odd passes', () => {
    const out = processImage(fixture(5, 3), { ...defaults, mirror: false, iterations: 3 });
    expect([out.width, out.height]).toEqual([3, 5]); expect(out.data.length).toBe(60);
  });
});
