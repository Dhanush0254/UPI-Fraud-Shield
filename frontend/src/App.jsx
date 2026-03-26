// App.jsx — Main app with JWT auth, role-based routing
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import Login from './components/Login';
import SignUp from './components/SignUp';
import NumberChecker from './components/NumberChecker';
import ReportFraud from './components/ReportFraud';
import MyComplaints from './components/MyComplaints';
import AdminDashboard from './components/AdminDashboard';


// Nav component that uses useLocation
function NavBar({ user, onLogout }) {
  const location = useLocation();
  const isActive = (path) => location.pathname === path ? 'nav-link active' : 'nav-link';

  return (
    <nav className="navbar">
      <Link to="/" className="nav-brand">
        <span className="nav-brand-icon">🛡️</span>
        <span className="nav-brand-text">UPI Fraud Shield</span>
      </Link>
      <div className="nav-links">
        <Link to="/" className={isActive('/')}>Check Number</Link>
        {user ? (
          <>
            <Link to="/report" className={isActive('/report')}>Report Fraud</Link>
            <Link to="/my-complaints" className={isActive('/my-complaints')}>My Complaints</Link>
            {user.role === 'admin' && (
              <Link to="/admin" className={isActive('/admin')}>Admin Panel</Link>
            )}
            <div className="nav-user-badge">
              👤 {user.username}
              {user.role === 'admin' && <span className="nav-admin-tag">ADMIN</span>}
            </div>
            <button className="nav-link nav-logout-btn" onClick={onLogout}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/login" className={isActive('/login')}>Login</Link>
            <Link to="/signup" className={isActive('/signup')}>Sign Up</Link>
          </>
        )}
      </div>
    </nav>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for stored token on mount
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (storedToken && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setToken(storedToken);
        setUser(parsedUser);
        // Verify token is still valid
        axios.get(`${API}/me`, { headers: { Authorization: `Bearer ${storedToken}` } })
          .then(res => {
            setUser(res.data);
            localStorage.setItem('user', JSON.stringify(res.data));
          })
          .catch(() => {
            handleLogout();
          });
      } catch {
        handleLogout();
      }
    }
    setLoading(false);
  }, []);

  const handleLogin = (newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  if (loading) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div className="loading-spinner">
          <div className="spinner" />
          <h2>Loading...</h2>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="app-container">
        <NavBar user={user} onLogout={handleLogout} />
        <div className="page-content">
          <Routes>
            {/* Public */}
            <Route path="/" element={<NumberChecker />} />
            <Route path="/login" element={user ? <Navigate to="/" /> : <Login onLogin={handleLogin} />} />
            <Route path="/signup" element={user ? <Navigate to="/" /> : <SignUp />} />

            {/* Protected — User */}
            <Route path="/report" element={user ? <ReportFraud token={token} /> : <Navigate to="/login" />} />
            <Route path="/my-complaints" element={user ? <MyComplaints token={token} /> : <Navigate to="/login" />} />

            {/* Protected — Admin */}
            <Route path="/admin" element={
              user && user.role === 'admin' ? <AdminDashboard token={token} /> : <Navigate to="/" />
            } />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
