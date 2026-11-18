import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowLeftRight, ArrowRight, ArrowUpRight, Check, ChevronDown, CircleHelp, FileImage, FolderOpen, Grid2X2, Layers2, LoaderCircle, Plus, RotateCcw, ShieldCheck, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import Preview from './components/Preview';
import Parameter from './components/Parameter';
import { useEditor } from './store';
import { defaults } from './engine/filter';
import type { Pixels } from './engine/filter';
import { decodeImage, pixelsToCanvas, readFile } from './lib/images';
import { restoreProject, saveProject } from './lib/storage';
import { useProcessor } from './hooks/useProcessor';
interface Asset { id: string; name: string; thumbnail: string; source: Pixels }
const presets = [{ name: 'Entrelazado', width: 8, passes: 2 }, { name: 'Fragmentos', width: 32, passes: 2 }, { name: 'Trama fina', width: 2, passes: 4 }];
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) { return <button type="button" role="switch" aria-label={label} aria-checked={checked} className={`toggle ${checked ? 'on' : ''}`} onClick={onChange}><span/></button>; }
export default function App() {
  const { params, setParam, setParams, before, setBefore, reset } = useEditor();
  const [assets, setAssets] = useState<Asset[]>([]), [activeId, setActiveId] = useState('');
  const [message, setMessage] = useState(''), [error, setError] = useState(''), [help, setHelp] = useState(false), [drag, setDrag] = useState(false), [loading, setLoading] = useState(true), [saveStatus, setSaveStatus] = useState('Preparando estudio'), [exporting, setExporting] = useState(false), [format, setFormat] = useState('png');
  const [presetName, setPresetName] = useState('Entrelazado');
  const input = useRef<HTMLInputElement>(null), importGeneration = useRef(0);
  const asset = assets.find(a => a.id === activeId) ?? assets[0];
  const { result, busy, error: processError } = useProcessor(asset?.source ?? null, params);
  const importUrl = useCallback(async (url: string, name: string, sample = false) => { const decoded = await decodeImage(url, sample); return { id: crypto.randomUUID(), name, ...decoded }; }, []);
  useEffect(() => {
    let cancelled = false;
    const generation = importGeneration.current;
    (async () => {
      let saved;
      try { saved = await restoreProject(); } catch { if (!cancelled) setSaveStatus('Guardado local no disponible'); }
      try {
        const item = saved ? await importUrl(saved.image, saved.name) : await importUrl('/estudio.svg', 'Estudio 01.png');
        if (cancelled || generation !== importGeneration.current) return;
        setAssets([item]); setActiveId(item.id); if (saved) setParams({ ...defaults, ...saved.params });
      } catch (e) { if (!cancelled) setError(String(e)); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [importUrl, setParams]);
  useEffect(() => {
    if (!asset) return;
    setSaveStatus('Guardando cambios…');
    const timer = window.setTimeout(() => { saveProject({ name: asset.name, image: asset.thumbnail, params }).then(() => setSaveStatus('Guardado en este navegador')).catch(() => setSaveStatus('No se pudo guardar localmente')); }, 650);
    return () => window.clearTimeout(timer);
  }, [asset, params]);
  useEffect(() => { if (!message) return; const t = setTimeout(() => setMessage(''), 3500); return () => clearTimeout(t); }, [message]);
  useEffect(() => { if (!help) return; const listener = (e: KeyboardEvent) => { if (e.key === 'Escape') setHelp(false); }; window.addEventListener('keydown', listener); return () => window.removeEventListener('keydown', listener); }, [help]);
  async function importFiles(files: FileList | File[]) {
    importGeneration.current++; setLoading(true); setError('');
    try {
      const imported: Asset[] = []; const failures: string[] = [];
      for (const file of Array.from(files)) {
        if (!/^image\/(png|jpeg|webp|gif|bmp|avif)$/.test(file.type)) { failures.push(`${file.name}: formato no compatible`); continue; }
        if (file.size > 30 * 1024 * 1024) { failures.push(`${file.name}: supera los 30 MB`); continue; }
        try { imported.push(await importUrl(await readFile(file), file.name)); } catch { failures.push(`${file.name}: no se pudo leer`); }
      }
      if (imported.length) { setAssets(a => [...a, ...imported].slice(-12)); setActiveId(imported[imported.length - 1].id); setBefore(false); setMessage(`${imported.length === 1 ? 'Imagen lista' : `${imported.length} imágenes listas`} para experimentar`); }
      if (failures.length) setError(failures.join(' · '));
    } finally { setLoading(false); if (input.current) input.current.value = ''; }
  }
  async function exportImage() {
    if (!result || busy || !asset) return;
    setExporting(true);
    try {
      const canvas = pixelsToCanvas(result);
      if (format === 'jpeg') { const ctx = canvas.getContext('2d')!; ctx.globalCompositeOperation = 'destination-over'; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, `image/${format}`, .95));
      if (!blob) throw new Error('No se pudo generar el archivo.');
      const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `${asset.name.replace(/\.[^.]+$/, '')}-pliegue.${format === 'jpeg' ? 'jpg' : 'png'}`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); setMessage('Tu collage está listo. Descarga iniciada.');
    } catch (e) { setError(String(e)); } finally { setExporting(false); }
  }
  const custom = () => setPresetName('Personalizado');
  const setNumber = (key: 'stripWidth' | 'iterations' | 'mix' | 'contrast', value: number) => { custom(); setParam(key, value); };
  return <div className={`app ${drag ? 'is-dragging' : ''}`} onDragOver={e => { e.preventDefault(); if (e.dataTransfer.types.includes('Files')) setDrag(true); }} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrag(false); }} onDrop={e => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files.length) void importFiles(e.dataTransfer.files); }}>
    <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,image/avif" multiple className="hidden" onChange={e => { if (e.target.files) void importFiles(e.target.files); }}/>
    <header className="app-header"><a className="brand" href="#" aria-label="Pliegue, inicio"><span className="brand-symbol"><i/><i/><i/><i/></span>pliegue<span className="brand-period">.</span></a><span className="header-divider"/><span className="header-description">LABORATORIO DE IMAGEN</span><div className="header-right"><span className="local-badge"><span/>100% local</span><button className="help-button" aria-label="Cómo funciona" onClick={() => setHelp(true)}><CircleHelp size={18}/></button><button className="import-button" onClick={() => input.current?.click()} disabled={loading}><Plus size={16}/><span>Importar imagen</span></button></div></header>
    <main>
      <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line"/>ESTUDIO DIGITAL / 001</div><h1>Otra forma de <span>ver.</span></h1><p>Corta, refleja, reordena. Deja que la imagen te sorprenda.</p></div><div className="heading-note"><span className="note-cross">✳</span><span>Un pequeño cambio.<br/>Una nueva posibilidad.</span></div></div>
      <div className="editor-layout"><div className="left-column"><Preview pixels={before ? asset?.source ?? null : result} busy={busy || loading} before={before} setBefore={setBefore} onImport={() => input.current?.click()}/>
        <div className="source-strip"><div className="source-label"><Layers2 size={15}/><span>TUS IMÁGENES</span><span className="asset-count">{String(assets.length).padStart(2, '0')}</span></div><div className="assets">{assets.map(a => <button key={a.id} aria-label={`Seleccionar ${a.name}`} aria-pressed={a.id === asset?.id} title={a.name} className={`asset ${a.id === asset?.id ? 'active' : ''}`} onClick={() => { setActiveId(a.id); setBefore(false); }}><img src={a.thumbnail} alt={a.name}/>{a.id === asset?.id && <span><Check size={9}/></span>}</button>)}<button className="add-asset" aria-label="Añadir imágenes" onClick={() => input.current?.click()}><Plus size={19}/></button></div><div className="asset-description"><span>{asset?.name ?? 'Importa tu primera imagen'}</span><small>{asset ? `${asset.source.width} × ${asset.source.height} px · imagen de origen` : 'PNG, JPG, WEBP · Hasta 30 MB'}</small></div></div>
      </div><aside className="controls-panel" aria-label="Parámetros del filtro"><div className="controls-heading"><div><SlidersHorizontal size={15}/><span>EL PROCESO</span></div><button aria-label="Restablecer parámetros" title="Restablecer parámetros" onClick={() => { reset(); setPresetName('Entrelazado'); }}><RotateCcw size={15}/></button></div>
        <div className="controls-scroll"><div className="filter-intro"><div className="filter-icon"><span/><span/><span/><span/></div><div><h2>Entrelazado</h2><p>Del fragmento a la composición.</p></div><span className="filter-number">01</span></div>
        <div className="preset-field"><label htmlFor="preset">Punto de partida</label><div className="select-wrap"><select id="preset" value={presetName} onChange={e => { const p = presets.find(p => p.name === e.target.value); if (p) { setParams({ ...defaults, stripWidth: p.width, iterations: p.passes }); setPresetName(p.name); setBefore(false); } }}><option value="Personalizado" disabled>Personalizado</option>{presets.map(p => <option key={p.name}>{p.name}</option>)}</select><ChevronDown size={14}/></div></div>
        <section className="process-section"><div className="section-title"><span className="step-number">01</span><h3>Reflejar</h3><Toggle label="Activar espejo 2 por 2" checked={params.mirror} onChange={() => { custom(); setParam('mirror', !params.mirror); }}/></div><p className="section-description">Un reflejo lateral y otro vertical.<br/>Cuatro encuentros de la misma imagen.</p><div className={`mirror-diagram ${!params.mirror ? 'off' : ''}`} aria-label="Diagrama de espejo 2 por 2"><span>R</span><span>R</span><span>R</span><span>R</span><i>2 × 2</i></div></section>
        <section className="process-section cuts-section"><div className="section-title"><span className="step-number">02</span><h3>Cortar y reordenar</h3><ArrowLeftRight size={15}/></div><p className="section-description">De los extremos al centro, en nuevas líneas.</p><Parameter label="Grosor de las tiras" min={1} max={96} value={params.stripWidth} unit="px" onChange={v => setNumber('stripWidth', v)}/><Parameter label="Repeticiones" min={1} max={12} value={params.iterations} unit="×" onChange={v => setNumber('iterations', v)} hint="Cada pasada vuelve a cortar la imagen resultante."/>
          <div className="direction-control"><span>Empezar desde</span><div><button className={!params.reverse ? 'active' : ''} aria-pressed={!params.reverse} onClick={() => { custom(); setParam('reverse', false); }}>Izquierda</button><button className={params.reverse ? 'active' : ''} aria-pressed={params.reverse} onClick={() => { custom(); setParam('reverse', true); }}>Derecha</button></div></div><div className="switch-row"><span>Giro horario de las tiras</span><Toggle label="Giro horario de las tiras" checked={params.clockwise} onChange={() => { custom(); setParam('clockwise', !params.clockwise); }}/></div>
        </section>
        <section className="process-section finish-section"><div className="section-title"><span className="step-number">03</span><h3>Dar el toque final</h3><Sparkles size={14}/></div><Parameter label="Intensidad" min={0} max={100} value={params.mix} unit="%" onChange={v => setNumber('mix', v)}/><Parameter label="Contraste" min={-100} max={100} value={params.contrast} onChange={v => setNumber('contrast', v)}/></section></div>
        <div className="export-area"><div className="export-info"><span>Tu composición, lista para salir.</span><label className="export-format"><select aria-label="Formato de exportación" value={format} onChange={e => setFormat(e.target.value)}><option value="png">PNG</option><option value="jpeg">JPG</option></select><ChevronDown size={11}/></label></div><button className="export-button" disabled={!result || busy || exporting || loading} onClick={() => void exportImage()}>{exporting ? <LoaderCircle size={16} className="spin"/> : <ArrowDownToLine size={16}/>}<span>{exporting ? 'Preparando…' : 'Exportar imagen'}</span><ArrowUpRight size={17}/></button><div className="privacy-note"><ShieldCheck size={12}/><span>Tus imágenes se quedan contigo.</span></div></div>
      </aside></div>
      <div className="workflow-note"><span className="note-marker">↳</span><p>El orden cambia la imagen.<span> Explora el proceso, encuentra lo inesperado.</span></p><button onClick={() => setHelp(true)}>Cómo funciona <ArrowRight size={13}/></button></div>
    </main><footer><span>PLIEGUE © 2026</span><span><span className="status-dot"/>{saveStatus}</span><span>HECHO PARA EXPERIMENTAR <span className="footer-star">✳</span></span></footer>
    {(error || processError) && <div className="error-toast" role="alert"><span>{error || processError}</span><button aria-label="Cerrar error" onClick={() => setError('')}><X size={16}/></button></div>}{message && <div className="toast" role="status"><Check size={15}/>{message}</div>}
    {drag && <div className="drop-overlay"><FileImage size={44}/><h2>Suelta una nueva posibilidad.</h2><p>PNG, JPG o WebP · Hasta 30 MB por imagen</p></div>}
    {help && <div className="modal-backdrop" onClick={() => setHelp(false)}><section className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={e => e.stopPropagation()}><button className="modal-close" autoFocus aria-label="Cerrar ayuda" onClick={() => setHelp(false)}><X size={20}/></button><div className="eyebrow">DETRÁS DEL PROCESO</div><h2 id="help-title">Deconstruir para crear.</h2><p>Entrelazado transforma tu imagen en una composición nueva, píxel a píxel.</p><ol><li><Grid2X2 size={22}/><div><strong>Reflejar</strong><p>Duplicamos la imagen a la derecha en espejo y reflejamos ambas hacia abajo para formar una cuadrícula 2×2.</p></div></li><li><ArrowLeftRight size={22}/><div><strong>Cortar y apilar</strong><p>Tomamos una tira vertical de la izquierda, luego una de la derecha y seguimos alternando hacia el centro. Giramos cada tira 90° y las apilamos de arriba abajo. La última tira conserva sus píxeles aunque sea más estrecha.</p></div></li><li><RotateCcw size={22}/><div><strong>Volver a empezar</strong><p>Cada repetición aplica el mismo proceso al resultado anterior. Las pasadas impares intercambian ancho y alto; las pares recuperan la orientación inicial.</p></div></li></ol><div className="help-foot"><ShieldCheck size={17}/><p>Todo sucede en tu navegador. El último proyecto se guarda en IndexedDB. Para mantener una edición fluida, la imagen de origen se ajusta a un máximo de 900 px por lado; el espejo alcanza hasta 1800 px. La exportación utiliza esa resolución. Puedes importar varias imágenes y trabajar con una a la vez.</p></div><button className="export-button" onClick={() => setHelp(false)}>Volver al estudio <ArrowRight size={16}/></button></section></div>}
  </div>;
}
