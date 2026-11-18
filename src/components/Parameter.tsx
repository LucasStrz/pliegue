import { useEffect, useState } from 'react';
interface Props { label: string; value: number; min: number; max: number; unit?: string; hint?: string; onChange: (value: number) => void }
export default function Parameter({ label, value, min, max, unit, hint, onChange }: Props) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => { const number = Number(draft); const next = draft.trim() && Number.isFinite(number) ? Math.max(min, Math.min(max, Math.round(number))) : value; onChange(Number(next)); setDraft(String(next)); };
  return <div className="parameter">
    <div className="parameter-title"><label htmlFor={`range-${label}`}>{label}</label><div className="number-box"><input aria-label={`${label}: valor exacto`} type="number" min={min} max={max} step={1} value={draft} onChange={e => { setDraft(e.target.value); const n = Number(e.target.value); if (e.target.value !== '' && Number.isFinite(n) && n >= min && n <= max) onChange(Math.round(n)); }} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} /><span>{unit}</span></div></div>
    <input id={`range-${label}`} className="slider" type="range" min={min} max={max} value={value} style={{ '--fill': `${(value - min) / (max - min) * 100}%` } as React.CSSProperties} onChange={e => onChange(Number(e.target.value))} />
    <div className="range-labels"><span>{min}{unit === '%' ? '%' : ''}</span><span>{max}{unit === '%' ? '%' : ''}</span></div>
    {hint && <p className="parameter-hint">{hint}</p>}
  </div>;
}
