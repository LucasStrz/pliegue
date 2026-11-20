import type { FilterParams } from './filter';

/** Pixel controls use proxy pixels. Scale them to preserve their relative visual size. */
export function exportSettings(width: number, height: number, previewWidth: number, previewHeight: number, params: FilterParams) {
  const scale = Math.max(width, height) / Math.max(previewWidth, previewHeight);
  const settings = { ...params, stripWidth: Math.max(1, Math.round(params.stripWidth * scale)), blurStrength: Math.max(0, Math.round(params.blurStrength * scale)) };
  const w = Math.ceil(width * 2 / settings.stripWidth) * settings.stripWidth;
  const h = Math.ceil(height * 2 / settings.stripWidth) * settings.stripWidth;
  return { params: settings, width: params.iterations % 2 ? h : w, height: params.iterations % 2 ? w : h };
}

/** Fail explicitly instead of silently reducing an export that exceeds safe working limits. */
export function validateExportSize(width: number, height: number, blur: boolean) {
  const pixels = width * height;
  if (Math.max(width, height) > 32767 || pixels > 64_000_000 || pixels * (blur ? 56 : 24) > 2_000_000_000) {
    throw new Error('La exportación a resolución original excede la memoria de trabajo disponible para este tamaño. Usa una imagen menor o desactiva el blur; no se ha reducido la resolución automáticamente.');
  }
}
