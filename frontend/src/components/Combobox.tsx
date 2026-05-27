import { useState, useRef, useEffect } from 'react';
import { MasterDataItem } from '../api/client';

interface Props {
  value: string;
  onChange: (v: string) => void;
  items: MasterDataItem[];
  placeholder?: string;
}

export default function Combobox({ value, onChange, items, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = value
    ? items.filter(i => i.code.toLowerCase().includes(value.toLowerCase()) || i.label.toLowerCase().includes(value.toLowerCase()))
    : items;

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
          {filtered.map(i => (
            <div
              key={i.id}
              className="combo-option"
              onMouseDown={() => { onChange(i.code); setOpen(false); }}
            >
              <strong>{i.code}</strong> – {i.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
