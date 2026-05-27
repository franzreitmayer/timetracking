import { useState, useEffect, useRef, useCallback } from 'react';
import api, { TimeEntry, MasterDataItem, Attachment, attachmentUrl } from '../api/client';
import Combobox from './Combobox';

interface Props {
  entry?: Partial<TimeEntry> | null;
  onClose: () => void;
  onSaved: (e: TimeEntry) => void;
  onDeleted?: (id: string) => void;
  kostenstellen: MasterDataItem[];
  kostentraeger: MasterDataItem[];
}

const empty = (): Partial<TimeEntry> => ({
  entry_date: new Date().toLocaleDateString('sv'),   // sv locale gives YYYY-MM-DD in local time
  start_time: '08:00',
  end_time: '09:00',
  short_text: '',
  long_text: '',
  kostenstelle: '',
  kostentraeger: '',
  is_travel: false,
  is_billable: false,
});

function fmtSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function isImage(mime: string) {
  return mime.startsWith('image/');
}

function fileIcon(mime: string) {
  if (mime.startsWith('image/')) return '🖼️';
  if (mime === 'application/pdf') return '📄';
  if (mime.includes('word') || mime.includes('document')) return '📝';
  if (mime.includes('sheet') || mime.includes('excel')) return '📊';
  if (mime.includes('zip') || mime.includes('compressed')) return '🗜️';
  return '📎';
}

