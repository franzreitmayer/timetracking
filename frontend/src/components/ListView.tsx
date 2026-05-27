import type { TimeEntry } from '../api/client';

interface Props {
  entries: TimeEntry[];
  onEdit: (e: TimeEntry) => void;
}

function durationMins(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
}

function fmtMins(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}min`;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function duration(start: string, end: string): string {
  const mins = durationMins(start, end);
  return mins === 0 ? '-' : fmtMins(mins);
}

function fmtDate(d: string) {
  return new Date(d.slice(0, 10) + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function ListView({ entries, onEdit }: Props) {
  if (entries.length === 0) {
    return (
      <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Keine Einträge gefunden.
      </div>
    );
  }

  const grouped = entries.reduce<Record<string, TimeEntry[]>>((acc, e) => {
    const key = e.entry_date.slice(0, 10);
    (acc[key] = acc[key] || []).push(e);
    return acc;
  }, {});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {Object.keys(grouped).sort().reverse().map(date => {
        const dayEntries = grouped[date].slice().sort((a, b) => a.start_time.localeCompare(b.start_time));
        const totalMins    = dayEntries.reduce((s, e) => s + durationMins(e.start_time.slice(0, 5), e.end_time.slice(0, 5)), 0);
        const billableMins = dayEntries.filter(e => e.is_billable).reduce((s, e) => s + durationMins(e.start_time.slice(0, 5), e.end_time.slice(0, 5)), 0);

        return (
          <div key={date} className="card">
            {/* Day header */}
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: 13 }}>{fmtDate(date)}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{dayEntries.length} Einträge</span>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 16, fontSize: 12 }}>
                <span title="Gesamtdauer des Tages">
                  <span style={{ color: 'var(--text-muted)' }}>Gesamt </span>
                  <strong style={{ color: 'var(--text)' }}>{fmtMins(totalMins)}</strong>
                </span>
                <span title="Davon verrechenbar" style={{ color: billableMins > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>
                  <span style={{ opacity: 0.8 }}>Verrechenbar </span>
                  <strong>{fmtMins(billableMins)}</strong>
                </span>
              </span>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Von</th>
                  <th>Bis</th>
                  <th>Dauer</th>
                  <th>Kurztext</th>
                  <th>Kostenstelle</th>
                  <th>Kostenträger</th>
                  <th>Typ</th>
                  <th style={{ textAlign: 'center' }}>Verr.</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {dayEntries.map(e => (
                  <tr key={e.id} style={{ cursor: 'pointer' }} onClick={() => onEdit(e)}>
                    <td>{e.start_time.slice(0, 5)}</td>
                    <td>{e.end_time.slice(0, 5)}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{duration(e.start_time.slice(0, 5), e.end_time.slice(0, 5))}</td>
                    <td>
                      <strong>{e.short_text}</strong>
                      {e.long_text && (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                          {e.long_text.slice(0, 80)}{e.long_text.length > 80 ? '…' : ''}
                        </div>
                      )}
                    </td>
                    <td>{e.kostenstelle || <span style={{ color: 'var(--border)' }}>–</span>}</td>
                    <td>{e.kostentraeger || <span style={{ color: 'var(--border)' }}>–</span>}</td>
                    <td><span className={`badge ${e.is_travel ? 'badge-travel' : 'badge-work'}`}>{e.is_travel ? 'Fahrzeit' : 'Arbeit'}</span></td>
                    <td style={{ textAlign: 'center' }}>
                      {e.is_billable
                        ? <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: 15 }}>€</span>
                        : <span style={{ color: 'var(--border)' }}>–</span>}
                    </td>
                    <td>
                      <button className="btn-ghost" onClick={ev => { ev.stopPropagation(); onEdit(e); }}>✏️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
