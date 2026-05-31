import { useState, useEffect, useCallback } from 'react';
import api, { TimeEntry, MasterDataItem, ExtRefItem } from '../api/client';
import CalendarView from '../components/CalendarView';
import ListView from '../components/ListView';
import EntryModal from '../components/EntryModal';

type Tab = 'calendar' | 'list';

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>('calendar');
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [kostenstellen, setKostenstellen] = useState<MasterDataItem[]>([]);
  const [kostentraeger, setKostentraeger] = useState<MasterDataItem[]>([]);
  const [extRef1Items, setExtRef1Items] = useState<ExtRefItem[]>([]);
  const [extRef2Items, setExtRef2Items] = useState<ExtRefItem[]>([]);
  const [modal, setModal] = useState<Partial<TimeEntry> | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const now = new Date();
  const [dateFrom, setDateFrom] = useState(() =>
    new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('sv')
  );
  const [dateTo, setDateTo] = useState(() =>
    new Date(now.getFullYear(), now.getMonth() + 1, 0).toLocaleDateString('sv')
  );

  const loadEntries = useCallback(async () => {
    const { data } = await api.get<TimeEntry[]>(`/entries?date_from=${dateFrom}&date_to=${dateTo}`);
    setEntries(data);
  }, [dateFrom, dateTo]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  useEffect(() => {
    api.get<MasterDataItem[]>('/masterdata/kostenstelle').then(r => setKostenstellen(r.data));
    api.get<MasterDataItem[]>('/masterdata/kostentraeger').then(r => setKostentraeger(r.data));
    api.get<ExtRefItem[]>('/extrefs/ref1').then(r => setExtRef1Items(r.data));
    api.get<ExtRefItem[]>('/extrefs/ref2').then(r => setExtRef2Items(r.data));
  }, []);

  function openNew(partial: Partial<TimeEntry> = {}) {
    setModal(partial);
    setModalOpen(true);
  }

  function handleSaved(e: TimeEntry) {
    setEntries(prev => {
      const idx = prev.findIndex(x => x.id === e.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = e; return next; }
      return [...prev, e];
    });
    setModalOpen(false);
  }

  function handleDeleted(id: string) {
    setEntries(prev => prev.filter(e => e.id !== id));
    setModalOpen(false);
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Zeiteinträge</h1>
        <button className="btn-primary" onClick={() => openNew()}>+ Neuer Eintrag</button>
      </div>

      <div className="card" style={{ padding: '14px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
        <label style={{ fontWeight: 600, fontSize: 13 }}>Zeitraum:</label>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: 160 }} />
        <span style={{ color: 'var(--text-muted)' }}>bis</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: 160 }} />
      </div>

      <div className="tabs">
        <button className={`tab${tab === 'calendar' ? ' active' : ''}`} onClick={() => setTab('calendar')}>Kalenderansicht</button>
        <button className={`tab${tab === 'list' ? ' active' : ''}`} onClick={() => setTab('list')}>Listenansicht</button>
      </div>

      {tab === 'calendar' ? (
        <CalendarView
          entries={entries}
          onSelectSlot={(date, start, end) => openNew({ entry_date: date, start_time: start, end_time: end })}
          onEditEntry={e => { setModal(e); setModalOpen(true); }}
          onEntryUpdated={e => setEntries(prev => prev.map(x => x.id === e.id ? e : x))}
        />
      ) : (
        <ListView entries={entries} onEdit={e => { setModal(e); setModalOpen(true); }} dateFrom={dateFrom} dateTo={dateTo} />
      )}

      {modalOpen && (
        <EntryModal
          entry={modal}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
          kostenstellen={kostenstellen}
          kostentraeger={kostentraeger}
          extRef1Items={extRef1Items}
          extRef2Items={extRef2Items}
        />
      )}
    </div>
  );
}
