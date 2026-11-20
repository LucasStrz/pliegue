import { processImage } from '../engine/filter';
import type { FilterParams, Pixels } from '../engine/filter';
import { exportSettings, validateExportSize } from '../engine/export-settings';
import { decodeOriginal } from './images';

export async function renderOriginal(url: string, width: number, height: number, preview: Pixels, params: FilterParams): Promise<Pixels> {
  const settings = exportSettings(width, height, preview.width, preview.height, params);
  validateExportSize(settings.width, settings.height, settings.params.blurType !== 'none' && settings.params.blurStrength > 0);
  const source = await decodeOriginal(url);
  let worker: Worker;
  try { worker = new Worker(new URL('../engine/filter.worker.ts', import.meta.url), { type: 'module' }); }
  catch { return processImage(source, settings.params); }
  try {
    return await new Promise<Pixels>((resolve, reject) => {
      worker.onmessage = e => { if (e.data.error) reject(new Error(e.data.error)); else resolve(e.data.result); };
      worker.onerror = () => { reject(new Error('No se pudo completar la exportación a resolución original. Prueba con una imagen menor.')); };
      worker.postMessage({ id: 1, source, params: settings.params }, [source.data.buffer]);
    });
  } finally { worker.terminate(); }
}
