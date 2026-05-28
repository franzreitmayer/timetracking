import { useState, useRef, useEffect } from 'react';

export interface ComboOption {
  id: string;
  value: string;      // gespeicherter Wert
  primary: string;    // Hauptbezeichnung (fett)
  secondary?: string; // Zusatzinfo (grau)
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  options: ComboOption[];
  placeholder?: string;
}

export default function Combobox({ value, onChange, options, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = value
    ? options.filter(o =>
        o.value.toLowerCase().includes(value.toLowerCase()) ||
        o.primary.toLowerCase().includes(value.toLowerCase()) ||
        (o.secondary ?? '').toLowerCase().includes(value.toLowerCase())
      )
    : options;

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="combo-wrapper" ref={ref}>
      <input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
      />
      {open && filtered.length > 0 && (
        <div className="combo-list">
          {filtered.map(o => (
            <div
              key={o.id}
              className="combo-option"
              onMouseDown={() => { onChange(o.value); setOpen(false); }}
            >
              <strong>{o.primary}</strong>
              {o.secondary && <span style={{ color: 'var(--text-muted)' }}> – {o.secondary}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Hilfsfunktionen zum Umwandeln der API-Typen in ComboOptions
import type { MasterDataItem, ExtRefItem } from '../api/client';

export function masterDataToOptions(items: MasterDataItem[]): ComboOption[] {
  return items.map(i => ({ id: i.id, value: i.code, primary: i.code, secondary: i.label }));
}

export function extRefToOptions(items: ExtRefItem[]): ComboOption[] {
  return items.map(i => ({ id: i.id, value: i.referent, primary: i.referent, secondary: i.beschreibung ?? undefined }));
}
