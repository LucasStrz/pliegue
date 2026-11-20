import { describe, expect, it } from 'vitest';
import { defaults } from './filter';
import { exportSettings, validateExportSize } from './export-settings';
describe('native export settings', () => {
  it('keeps small original dimensions and settings unchanged', () => {
    const result = exportSettings(480, 640, 480, 640, defaults);
    expect([result.width, result.height]).toEqual([960, 1280]); expect(result.params).toEqual(defaults);
  });
  it('scales pixel effects and pads the doubled native dimensions', () => {
    const result = exportSettings(4000, 3000, 900, 675, { ...defaults, blurStrength: 10 });
    expect(result.params.stripWidth).toBe(36); expect(result.params.blurStrength).toBe(44);
    expect([result.width, result.height]).toEqual([8028, 6012]);
    expect(() => validateExportSize(result.width, result.height, false)).not.toThrow();
    expect(defaults.stripWidth).toBe(8);
  });
  it('swaps dimensions for odd passes without reducing native resolution', () => {
    const result = exportSettings(1800, 1200, 900, 600, { ...defaults, iterations: 3 });
    expect([result.width, result.height]).toEqual([2400, 3600]);
  });
  it('rejects unsafe native exports instead of downsampling silently', () => {
    expect(() => validateExportSize(16000, 12000, false)).toThrow(/memoria/);
    expect(() => validateExportSize(8000, 6000, true)).toThrow(/memoria/);
  });
});
