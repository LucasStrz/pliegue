import { useEffect, useRef, useState } from 'react';
import { processImage } from '../engine/filter';
import type { Pixels, FilterParams } from '../engine/filter';
export function useProcessor(source: Pixels | null, params: FilterParams) {
  const [result, setResult] = useState<Pixels | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const worker = useRef<Worker | null>(null), generation = useRef(0);
  useEffect(() => {
    try { worker.current = new Worker(new URL('../engine/filter.worker.ts', import.meta.url), { type: 'module' }); } catch { worker.current = null; }
    return () => { worker.current?.terminate(); worker.current = null; };
  }, []);
  useEffect(() => {
    if (!source) return;
    const id = ++generation.current;
    setBusy(true); setError('');
    const fallback = () => {
      try { const output = processImage(source, params); if (generation.current === id) { setResult(output); setBusy(false); } }
      catch (e) { if (generation.current === id) { setError(String(e)); setBusy(false); } }
    };
    // Debounce bursts of pointer input; worker results from older requests are ignored.
    const timer = window.setTimeout(() => {
      if (worker.current) {
        const active = worker.current;
        active.onmessage = e => { if (e.data.id !== generation.current) return; if (e.data.error) setError(e.data.error); else setResult(e.data.result); setBusy(false); };
        active.onerror = () => { active.terminate(); worker.current = null; fallback(); };
        active.postMessage({ id, source, params });
      } else fallback();
    }, 55);
    return () => window.clearTimeout(timer);
  }, [source, params]);
  return { result, busy, error };
}
