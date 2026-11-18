import { useEffect, useRef } from 'react';
import type { Pixels } from '../engine/filter';
interface Props { pixels: Pixels | null; busy: boolean; before: boolean; setBefore: (value: boolean) => void; onImport: () => void }
export default function Preview({ pixels, busy, before, setBefore, onImport }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!pixels || !canvas.current) return;
    canvas.current.width = pixels.width; canvas.current.height = pixels.height;
    canvas.current.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height), 0, 0);
  }, [pixels]);
  return <section className="preview" aria-label="Vista previa de imagen" aria-busy={busy}>
    <div className="image-space">{pixels ? <canvas ref={canvas} role="img" aria-label={before ? 'Imagen original' : 'Imagen procesada'} /> : <button onClick={onImport}>Abrir imagen</button>}</div>
    <div className="compare" role="group" aria-label="Comparar antes y después"><span>Antes</span><input type="checkbox" role="switch" aria-label="Ver resultado" checked={!before} onChange={e => setBefore(!e.target.checked)} /><span>Después</span></div>
  </section>;
}
