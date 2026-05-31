import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Sankey,
} from 'recharts';
import { toPng } from 'html-to-image';
import api, { TimeEntry, MasterDataItem, ExtRefItem } from '../api/client';

type ChartType = 'bar' | 'sankey';
type AggLevel  = 'day' | 'week' | 'month' | 'quarter';
type GroupField = 'kostenstelle' | 'kostentraeger' | 'external_ref1' | 'external_ref2';

interface Props {
  dateFrom: string;
  dateTo: string;
}

const COLORS = [
  '#4f46e5', '#0891b2', '#16a34a', '#ea580c',
  '#db2777', '#ca8a04', '#7c3aed', '#64748b',
  '#0f766e', '#b45309', '#be123c', '#1d4ed8',
];

// ── Hilfsfunktionen ──────────────────────────────────────────────────────────

function isoWeekLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const tmp = new Date(d.getTime());
  tmp.setDate(tmp.getDate() + 3 - (tmp.getDay() + 6) % 7);
  const week1 = new Date(tmp.getFullYear(), 0, 4);
  const wn = 1 + Math.round(
    ((tmp.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7,
  );
  return `KW${String(wn).padStart(2, '0')}/${tmp.getFullYear()}`;
}

function periodKey(dateStr: string, agg: AggLevel): string {
  const d = new Date(dateStr + 'T00:00:00');
  const y = d.getFullYear();
  const m = d.getMonth();
  switch (agg) {
    case 'day':     return dateStr.slice(0, 10);
    case 'week':    return isoWeekLabel(dateStr);
    case 'month':   return `${String(m + 1).padStart(2, '0')}/${y}`;
    case 'quarter': return `Q${Math.ceil((m + 1) / 3)}/${y}`;
  }
}

function durationH(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return Math.max(0, (eh * 60 + em) - (sh * 60 + sm)) / 60;
}

// ── Komponente ───────────────────────────────────────────────────────────────

export default function Entwicklung({ dateFrom, dateTo }: Props) {
  const [chartType,  setChartType]  = useState<ChartType>('bar');
  const [aggLevel,   setAggLevel]   = useState<AggLevel>('month');
  const [groupField, setGroupField] = useState<GroupField>('kostenstelle');

  const [entries,      setEntries]      = useState<TimeEntry[]>([]);
  const [kostenstellen, setKostenstellen] = useState<MasterDataItem[]>([]);
  const [kostentraeger, setKostentraeger] = useState<MasterDataItem[]>([]);
  const [extRef1Items,  setExtRef1Items]  = useState<ExtRefItem[]>([]);
  const [extRef2Items,  setExtRef2Items]  = useState<ExtRefItem[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(800);

  // Einträge laden, wenn sich Zeitraum ändert
  const loadEntries = useCallback(async () => {
    const { data } = await api.get<TimeEntry[]>(`/entries?date_from=${dateFrom}&date_to=${dateTo}`);
    setEntries(data);
  }, [dateFrom, dateTo]);
  useEffect(() => { loadEntries(); }, [loadEntries]);

  // Stammdaten einmalig laden
  useEffect(() => {
    api.get<MasterDataItem[]>('/masterdata/kostenstelle').then(r => setKostenstellen(r.data));
    api.get<MasterDataItem[]>('/masterdata/kostentraeger').then(r => setKostentraeger(r.data));
    api.get<ExtRefItem[]>('/extrefs/ref1').then(r => setExtRef1Items(r.data));
    api.get<ExtRefItem[]>('/extrefs/ref2').then(r => setExtRef2Items(r.data));
  }, []);

  // Container-Breite beobachten (für Sankey-Breite)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setChartWidth(el.clientWidth - 48));
    ro.observe(el);
    setChartWidth(el.clientWidth - 48);
    return () => ro.disconnect();
  }, []);

  // ── Aggregation ─────────────────────────────────────────────────────────────

  const { categories, barData, sankeyData, totalHours } = useMemo(() => {
    function resolveLabel(value: string | null): string {
      if (!value) return '(keine)';
      switch (groupField) {
        case 'kostenstelle': {
          const f = kostenstellen.find(i => i.code === value);
          return f ? `${value} – ${f.label}` : value;
        }
        case 'kostentraeger': {
          const f = kostentraeger.find(i => i.code === value);
          return f ? `${value} – ${f.label}` : value;
        }
        case 'external_ref1': {
          const f = extRef1Items.find(i => i.referent === value);
          return f?.beschreibung ? `${value} – ${f.beschreibung}` : value;
        }
        case 'external_ref2': {
          const f = extRef2Items.find(i => i.referent === value);
          return f?.beschreibung ? `${value} – ${f.beschreibung}` : value;
        }
      }
    }

    // period -> category -> hours
    const map = new Map<string, Map<string, number>>();
    const catSet = new Set<string>();

    for (const e of entries) {
      const period = periodKey(e.entry_date.slice(0, 10), aggLevel);
      const cat    = resolveLabel(e[groupField] as string | null);
      catSet.add(cat);
      if (!map.has(period)) map.set(period, new Map());
      const pm = map.get(period)!;
      pm.set(cat, (pm.get(cat) ?? 0) + durationH(e.start_time.slice(0, 5), e.end_time.slice(0, 5)));
    }

    const periods = Array.from(map.keys()).sort();

    // "(keine)" ans Ende sortieren
    const categories = [
      ...Array.from(catSet).filter(c => c !== '(keine)').sort(),
      ...(catSet.has('(keine)') ? ['(keine)'] : []),
    ];

    // Balken-Daten
    const barData = periods.map(p => {
      const row: Record<string, string | number> = { period: p };
      for (const c of categories) {
        row[c] = parseFloat((map.get(p)?.get(c) ?? 0).toFixed(2));
      }
      return row;
    });

    // Sankey-Daten
    const nodes: { name: string }[] = [
      ...periods.map(p => ({ name: p })),
      ...categories.map(c => ({ name: c })),
    ];
    const links: { source: number; target: number; value: number }[] = [];
    for (let pi = 0; pi < periods.length; pi++) {
      for (let ci = 0; ci < categories.length; ci++) {
        const val = map.get(periods[pi])?.get(categories[ci]) ?? 0;
        if (val > 0.001) {
          links.push({ source: pi, target: periods.length + ci, value: parseFloat(val.toFixed(2)) });
        }
      }
    }

    const totalHours = Array.from(map.values()).reduce(
      (s, pm) => s + Array.from(pm.values()).reduce((a, b) => a + b, 0), 0,
    );

    return { categories, barData, sankeyData: { nodes, links }, totalHours };
  }, [entries, aggLevel, groupField, kostenstellen, kostentraeger, extRef1Items, extRef2Items]);

  // ── Export ──────────────────────────────────────────────────────────────────

  async function handleExport() {
    const node = containerRef.current;
    if (!node) return;
    const dataUrl = await toPng(node, { backgroundColor: '#ffffff', pixelRatio: 2 });
    const a = document.createElement('a');
    a.download = `Entwicklung_${dateFrom}_${dateTo}.png`;
    a.href = dataUrl;
    a.click();
  }

  // ── Labels ──────────────────────────────────────────────────────────────────

  const fieldLabels: Record<GroupField, string> = {
    kostenstelle:  'Kostenstelle',
    kostentraeger: 'Kostenträger',
    external_ref1: 'Ext. Ref. 1',
    external_ref2: 'Ext. Ref. 2',
  };

  const aggLabels: Record<AggLevel, string> = {
    day: 'Tag', week: 'Woche', month: 'Monat', quarter: 'Quartal',
  };

  const sankeyHeight = Math.max(420, sankeyData.nodes.length * 28 + 80);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Entwicklung</h1>
        <button className="btn-secondary" onClick={handleExport} title="Diagramm als PNG exportieren">
          ⬇ PNG Export
        </button>
      </div>

      {/* Zeitraum-Info */}
      <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--text-muted)' }}>
        Zeitraum: <strong style={{ color: 'var(--text)' }}>{dateFrom}</strong>
        {' '}bis{' '}
        <strong style={{ color: 'var(--text)' }}>{dateTo}</strong>
        {' '}— Zeitraum wird in der Ansicht „Zeiten" eingestellt.
      </div>

      {/* Steuerung */}
      <div className="card" style={{ padding: '14px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        {/* Diagrammtyp */}
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            className={chartType === 'bar' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setChartType('bar')}
          >
            📊 Balken
          </button>
          <button
            className={chartType === 'sankey' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setChartType('sankey')}
          >
            🔀 Sankey
          </button>
        </div>

        {/* Aggregation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-muted)', marginRight: 2 }}>
            Aggregation
          </span>
          {(Object.entries(aggLabels) as [AggLevel, string][]).map(([a, label]) => (
            <button
              key={a}
              className={aggLevel === a ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setAggLevel(a)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Gruppierung */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-muted)' }}>Gruppierung</span>
          <select
            value={groupField}
            onChange={e => setGroupField(e.target.value as GroupField)}
            style={{
              fontSize: 13, padding: '5px 10px', borderRadius: 6,
              border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)',
            }}
          >
            {(Object.entries(fieldLabels) as [GroupField, string][]).map(([f, l]) => (
              <option key={f} value={f}>{l}</option>
            ))}
          </select>
        </div>

        {/* Zusammenfassung */}
        <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)' }}>
          <strong style={{ color: 'var(--text)' }}>{entries.length}</strong> Einträge ·{' '}
          <strong style={{ color: 'var(--primary)' }}>{totalHours.toFixed(1)} h</strong> gesamt
        </span>
      </div>

      {/* Diagramm */}
      <div className="card" style={{ padding: 24 }}>
        {entries.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 60 }}>
            Keine Einträge im Zeitraum {dateFrom} – {dateTo}.
          </div>
        ) : (
          <div ref={containerRef} style={{ background: '#ffffff', borderRadius: 8, padding: 8 }}>
            {chartType === 'bar' ? (
              <ResponsiveContainer width="100%" height={480}>
                <BarChart data={barData} margin={{ top: 10, right: 20, left: 10, bottom: 70 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="period"
                    angle={-35}
                    textAnchor="end"
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    interval={0}
                  />
                  <YAxis
                    tickFormatter={v => `${v}h`}
                    tick={{ fontSize: 12, fill: '#64748b' }}
                  />
                  <Tooltip
                    formatter={(v: number, name: string) => [`${Number(v).toFixed(2)} h`, name]}
                    labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                    contentStyle={{ fontSize: 13 }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    wrapperStyle={{ paddingTop: 16, fontSize: 12 }}
                  />
                  {categories.map((cat, i) => (
                    <Bar
                      key={cat}
                      dataKey={cat}
                      stackId="stack"
                      fill={COLORS[i % COLORS.length]}
                      radius={i === categories.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <Sankey
                  width={Math.max(680, chartWidth)}
                  height={sankeyHeight}
                  data={sankeyData}
                  nodePadding={14}
                  margin={{ top: 16, bottom: 16, left: 10, right: 220 }}
                  link={{ stroke: '#94a3b8', strokeOpacity: 0.45 }}
                >
                  <Tooltip
                    formatter={(v: number) => [`${Number(v).toFixed(2)} h`, 'Stunden']}
                    contentStyle={{ fontSize: 13 }}
                  />
                </Sankey>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
