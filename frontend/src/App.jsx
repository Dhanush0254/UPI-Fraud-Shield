// App.jsx — Main app with JWT auth, role-based routing, backend wake-up loader
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { API } from './config';
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

// Splash loader while backend wakes up
const SPLASH_MESSAGES = [
  '🔌 Waking up server...',
  '🔐 Initializing security...',
  '🗄️ Connecting to database...',
  '⚡ Loading fraud engine...',
  '🛡️ Preparing dashboard...',
  '✅ Almost ready...'
];

function SplashLoader({ progress }) {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex(prev => (prev + 1) % SPLASH_MESSAGES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="splash-loader">
      <div className="splash-content">
        <div className="splash-icon">🛡️</div>
        <h1 className="splash-title">UPI Fraud Shield</h1>
        <div className="splash-progress">
          <div className="splash-progress-bar" style={{ width: `${progress}%` }} />
        </div>
        <p className="splash-hint">{SPLASH_MESSAGES[msgIndex]}</p>
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [backendReady, setBackendReady] = useState(false);
  const [progress, setProgress] = useState(0);

  // Ping backend until it responds (handles Render cold start)
  useEffect(() => {
    let interval;
    let progressInterval;
    let attempts = 0;

    // Animate progress bar
    progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return 90; // Hold at 90 until backend responds
        return prev + 2;
      });
    }, 300);

    const pingBackend = async () => {
      try {
        await axios.get(`${API}/check-number/0000000000`, { timeout: 5000 });
        setBackendReady(true);
        setProgress(100);
        clearInterval(interval);
        clearInterval(progressInterval);
      } catch (err) {
        attempts++;
        if (attempts > 60) { // Give up after ~60 seconds
          setBackendReady(true); // Let user try anyway
          clearInterval(interval);
          clearInterval(progressInterval);
        }
      }
    };

    pingBackend();
    interval = setInterval(pingBackend, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(progressInterval);
    };
  }, []);

  // Check stored auth token
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (storedToken && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setToken(storedToken);
        setUser(parsedUser);
        if (backendReady) {
          axios.get(`${API}/me`, { headers: { Authorization: `Bearer ${storedToken}` } })
            .then(res => {
              setUser(res.data);
              localStorage.setItem('user', JSON.stringify(res.data));
            })
            .catch(() => {
              handleLogout();
            });
        }
      } catch {
        handleLogout();
      }
    }
    setAuthLoading(false);
  }, [backendReady]);

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

  // Show splash loader while backend is waking up
  if (!backendReady) {
    return <SplashLoader progress={progress} />;
  }

  if (authLoading) {
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
