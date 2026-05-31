import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import Nav from './components/Nav';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  return localStorage.getItem('token') ? <>{children}</> : <Navigate to="/login" replace />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (!localStorage.getItem('token')) return <Navigate to="/login" replace />;
  if (!user.is_admin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  const now = new Date();
  const [dateFrom, setDateFrom] = useState(() =>
    new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('sv')
  );
  const [dateTo, setDateTo] = useState(() =>
    new Date(now.getFullYear(), now.getMonth() + 1, 0).toLocaleDateString('sv')
  );

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={
          <PrivateRoute>
            <Nav />
            <Routes>
              <Route path="/" element={
                <Dashboard
                  dateFrom={dateFrom}
                  dateTo={dateTo}
                  onDateFromChange={setDateFrom}
                  onDateToChange={setDateTo}
                />
              } />
              <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
            </Routes>
          </PrivateRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}
