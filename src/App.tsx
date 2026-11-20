import { useCallback, useEffect, useRef, useState } from 'react';
import Preview from './components/Preview';
import Parameter from './components/Parameter';
import { useEditor } from './store';
import { defaults } from './engine/filter';
import type { Pixels } from './engine/filter';
import { decodeImage, pixelsToCanvas, readFile } from './lib/images';
import { restoreProject, saveProject } from './lib/storage';
import { useProcessor } from './hooks/useProcessor';
import { PIXEL_SMOOTH_ENABLED } from './config/features';
import { renderOriginal } from './lib/export';
interface Asset { id: string; name: string; thumbnail: string; source: Pixels; isDemo: boolean; originalUrl: string; originalWidth: number; originalHeight: number }
const presets = [{ name: 'Entrelazado', width: 8, passes: 2 }, { name: 'Fragmentos', width: 32, passes: 2 }, { name: 'Trama fina', width: 2, passes: 4 }];
export default function App() {
  const { params, setParam, setParams, before, setBefore, reset } = useEditor();
  const [assets, setAssets] = useState<Asset[]>([]), [activeId, setActiveId] = useState('');
  const [message, setMessage] = useState(''), [error, setError] = useState(''), [drag, setDrag] = useState(false), [loading, setLoading] = useState(true), [saveStatus, setSaveStatus] = useState('Preparando estudio'), [exporting, setExporting] = useState(false), [format, setFormat] = useState('png');
  const [presetName, setPresetName] = useState('Entrelazado');
  const input = useRef<HTMLInputElement>(null), importGeneration = useRef(0);
  const demo = useRef<Asset | null>(null);
  const asset = assets.find(a => a.id === activeId) ?? assets[0];
  const { result, busy, error: processError } = useProcessor(asset?.source ?? null, params);
  const importUrl = useCallback(async (url: string, name: string, isDemo = false) => { const decoded = await decodeImage(url); return { id: crypto.randomUUID(), name, isDemo, originalUrl: url, ...decoded }; }, []);
  const loadDemo = useCallback(async () => {
    if (!demo.current) demo.current = await importUrl('/entrelazado.jpg', 'Entrelazado.jpg', true);
    return demo.current;
  }, [importUrl]);
  useEffect(() => {
    let cancelled = false;
    const generation = importGeneration.current;
    (async () => {
      let saved;
      try { saved = await restoreProject(); } catch { if (!cancelled) setSaveStatus('Guardado local no disponible'); }
      try {
        const isSavedDemo = saved?.isDemo === true || (saved?.isDemo === undefined && saved?.name === 'Estudio 01.png');
        const item = saved && !isSavedDemo ? await importUrl(saved.originalImage ?? saved.image, saved.name) : await loadDemo();
        if (cancelled || generation !== importGeneration.current) return;
        setAssets([item]); setActiveId(item.id); if (saved) setParams({ ...defaults, ...saved.params, clockwise: saved.uiVersion === 2 ? saved.params.clockwise : false });
      } catch (e) { if (!cancelled) setError(String(e)); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [importUrl, loadDemo, setParams]);
  useEffect(() => {
    if (!asset) return;
    setSaveStatus('Guardando cambios…');
    const timer = window.setTimeout(() => { saveProject({ name: asset.name, image: asset.thumbnail, originalImage: asset.originalUrl, params, uiVersion: 2, isDemo: asset.isDemo }).then(() => setSaveStatus('Guardado en este navegador')).catch(() => setSaveStatus('No se pudo guardar localmente')); }, 650);
    return () => window.clearTimeout(timer);
  }, [asset, params]);
  useEffect(() => { if (!message) return; const t = setTimeout(() => setMessage(''), 3500); return () => clearTimeout(t); }, [message]);
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
  async function removeSelectedImage() {
    if (!asset || asset.isDemo || loading) return;
    setLoading(true); setError('');
    try {
      const index = assets.findIndex(item => item.id === asset.id);
      const remaining = assets.filter(item => item.id !== asset.id);
      const next = remaining[Math.min(index, remaining.length - 1)] ?? await loadDemo();
      setAssets(remaining.length ? remaining : [next]); setActiveId(next.id); setBefore(false);
      try {
        await saveProject({ name: next.name, image: next.thumbnail, originalImage: next.originalUrl, params, uiVersion: 2, isDemo: next.isDemo });
        setSaveStatus('Guardado en este navegador');
      } catch { setSaveStatus('No se pudo guardar localmente'); setError('Imagen retirada de la sesión. No se pudo actualizar el guardado local.'); }
      setMessage('Imagen eliminada de la sesión');
    } catch (e) { setError(String(e)); } finally { setLoading(false); }
  }
  async function exportImage() {
    if (!result || busy || !asset || exporting) return;
    const exportFormat = format;
    setExporting(true);
    try {
      const fullResult = await renderOriginal(asset.originalUrl, asset.originalWidth, asset.originalHeight, asset.source, params);
      const canvas = pixelsToCanvas(fullResult);
      if (exportFormat === 'jpeg') { const ctx = canvas.getContext('2d')!; ctx.globalCompositeOperation = 'destination-over'; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, `image/${exportFormat}`, .95));
      canvas.width = 0; canvas.height = 0;
      if (!blob) throw new Error('No se pudo generar el archivo.');
      const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `${asset.name.replace(/\.[^.]+$/, '')}-pliegue.${exportFormat === 'jpeg' ? 'jpg' : 'png'}`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); setMessage('Tu collage a resolución original está listo. Descarga iniciada.');
    } catch (e) { setError(String(e)); } finally { setExporting(false); }
  }
  const custom = () => setPresetName('Personalizado');
  const setNumber = (key: 'stripWidth' | 'iterations' | 'mix' | 'contrast' | 'saturation' | 'blurStrength' | 'smoothingStrength', value: number) => { custom(); setParam(key, value); };
  return <div className="app" onDragOver={e => { e.preventDefault(); if (e.dataTransfer.types.includes('Files')) setDrag(true); }} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrag(false); }} onDrop={e => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files.length) void importFiles(e.dataTransfer.files); }}>
    <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,image/avif" multiple hidden onChange={e => { if (e.target.files) void importFiles(e.target.files); }}/>
    <header><a href="#" className="brand" aria-label="Pliegue, inicio">pliegue</a><button disabled={loading} onClick={() => input.current?.click()}>Importar imagen</button></header>
    <main className="editor">
      <div className="image-column"><Preview pixels={before ? asset?.source ?? null : result} busy={busy || loading} before={before} setBefore={setBefore} onImport={() => input.current?.click()}/>
        {assets.length > 1 && <div className="assets">{assets.map(a => <button key={a.id} aria-label={'Seleccionar ' + a.name} aria-pressed={a.id === asset?.id} title={a.name} className={a.id === asset?.id ? 'active' : ''} onClick={() => { setActiveId(a.id); setBefore(false); }}><img src={a.thumbnail} alt={a.name}/></button>)}</div>}
        {asset && !asset.isDemo && <div className="remove-image"><button disabled={loading} onClick={() => void removeSelectedImage()}>Eliminar imagen seleccionada</button></div>}
      </div>
      <aside aria-label="Parámetros del filtro">
        <select aria-label="Preajuste" value={presetName} onChange={e => { const p = presets.find(p => p.name === e.target.value); if (p) { setParams({ ...defaults, stripWidth: p.width, iterations: p.passes }); setPresetName(p.name); setBefore(false); } }}><option value="Personalizado" disabled>Personalizado</option>{presets.map(p => <option key={p.name}>{p.name}</option>)}</select>
        <Parameter label="Grosor de las tiras" min={1} max={96} value={params.stripWidth} unit="px" onChange={v => setNumber('stripWidth', v)}/>
        <Parameter label="Repeticiones" min={1} max={12} value={params.iterations} unit="×" onChange={v => setNumber('iterations', v)}/>
        <div className="select-row"><label htmlFor="start">Inicio</label><select id="start" value={params.reverse ? 'right' : 'left'} onChange={e => { custom(); setParam('reverse', e.target.value === 'right'); }}><option value="left">Izquierda</option><option value="right">Derecha</option></select></div>
        <div className="select-row"><label htmlFor="rotation">Giro</label><select id="rotation" value={params.clockwise ? 'cw' : 'ccw'} onChange={e => { custom(); setParam('clockwise', e.target.value === 'cw'); }}><option value="ccw">Antihorario</option><option value="cw">Horario</option></select></div>
        <div className="quadrants"><span>Giro de cuadrantes</span><div>{params.quadrantRotations.map((angle, i) => <select key={i} aria-label={'Giro cuadrante ' + (i + 1)} title={['Superior izquierdo', 'Superior derecho', 'Inferior izquierdo', 'Inferior derecho'][i]} value={angle} onChange={e => { custom(); const angles = [...params.quadrantRotations] as [number, number, number, number]; angles[i] = Number(e.target.value); setParam('quadrantRotations', angles); }}>{[0, 90, 180, 270].map(value => <option key={value} value={value}>{value}°</option>)}</select>)}</div></div>
        <Parameter label="Contraste" min={-100} max={100} value={params.contrast} onChange={v => setNumber('contrast', v)}/>
        <Parameter label="Saturación" min={0} max={200} value={params.saturation} unit="%" onChange={v => setNumber('saturation', v)}/>
        {PIXEL_SMOOTH_ENABLED && <><div className="select-row"><label htmlFor="shader">Shader</label><select id="shader" value={params.smoothing ? 'pixel' : 'none'} onChange={e => { custom(); setParam('smoothing', e.target.value === 'pixel'); }}><option value="none">Ninguno</option><option value="pixel">Pixel smooth</option></select></div>
        {params.smoothing && <Parameter label="Suavizado" min={0} max={100} value={params.smoothingStrength} unit="%" onChange={v => setNumber('smoothingStrength', v)}/>}</>}
        <div className="select-row"><label htmlFor="blur">Blur</label><select id="blur" value={params.blurType} onChange={e => { custom(); setParam('blurType', e.target.value as typeof params.blurType); }}><option value="none">Ninguno</option><option value="gaussian">Gaussian</option><option value="box">Box</option></select></div>
        {params.blurType !== 'none' && <Parameter label="Intensidad blur" min={0} max={30} value={params.blurStrength} unit="px" onChange={v => setNumber('blurStrength', v)}/>}
        <Parameter label="Intensidad" min={0} max={100} value={params.mix} unit="%" onChange={v => setNumber('mix', v)}/>
        <div className="select-row"><label htmlFor="tiles">Giro de baldosas</label><select id="tiles" value={params.tileRotation} onChange={e => { custom(); setParam('tileRotation', Number(e.target.value)); }}>{[0, 90, 180, 270].map(value => <option key={value} value={value}>{value}°</option>)}</select></div>
        <button className="reset" aria-label="Restablecer parámetros" onClick={() => { reset(); setPresetName('Entrelazado'); }}>Restablecer</button>
        <div className="export"><select aria-label="Formato de exportación" value={format} onChange={e => setFormat(e.target.value)}><option value="png">PNG</option><option value="jpeg">JPG</option></select><button disabled={!result || busy || exporting || loading} onClick={() => void exportImage()}>{exporting ? 'Exportando…' : 'Exportar imagen'}</button></div>
      </aside>
    </main>
    <footer className="site-footer">I just made somebullshittttt</footer>
    <span className="sr-only" role="status">{saveStatus}</span>
    {(error || processError) && <div className="notice" role="alert"><span>{error || processError}</span><button aria-label="Cerrar error" onClick={() => setError('')}>×</button></div>}
    {message && <div className="notice" role="status">{message}</div>}
    {drag && <div className="drop-overlay">Soltar imagen</div>}
  </div>;
}
