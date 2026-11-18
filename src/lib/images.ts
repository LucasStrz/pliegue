import type { Pixels } from '../engine/filter';
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('No pudimos leer esta imagen. Prueba con PNG, JPEG o WebP.')); img.src = url; });
}
export async function decodeImage(url: string, sample = false): Promise<{ source: Pixels; thumbnail: string }> {
  const img = await loadImage(url);
  const sw = sample ? Math.floor(img.width / 2) : img.width, sh = sample ? Math.floor(img.height / 2) : img.height;
  // Bound the mirrored working canvas to 1800 px on the longest side.
  const ratio = Math.min(1, 900 / Math.max(sw, sh));
  const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(sw * ratio)); canvas.height = Math.max(1, Math.round(sh * ratio));
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, sw, sh, 0, 0, canvas.width, canvas.height);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { source: { width: data.width, height: data.height, data: data.data }, thumbnail: canvas.toDataURL('image/png') };
}
export function pixelsToCanvas(pixels: Pixels): HTMLCanvasElement {
  const canvas = document.createElement('canvas'); canvas.width = pixels.width; canvas.height = pixels.height;
  canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height), 0, 0);
  return canvas;
}
export function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result as string); r.onerror = () => reject(new Error('Error al leer el archivo.')); r.readAsDataURL(file); });
}