export default function EntryModal({ entry, onClose, onSaved, onDeleted, kostenstellen, kostentraeger }: Props) {
  const [form, setForm] = useState<Partial<TimeEntry>>(entry ? { ...entry } : empty());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Attachments
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (entry) {
      setForm({
        ...entry,
        entry_date: entry.entry_date?.slice(0, 10),
        start_time: entry.start_time?.slice(0, 5),
        end_time: entry.end_time?.slice(0, 5),
      });
    } else {
      setForm(empty());
    }
    setError('');
    setPendingFiles([]);
    setPendingPreviews([]);
  }, [entry]);

  // Load existing attachments when editing
  useEffect(() => {
    if (entry?.id) {
      api.get<Attachment[]>(`/attachments/entry/${entry.id}`)
        .then(r => setAttachments(r.data))
        .catch(() => setAttachments([]));
    } else {
      setAttachments([]);
    }
  }, [entry?.id]);

  // Revoke object URLs on unmount
  useEffect(() => {
    return () => { pendingPreviews.forEach(URL.revokeObjectURL); };
  }, [pendingPreviews]);

  // Clipboard paste — only active while modal is open
  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      const items = Array.from(e.clipboardData?.items || []);
      const imageItem = items.find(i => i.type.startsWith('image/'));
      if (!imageItem) return;
      const file = imageItem.getAsFile();
      if (!file) return;
      const ts = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const named = new File([file], `screenshot-${ts}.png`, { type: file.type });
      addFiles([named]);
    }
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  function addFiles(files: File[]) {
    const newPreviews = files.map(f => isImage(f.type) ? URL.createObjectURL(f) : '');
    setPendingFiles(prev => [...prev, ...files]);
    setPendingPreviews(prev => [...prev, ...newPreviews]);
  }

  function removePending(idx: number) {
    URL.revokeObjectURL(pendingPreviews[idx]);
    setPendingFiles(prev => prev.filter((_, i) => i !== idx));
    setPendingPreviews(prev => prev.filter((_, i) => i !== idx));
  }

  async function deleteAttachment(att: Attachment) {
    await api.delete(`/attachments/${att.id}`);
    setAttachments(prev => prev.filter(a => a.id !== att.id));
  }

  // Drag & drop handlers
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (!dropRef.current?.contains(e.relatedTarget as Node)) setDragging(false);
  }, []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) addFiles(files);
  }, []);

  const set = (key: keyof TimeEntry, val: unknown) => setForm(f => ({ ...f, [key]: val }));

  async function save() {
    if (!form.entry_date || !form.start_time || !form.end_time || !form.short_text?.trim()) {
      setError('Datum, Von, Bis und Kurztext sind Pflichtfelder.');
      return;
    }
    setSaving(true);
    try {
      let saved: TimeEntry;
      if (form.id) {
        saved = (await api.put(`/entries/${form.id}`, form)).data;
      } else {
        saved = (await api.post('/entries', form)).data;
      }

      // Upload pending files sequentially
      for (const file of pendingFiles) {
        const fd = new FormData();
        fd.append('file', file);
        await api.post(`/attachments/entry/${saved.id}`, fd);
      }

      onSaved(saved);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error || 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  }

  async function del() {
    if (!form.id || !onDeleted) return;
    if (!confirm('Eintrag wirklich löschen?')) return;
    await api.delete(`/entries/${form.id}`);
    onDeleted(form.id);
  }

  const totalAttachments = attachments.length + pendingFiles.length;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{form.id ? 'Eintrag bearbeiten' : 'Neuer Eintrag'}</span>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}

          <div className="form-group">
            <label>Datum</label>
            <input type="date" value={form.entry_date || ''} onChange={e => set('entry_date', e.target.value)} />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Von</label>
              <input type="time" value={form.start_time || ''} onChange={e => set('start_time', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Bis</label>
              <input type="time" value={form.end_time || ''} onChange={e => set('end_time', e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label>Kurztext *</label>
            <input value={form.short_text || ''} onChange={e => set('short_text', e.target.value)} placeholder="z.B. Meeting, Entwicklung..." />
          </div>

          <div className="form-group">
            <label>Langtext</label>
            <textarea value={form.long_text || ''} onChange={e => set('long_text', e.target.value)} placeholder="Optionale Beschreibung..." />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Kostenstelle</label>
              <Combobox value={form.kostenstelle || ''} onChange={v => set('kostenstelle', v)} items={kostenstellen} placeholder="Code oder Name..." />
            </div>
            <div className="form-group">
              <label>Kostenträger</label>
              <Combobox value={form.kostentraeger || ''} onChange={v => set('kostentraeger', v)} items={kostentraeger} placeholder="Code oder Name..." />
            </div>
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', gap: 24 }}>
              <div className="checkbox-row">
                <input type="checkbox" id="is_travel" checked={!!form.is_travel} onChange={e => set('is_travel', e.target.checked)} />
                <label htmlFor="is_travel">Fahrzeit</label>
              </div>
              <div className="checkbox-row">
                <input type="checkbox" id="is_billable" checked={!!form.is_billable} onChange={e => set('is_billable', e.target.checked)} />
                <label htmlFor="is_billable">Verrechenbar</label>
              </div>
            </div>
          </div>

          {/* ── Anhänge ── */}
          <div className="form-group" style={{ marginTop: 8 }}>
            <label>Anhänge{totalAttachments > 0 ? ` (${totalAttachments})` : ''}</label>

            {/* Drop zone */}
            <div
              ref={dropRef}
              className={`attachment-drop-zone${dragging ? ' dragging' : ''}`}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <span>📎 Datei ablegen oder klicken</span>
              <span className="drop-hint">Screenshot: Strg+V direkt einfügen</span>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                style={{ display: 'none' }}
                onChange={e => { if (e.target.files) addFiles(Array.from(e.target.files)); e.target.value = ''; }}
              />
            </div>

            {/* Existing attachments */}
            {attachments.map(att => (
              <div key={att.id} className="attachment-item">
                {isImage(att.mimetype) ? (
                  <a href={attachmentUrl(att)} target="_blank" rel="noreferrer">
                    <img src={attachmentUrl(att)} className="attachment-preview" alt={att.original_name} />
                  </a>
                ) : (
                  <div className="attachment-icon">{fileIcon(att.mimetype)}</div>
                )}
                <div className="attachment-info">
                  <div className="attachment-name">{att.original_name}</div>
                  <div className="attachment-size">{fmtSize(att.size)}</div>
                </div>
                <a
                  href={attachmentUrl(att, true)}
                  className="btn-ghost"
                  style={{ fontSize: 16 }}
                  title="Herunterladen"
                  onClick={e => e.stopPropagation()}
                >⬇</a>
                <button
                  className="btn-ghost"
                  style={{ color: 'var(--danger)', fontSize: 16 }}
                  title="Löschen"
                  onClick={() => deleteAttachment(att)}
                >🗑</button>
              </div>
            ))}

            {/* Pending (not yet uploaded) */}
            {pendingFiles.map((file, i) => (
              <div key={i} className="attachment-item attachment-pending">
                {isImage(file.type) && pendingPreviews[i] ? (
                  <img src={pendingPreviews[i]} className="attachment-preview" alt={file.name} />
                ) : (
                  <div className="attachment-icon">{fileIcon(file.type)}</div>
                )}
                <div className="attachment-info">
                  <div className="attachment-name">{file.name}</div>
                  <div className="attachment-size">{fmtSize(file.size)} · <em>wird beim Speichern hochgeladen</em></div>
                </div>
                <button
                  className="btn-ghost"
                  style={{ color: 'var(--danger)', fontSize: 16 }}
                  onClick={() => removePending(i)}
                >✕</button>
              </div>
            ))}
          </div>

          <div className="modal-footer">
            {form.id && onDeleted && (
              <button className="btn-danger" onClick={del} style={{ marginRight: 'auto' }}>Löschen</button>
            )}
            <button className="btn-secondary" onClick={onClose}>Abbrechen</button>
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Speichern…' : 'Speichern'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
