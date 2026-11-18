/// <reference lib="webworker" />
import { processImage } from './filter';
import type { Pixels, FilterParams } from './filter';
self.onmessage = (event: MessageEvent<{ id: number; source: Pixels; params: FilterParams }>) => {
  const { id, source, params } = event.data;
  try {
    const result = processImage(source, params);
    self.postMessage({ id, result }, { transfer: [result.data.buffer] });
  } catch (error) { self.postMessage({ id, error: String(error) }); }
};
