import { useNavigate, useLocation } from 'react-router-dom';

export default function Nav() {
  const nav = useNavigate();
  const loc = useLocation();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    nav('/login');
  }

  return (
    <nav className="nav">
      <span className="nav-brand">Zeiterfassung</span>
      <div className="nav-links">
        <button className={`nav-link${loc.pathname === '/' ? ' active' : ''}`} onClick={() => nav('/')}>
          Zeiten
        </button>
        <button className={`nav-link${loc.pathname === '/entwicklung' ? ' active' : ''}`} onClick={() => nav('/entwicklung')}>
          Entwicklung
        </button>
        {user.is_admin && (
          <button className={`nav-link${loc.pathname === '/admin' ? ' active' : ''}`} onClick={() => nav('/admin')}>
            Administration
          </button>
        )}
      </div>
      <div className="nav-user">
        <span>{user.username}</span>
        <button className="btn-ghost" onClick={logout}>Abmelden</button>
      </div>
    </nav>
  );
}
