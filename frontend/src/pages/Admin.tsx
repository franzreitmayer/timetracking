import { useState, useEffect } from 'react';
import api, { User, MasterDataItem } from '../api/client';

export default function Admin() {
  const [tab, setTab] = useState<'users' | 'masterdata'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [masterdata, setMasterdata] = useState<MasterDataItem[]>([]);
  const [mdType, setMdType] = useState<'kostenstelle' | 'kostentraeger'>('kostenstelle');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // User form
  const [userForm, setUserForm] = useState({ username: '', email: '', password: '', is_admin: false });
  const [editUser, setEditUser] = useState<User | null>(null);

  // Masterdata form
  const [mdForm, setMdForm] = useState({ type: 'kostenstelle' as 'kostenstelle' | 'kostentraeger', code: '', label: '' });
  const [editMd, setEditMd] = useState<MasterDataItem | null>(null);

  useEffect(() => { loadUsers(); }, []);
  useEffect(() => { loadMd(); }, [mdType]);

  async function loadUsers() {
    const { data } = await api.get<User[]>('/admin/users');
    setUsers(data);
  }

  async function loadMd() {
    const { data } = await api.get<MasterDataItem[]>(`/masterdata/${mdType}`);
    setMasterdata(data);
  }

  function flash(msg: string, isError = false) {
    if (isError) { setError(msg); setSuccess(''); }
    else { setSuccess(msg); setError(''); }
    setTimeout(() => { setError(''); setSuccess(''); }, 3000);
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
      const err = e as { response?: { data?: { error?: string } } };
      flash(err.response?.data?.error || 'Fehler', true);
    }
  }

  async function deleteUser(id: string) {
    if (!confirm('Benutzer wirklich löschen? Alle Zeiteinträge werden ebenfalls gelöscht.')) return;
    await api.delete(`/admin/users/${id}`);
    setUsers(u => u.filter(x => x.id !== id));
    flash('Benutzer gelöscht');
  }

  function startEditUser(u: User) {
    setEditUser(u);
    setUserForm({ username: u.username, email: u.email, password: '', is_admin: u.is_admin });
  }

  async function saveMd() {
    try {
      if (editMd) {
        const { data } = await api.put(`/masterdata/${editMd.id}`, { code: mdForm.code, label: mdForm.label, is_active: true });
        setMasterdata(m => m.map(x => x.id === data.id ? data : x));
      } else {
        const { data } = await api.post('/masterdata', { ...mdForm, type: mdType });
        setMasterdata(m => [...m, data]);
      }
      setMdForm({ type: mdType, code: '', label: '' });
      setEditMd(null);
      flash('Gespeichert');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      flash(err.response?.data?.error || 'Fehler', true);
    }
  }

  async function deleteMd(id: string) {
    await api.delete(`/masterdata/${id}`);
    setMasterdata(m => m.filter(x => x.id !== id));
    flash('Gelöscht');
  }

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

      {tab === 'users' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
          <div className="card">
            <table>
              <thead>
                <tr><th>Benutzername</th><th>E-Mail</th><th>Admin</th><th>Aktiv</th><th></th></tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td><strong>{u.username}</strong></td>
                    <td>{u.email}</td>
                    <td>{u.is_admin ? '✓' : ''}</td>
                    <td>{u.is_active ? 'Ja' : 'Nein'}</td>
                    <td style={{ display: 'flex', gap: 8 }}>
                      <button className="btn-ghost" onClick={() => startEditUser(u)}>✏️</button>
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
            <div className="form-group"><label>{editUser ? 'Neues Passwort (leer = unverändert)' : 'Passwort'}</label><input type="password" value={userForm.password} onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))} /></div>
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

      {tab === 'masterdata' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
          <div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <button className={`btn-${mdType === 'kostenstelle' ? 'primary' : 'secondary'}`} onClick={() => setMdType('kostenstelle')}>Kostenstellen</button>
              <button className={`btn-${mdType === 'kostentraeger' ? 'primary' : 'secondary'}`} onClick={() => setMdType('kostentraeger')}>Kostenträger</button>
            </div>
            <div className="card">
              <table>
                <thead><tr><th>Code</th><th>Bezeichnung</th><th></th></tr></thead>
                <tbody>
                  {masterdata.map(m => (
                    <tr key={m.id}>
                      <td><strong>{m.code}</strong></td>
                      <td>{m.label}</td>
                      <td style={{ display: 'flex', gap: 8 }}>
                        <button className="btn-ghost" onClick={() => { setEditMd(m); setMdForm({ type: mdType, code: m.code, label: m.label }); }}>✏️</button>
                        <button className="btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => deleteMd(m.id)}>🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontWeight: 700, marginBottom: 16 }}>{editMd ? 'Eintrag bearbeiten' : `Neue ${mdType === 'kostenstelle' ? 'Kostenstelle' : 'Kostenträger'}`}</div>
            <div className="form-group"><label>Code</label><input value={mdForm.code} onChange={e => setMdForm(f => ({ ...f, code: e.target.value }))} /></div>
            <div className="form-group"><label>Bezeichnung</label><input value={mdForm.label} onChange={e => setMdForm(f => ({ ...f, label: e.target.value }))} /></div>
            <div style={{ display: 'flex', gap: 8 }}>
              {editMd && <button className="btn-secondary" onClick={() => { setEditMd(null); setMdForm({ type: mdType, code: '', label: '' }); }}>Abbrechen</button>}
              <button className="btn-primary" onClick={saveMd}>Speichern</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
