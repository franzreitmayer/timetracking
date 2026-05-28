import { useState, useEffect } from 'react';
import api, { User, MasterDataItem, ExtRefItem } from '../api/client';

type StammdatenTab = 'kostenstelle' | 'kostentraeger' | 'ref1' | 'ref2';

export default function Admin() {
  const [tab, setTab] = useState<'users' | 'masterdata'>('users');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ── Benutzer ──────────────────────────────────────────────
  const [users, setUsers] = useState<User[]>([]);
  const [userForm, setUserForm] = useState({ username: '', email: '', password: '', is_admin: false });
  const [editUser, setEditUser] = useState<User | null>(null);

  // ── Kostenstellen / Kostenträger ──────────────────────────
  const [mdTab, setMdTab] = useState<StammdatenTab>('kostenstelle');
  const [masterdata, setMasterdata] = useState<MasterDataItem[]>([]);
  const [mdForm, setMdForm] = useState({ code: '', label: '' });
  const [editMd, setEditMd] = useState<MasterDataItem | null>(null);

  // ── Externe Referenzen ────────────────────────────────────
  const [extRefs, setExtRefs] = useState<ExtRefItem[]>([]);
  const [extRefForm, setExtRefForm] = useState({ referent: '', beschreibung: '' });
  const [editExtRef, setEditExtRef] = useState<ExtRefItem | null>(null);

  useEffect(() => { loadUsers(); }, []);
  useEffect(() => {
    if (mdTab === 'kostenstelle' || mdTab === 'kostentraeger') loadMd();
    else loadExtRefs();
  }, [mdTab]);

  function flash(msg: string, isError = false) {
    if (isError) { setError(msg); setSuccess(''); } else { setSuccess(msg); setError(''); }
    setTimeout(() => { setError(''); setSuccess(''); }, 3000);
  }

  // ── Benutzer-Funktionen ───────────────────────────────────
  async function loadUsers() {
    const { data } = await api.get<User[]>('/admin/users');
    setUsers(data);
  }

  async function saveUser() {
    try {
      if (editUser) {
        const body: Record<string, unknown> = { username: userForm.username, email: userForm.email, is_admin: userForm.is_admin, is_active: true };
        if (userForm.password) body.password = userForm.password;
        const { data } = await api.put(`/admin/users/${editUser.id}`, body);
        setUsers(u => u.map(x => x.id === data.id ? data : x));
      } else {
        const { data } = await api.post('/admin/users', userForm);
        setUsers(u => [...u, data]);
      }
      setUserForm({ username: '', email: '', password: '', is_admin: false });
      setEditUser(null);
      flash('Benutzer gespeichert');
    } catch (e: unknown) {
      flash((e as { response?: { data?: { error?: string } } }).response?.data?.error || 'Fehler', true);
    }
  }

  async function deleteUser(id: string) {
    if (!confirm('Benutzer wirklich löschen?')) return;
    await api.delete(`/admin/users/${id}`);
    setUsers(u => u.filter(x => x.id !== id));
    flash('Benutzer gelöscht');
  }

  // ── Kostenstellen/Kostenträger-Funktionen ─────────────────
  async function loadMd() {
    const { data } = await api.get<MasterDataItem[]>(`/masterdata/${mdTab}`);
    setMasterdata(data);
  }

  async function saveMd() {
    try {
      if (editMd) {
        const { data } = await api.put(`/masterdata/${editMd.id}`, { code: mdForm.code, label: mdForm.label, is_active: true });
        setMasterdata(m => m.map(x => x.id === data.id ? data : x));
      } else {
        const { data } = await api.post('/masterdata', { type: mdTab, code: mdForm.code, label: mdForm.label });
        setMasterdata(m => [...m, data]);
      }
      setMdForm({ code: '', label: '' });
      setEditMd(null);
      flash('Gespeichert');
    } catch (e: unknown) {
      flash((e as { response?: { data?: { error?: string } } }).response?.data?.error || 'Fehler', true);
    }
  }

  async function deleteMd(id: string) {
    await api.delete(`/masterdata/${id}`);
    setMasterdata(m => m.filter(x => x.id !== id));
    flash('Gelöscht');
  }

  // ── Externe Referenzen-Funktionen ─────────────────────────
  async function loadExtRefs() {
    const type = mdTab === 'ref1' ? 'ref1' : 'ref2';
    const { data } = await api.get<ExtRefItem[]>(`/extrefs/${type}`);
    setExtRefs(data);
  }

  async function saveExtRef() {
    if (!extRefForm.referent.trim()) return flash('Referent ist Pflichtfeld', true);
    const type = mdTab === 'ref1' ? 'ref1' : 'ref2';
    try {
      if (editExtRef) {
        const { data } = await api.put(`/extrefs/${type}/${editExtRef.id}`, { ...extRefForm, is_active: true });
        setExtRefs(r => r.map(x => x.id === data.id ? data : x));
      } else {
        const { data } = await api.post(`/extrefs/${type}`, extRefForm);
        setExtRefs(r => [...r, data]);
      }
      setExtRefForm({ referent: '', beschreibung: '' });
      setEditExtRef(null);
      flash('Gespeichert');
    } catch (e: unknown) {
      flash((e as { response?: { data?: { error?: string } } }).response?.data?.error || 'Fehler', true);
    }
  }

  async function deleteExtRef(id: string) {
    const type = mdTab === 'ref1' ? 'ref1' : 'ref2';
    await api.delete(`/extrefs/${type}/${id}`);
    setExtRefs(r => r.filter(x => x.id !== id));
    flash('Gelöscht');
  }

  const isExtRefTab = mdTab === 'ref1' || mdTab === 'ref2';

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Administration</h1>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="tabs">
        <button className={`tab${tab === 'users' ? ' active' : ''}`} onClick={() => setTab('users')}>Benutzer</button>
        <button className={`tab${tab === 'masterdata' ? ' active' : ''}`} onClick={() => setTab('masterdata')}>Stammdaten</button>
      </div>

      {/* ── Benutzer ── */}
      {tab === 'users' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
          <div className="card">
            <table>
              <thead><tr><th>Benutzername</th><th>E-Mail</th><th>Admin</th><th>Aktiv</th><th></th></tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td><strong>{u.username}</strong></td>
                    <td>{u.email}</td>
                    <td>{u.is_admin ? '✓' : ''}</td>
                    <td>{u.is_active ? 'Ja' : 'Nein'}</td>
                    <td style={{ display: 'flex', gap: 8 }}>
                      <button className="btn-ghost" onClick={() => { setEditUser(u); setUserForm({ username: u.username, email: u.email, password: '', is_admin: u.is_admin }); }}>✏️</button>
                      <button className="btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => deleteUser(u.id)}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontWeight: 700, marginBottom: 16 }}>{editUser ? 'Benutzer bearbeiten' : 'Neuer Benutzer'}</div>
            <div className="form-group"><label>Benutzername</label><input value={userForm.username} onChange={e => setUserForm(f => ({ ...f, username: e.target.value }))} /></div>
            <div className="form-group"><label>E-Mail</label><input value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div className="form-group"><label>{editUser ? 'Neues Passwort (leer lassen = unverändert)' : 'Passwort'}</label><input type="password" value={userForm.password} onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))} /></div>
            <div className="form-group">
              <div className="checkbox-row">
                <input type="checkbox" id="uIsAdmin" checked={userForm.is_admin} onChange={e => setUserForm(f => ({ ...f, is_admin: e.target.checked }))} />
                <label htmlFor="uIsAdmin">Administrator</label>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {editUser && <button className="btn-secondary" onClick={() => { setEditUser(null); setUserForm({ username: '', email: '', password: '', is_admin: false }); }}>Abbrechen</button>}
              <button className="btn-primary" onClick={saveUser}>Speichern</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Stammdaten ── */}
      {tab === 'masterdata' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
          <div>
            {/* Sub-Tabs */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              {(['kostenstelle', 'kostentraeger', 'ref1', 'ref2'] as StammdatenTab[]).map(t => (
                <button
                  key={t}
                  className={`btn-${mdTab === t ? 'primary' : 'secondary'}`}
                  onClick={() => { setMdTab(t); setEditMd(null); setEditExtRef(null); setMdForm({ code: '', label: '' }); setExtRefForm({ referent: '', beschreibung: '' }); }}
                >
                  {{ kostenstelle: 'Kostenstellen', kostentraeger: 'Kostenträger', ref1: 'Externe Ref. 1', ref2: 'Externe Ref. 2' }[t]}
                </button>
              ))}
            </div>

            {/* Kostenstellen / Kostenträger Tabelle */}
            {!isExtRefTab && (
              <div className="card">
                <table>
                  <thead><tr><th>Code</th><th>Bezeichnung</th><th></th></tr></thead>
                  <tbody>
                    {masterdata.map(m => (
                      <tr key={m.id}>
                        <td><strong>{m.code}</strong></td>
                        <td>{m.label}</td>
                        <td style={{ display: 'flex', gap: 8 }}>
                          <button className="btn-ghost" onClick={() => { setEditMd(m); setMdForm({ code: m.code, label: m.label }); }}>✏️</button>
                          <button className="btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => deleteMd(m.id)}>🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Externe Referenzen Tabelle */}
            {isExtRefTab && (
              <div className="card">
                <table>
                  <thead><tr><th>Referent</th><th>Beschreibung</th><th></th></tr></thead>
                  <tbody>
                    {extRefs.map(r => (
                      <tr key={r.id}>
                        <td><strong>{r.referent}</strong></td>
                        <td>{r.beschreibung || <span style={{ color: 'var(--border)' }}>–</span>}</td>
                        <td style={{ display: 'flex', gap: 8 }}>
                          <button className="btn-ghost" onClick={() => { setEditExtRef(r); setExtRefForm({ referent: r.referent, beschreibung: r.beschreibung || '' }); }}>✏️</button>
                          <button className="btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => deleteExtRef(r.id)}>🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Seitenleiste: Formular */}
          <div className="card" style={{ padding: 20 }}>
            {!isExtRefTab ? (
              <>
                <div style={{ fontWeight: 700, marginBottom: 16 }}>{editMd ? 'Bearbeiten' : `Neue ${mdTab === 'kostenstelle' ? 'Kostenstelle' : 'Kostenträger'}`}</div>
                <div className="form-group"><label>Code</label><input value={mdForm.code} onChange={e => setMdForm(f => ({ ...f, code: e.target.value }))} /></div>
                <div className="form-group"><label>Bezeichnung</label><input value={mdForm.label} onChange={e => setMdForm(f => ({ ...f, label: e.target.value }))} /></div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {editMd && <button className="btn-secondary" onClick={() => { setEditMd(null); setMdForm({ code: '', label: '' }); }}>Abbrechen</button>}
                  <button className="btn-primary" onClick={saveMd}>Speichern</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontWeight: 700, marginBottom: 16 }}>{editExtRef ? 'Bearbeiten' : `Neuer Eintrag Ext. Ref. ${mdTab === 'ref1' ? '1' : '2'}`}</div>
                <div className="form-group"><label>Referent *</label><input value={extRefForm.referent} onChange={e => setExtRefForm(f => ({ ...f, referent: e.target.value }))} placeholder="z.B. Ticket-Nr, Name, ID..." /></div>
                <div className="form-group"><label>Beschreibung</label><input value={extRefForm.beschreibung} onChange={e => setExtRefForm(f => ({ ...f, beschreibung: e.target.value }))} placeholder="Optionale Erläuterung..." /></div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {editExtRef && <button className="btn-secondary" onClick={() => { setEditExtRef(null); setExtRefForm({ referent: '', beschreibung: '' }); }}>Abbrechen</button>}
                  <button className="btn-primary" onClick={saveExtRef}>Speichern</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
