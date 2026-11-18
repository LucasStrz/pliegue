import { useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Image as KonvaImage } from 'react-konva';
import { Minus, Plus, Maximize, Move, MousePointer2 } from 'lucide-react';
import type { Pixels } from '../engine/filter';
import { pixelsToCanvas } from '../lib/images';
interface Props { pixels: Pixels | null; busy: boolean; before: boolean; setBefore: (value: boolean) => void; onImport: () => void }
export default function Preview({ pixels, busy, before, setBefore, onImport }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 600, height: 580 });
  const [zoom, setZoom] = useState(1), [pan, setPan] = useState(false), [position, setPosition] = useState({ x: 0, y: 0 });
  const canvas = useMemo(() => pixels ? pixelsToCanvas(pixels) : null, [pixels]);
  useEffect(() => { const el = wrap.current!; const obs = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height })); obs.observe(el); return () => obs.disconnect(); }, []);
  useEffect(() => { setPosition({ x: 0, y: 0 }); }, [pixels?.width, pixels?.height, zoom]);
  const fit = pixels ? Math.min((size.width - 100) / pixels.width, (size.height - 80) / pixels.height, 1.6) : 1;
  const scale = Math.max(0.01, fit) * zoom;
  const x = pixels ? (size.width - pixels.width * scale) / 2 : 0, y = pixels ? (size.height - pixels.height * scale) / 2 : 0;
  return <section className="preview-panel" aria-label="Vista previa de imagen">
    <div className="preview-top"><div className="preview-tab"><span className="live-dot" />{before ? 'IMAGEN ORIGINAL' : 'VISTA PREVIA'}<span className="preview-live">EN VIVO</span></div><span className="preview-meta">{pixels ? `${pixels.width} × ${pixels.height} px` : 'Sin imagen'}</span></div>
    <div className="canvas-workspace" ref={wrap}>
      <div className="canvas-tools"><button className={!pan ? 'selected' : ''} aria-label="Seleccionar" title="Seleccionar" onClick={() => setPan(false)}><MousePointer2 size={17} /></button><button className={pan ? 'selected' : ''} aria-label="Mover lienzo" title="Arrastrar el lienzo" onClick={() => setPan(true)}><Move size={17} /></button><span /><button aria-label="Importar otra imagen" title="Importar otra imagen" onClick={onImport}><Plus size={18}/></button></div>
      {canvas && pixels ? <Stage width={size.width} height={size.height} x={position.x} y={position.y} draggable={pan} onDragEnd={e => setPosition({ x: e.target.x(), y: e.target.y() })} style={{ cursor: pan ? 'grab' : 'default' }}><Layer><KonvaImage image={canvas} x={x} y={y} width={pixels.width * scale} height={pixels.height * scale} shadowColor="#262620" shadowBlur={22} shadowOpacity={0.14} shadowOffsetY={8} /></Layer></Stage> : <button className="empty-canvas" onClick={onImport}><Plus size={32}/><span>Tu próxima imagen empieza aquí</span><small>Haz clic o arrastra una imagen</small></button>}
      <div className="canvas-caption"><span>FIG. 01</span><span>{before ? 'EL PUNTO DE PARTIDA' : 'UNA IMAGEN. OTRAS POSIBILIDADES.'}</span></div>
      {busy && <span className="processing" role="status"><span className="spinner"/>Procesando</span>}
    </div>
    <div className="preview-bottom"><div className="zoom-control"><button aria-label="Alejar" disabled={zoom <= 0.5} onClick={() => setZoom(z => Math.max(.5, z - .25))}><Minus size={14}/></button><span>{Math.round(zoom * 100)}%</span><button aria-label="Acercar" disabled={zoom >= 3} onClick={() => setZoom(z => Math.min(3, z + .25))}><Plus size={14}/></button><i/><button aria-label="Ajustar imagen" title="Ajustar imagen" onClick={() => { setZoom(1); setPosition({ x: 0, y: 0 }); }}><Maximize size={14}/></button></div><div className="compare-control" role="group" aria-label="Comparar antes y después"><button aria-pressed={before} className={before ? 'active' : ''} onClick={() => setBefore(true)}>Original</button><button aria-pressed={!before} className={!before ? 'active' : ''} onClick={() => setBefore(false)}>Resultado</button></div><span className="preview-bottom-label">{before ? 'ANTES' : 'DESPUÉS'}</span></div>
  </section>;
}
