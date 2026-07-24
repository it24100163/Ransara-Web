import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { ShoppingCart, Package, Bell, Settings, LogOut, User, MessageSquare, LayoutDashboard, Sparkles, Menu, X } from 'lucide-react';

import Home from './pages/Home';
import Cart from './pages/Cart';
import Orders from './pages/Orders';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminPanel from './pages/AdminPanel';
import Notifications from './pages/Notifications';
import ProductDetails from './pages/ProductDetails';
import CustomerDashboard from './pages/CustomerDashboard';
import Feedback from './pages/Feedback';
import Chat from './pages/Chat';
import DriverDashboard from './pages/DriverDashboard';
import { Page401, Page403, Page404 } from './pages/ErrorPages';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useNotifications } from './hooks/useNotifications';
import FloatingChat from './components/FloatingChat';
import api from './api';
import logo from './assets/Photoroom_20260724_002809.jpg';

// ── Protected Route ──────────────────────────────────────────────────────────
// Redirects unauthenticated users to /401. Optionally restricts by role → /403.
function ProtectedRoute({ children, requiredRole, blockedRole }) {
  const { isLoggedIn, userRole, authLoading } = useAuth();

  const normalizedRole = String(userRole || '')
    .trim()
    .toLowerCase();

  if (authLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '60vh',
        color: 'var(--text-muted)'
      }}>
        Verifying session…
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Navigate to="/401" replace />;
  }

  if (
    requiredRole &&
    normalizedRole !== requiredRole.toLowerCase()
  ) {
    return <Navigate to="/403" replace />;
  }

  if (
    blockedRole &&
    normalizedRole === blockedRole.toLowerCase()
  ) {
    return <Navigate to="/403" replace />;
  }

  return children;
}

// ── NavBar ───────────────────────────────────────────────────────────────────
function NavBar() {
  const { isLoggedIn, userRole, logout, userData } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  // ── Real-time notifications via WebSocket (falls back to REST polling) ──────
  const { unreadCount, clearCount } = useNotifications({ isLoggedIn, userRole });
  const location = useLocation();

  // Normalize the role because the backend may return admin as Admin/ADMIN.
  const normalizedRole = String(userRole || '').trim().toLowerCase();
  const isAdmin = normalizedRole === 'admin';
  const isDriver = normalizedRole === 'driver';

  // Clear badge when user navigates to /notifications
  useEffect(() => {
    if (location.pathname === '/notifications') clearCount();
  }, [location.pathname, clearCount]);

  const displayName = userData
    ? (userData.first_name || userData.email?.split('@')[0] || 'Account')
    : null;

  const linkStyle = {
  color: 'white',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: '600',
  display: 'flex',
  alignItems: 'center',
  gap: '5px',
  padding: '6px 2px',
  transition: 'all 0.2s',
};

  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      {/* Mobile backdrop overlay — closes menu when user taps outside */}
      {mobileOpen && (
        <div
          onClick={closeMobile}
          style={{
            position: 'fixed',
            inset: 0,
            top: '64px',
            backgroundColor: 'rgba(0, 0, 0, 0.35)',
            zIndex: 999,
          }}
        />
      )}

      <nav style={{
        backgroundColor: '#d71920',
        borderBottom: '1px solid #b91c1c',
        padding: '0 40px',
        height: '64px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}>
        <style>{`
          @media (max-width: 768px) {
            .nav-links { display: none !important; }
            .nav-links.mobile-open {
              display: flex !important;
              flex-direction: column;
              position: absolute;
              top: 64px; left: 0; right: 0;
              background: #d71920;
              padding: 20px;
              border-bottom: 1px solid #b91c1c;
              box-shadow: 0 4px 12px rgba(0,0,0,0.1);
              align-items: flex-start !important;
              z-index: 1000;
            }
            .hamburger { display: block !important; }
            nav { padding: 0 20px !important; }
          }
          .hamburger {
          display: none;
          background: none;
          border: none;
          cursor: pointer;
          color: white;
           }

.nav-links {
  display: flex;
  gap: 10px;
  align-items: center;
}

.nav-link-item {
  color: white !important;
}

.nav-link-item:hover {
  color: #ffe4e6 !important;
  transform: translateY(-1px);
}
        `}</style>

        <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }} onClick={closeMobile}>
          <img
  src={logo}
  alt="Ransara Supermarket Logo"
  style={{
    width: '42px',
    height: '42px',
    borderRadius: '8px',
    objectFit: 'contain',
    backgroundColor: 'white',
    padding: '3px'
  }}
/>
          <span
  style={{
    fontSize: '20px',
    fontWeight: '700',
    color: 'white'
  }}
>
  Ransara Supermarket
</span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {isLoggedIn && (
            <Link to="/notifications" style={{ position: 'relative', display: 'flex', alignItems: 'center', color: 'white' }}>
              <Bell size={20} />
              {unreadCount > 0 && (
                <span style={{ position: 'absolute', top: '-6px', right: '-6px', backgroundColor: 'var(--danger)', color: 'white', fontSize: '10px', fontWeight: 'bold', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
          )}

          <button className="hamburger" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle navigation menu">
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        <div className={`nav-links ${mobileOpen ? 'mobile-open' : ''}`} onClick={closeMobile}>
  {isLoggedIn ? (
    isAdmin ? (
      <>
        <Link to="/" style={linkStyle} className="nav-link-item">
          Home
        </Link>

        <Link
          to="/admin"
          style={{
            ...linkStyle,
            backgroundColor: 'white',
            color: '#d71920',
            padding: '6px 12px',
            borderRadius: '7px',
            fontWeight: '700'
          }}
        >
          <Settings size={15} />
          Admin Dashboard
        </Link>

        <button
          onClick={(e) => {
            e.preventDefault();
            logout();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            backgroundColor: 'white',
            color: '#d71920',
            border: 'none',
            borderRadius: '7px',
            padding: '6px 12px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '700'
          }}
        >
          <LogOut size={15} />
          Logout
        </button>
      </>
    ) : (
      <>
        <Link to="/" style={linkStyle} className="nav-link-item">
          Home
        </Link>

        <Link to="/cart" style={linkStyle} className="nav-link-item">
          <ShoppingCart size={16} />
          Cart
        </Link>

        <Link to="/orders" style={linkStyle} className="nav-link-item">
          <Package size={16} />
          Orders
        </Link>

        <Link to="/feedback" style={linkStyle} className="nav-link-item">
          <MessageSquare size={16} />
          Feedback
        </Link>

        <Link
          to="/dashboard"
          style={linkStyle}
          className="nav-link-item"
        >
          <User size={15} />
          {displayName || 'My Account'}
        </Link>

        <Link
          to="/chat"
          style={linkStyle}
          className="nav-link-item"
        >
          <Sparkles size={16} />
          AI Chat
        </Link>

        {isDriver && (
          <Link
            to="/driver"
            style={{
              ...linkStyle,
              backgroundColor: 'white',
              color: '#d71920',
              padding: '6px 12px',
              borderRadius: '7px',
              fontWeight: '700'
            }}
          >
            <LayoutDashboard size={15} />
            Driver Portal
          </Link>
        )}

        <button
          onClick={(e) => {
            e.preventDefault();
            logout();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            backgroundColor: 'white',
            color: '#d71920',
            border: 'none',
            borderRadius: '7px',
            padding: '6px 12px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '700'
          }}
        >
          <LogOut size={15} />
          Logout
        </button>
      </>
    )
  ) : (
    <>
      <Link to="/" style={linkStyle} className="nav-link-item">
        Home
      </Link>

      <Link to="/login" style={linkStyle} className="nav-link-item">
        Login
      </Link>

      <Link
        to="/register"
        style={{
          backgroundColor: 'white',
          color: '#d71920',
          textDecoration: 'none',
          padding: '6px 12px',
          borderRadius: '7px',
          fontSize: '14px',
          fontWeight: '700'
        }}
      >
        Register
      </Link>
    </>
  )}
</div>
      </nav>
    </>
  );
}

// ── Title Updater ────────────────────────────────────────────────────────────
function TitleUpdater() {
  const location = useLocation();

  useEffect(() => {
    const titleMap = {
      '/':              'Home | Ransara Supermarket',
      '/cart':          'Your Shopping Cart | Ransara',
      '/orders':        'My Orders | Ransara Supermarket',
      '/login':         'Login | Ransara Support',
      '/register':      'Create Account | Ransara',
      '/admin':         'Admin Control Panel | Ransara',
      '/notifications': 'Notifications | Ransara',
      '/feedback':      'Customer Feedback | Ransara',
      '/dashboard':     'Customer Dashboard | Ransara',
      '/driver':        'Driver Portal | Ransara Logistics',
      '/chat':          'AI Support Assistant | Ransara',
      '/401':           '401 — Authentication Required | Ransara',
      '/403':           '403 — Access Denied | Ransara',
      '/404':           '404 — Page Not Found | Ransara',
    };
    document.title = titleMap[location.pathname] || 'Ransara Supermarket';
  }, [location]);

  return null;
}

// ── App Shell ─────────────────────────────────────────────────────────────────
function AppShell() {
  const { isLoggedIn, isActive } = useAuth();

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-main)' }}>
      <NavBar />

      {isLoggedIn && !isActive && (
        <div style={{ backgroundColor: 'var(--danger)', color: 'white', padding: '12px 20px', textAlign: 'center', fontWeight: '500' }}>
          ⚠️ Your account has been suspended. Contact{' '}
          <a href="mailto:admin@ransara.com" style={{ color: 'white', textDecoration: 'underline', fontWeight: 'bold' }}>admin@ransara.com</a>
        </div>
      )}

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 30px' }}>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Home />} />
          <Route path="/product/:id" element={<ProductDetails />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Authenticated routes */}
          <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
          <Route
  path="/cart"
  element={
    <ProtectedRoute blockedRole="admin">
      <Cart />
    </ProtectedRoute>
  }
/>

<Route
  path="/orders"
  element={
    <ProtectedRoute blockedRole="admin">
      <Orders />
    </ProtectedRoute>
  }
/>

<Route
  path="/feedback"
  element={
    <ProtectedRoute blockedRole="admin">
      <Feedback />
    </ProtectedRoute>
  }
/>

<Route
  path="/dashboard"
  element={
    <ProtectedRoute blockedRole="admin">
      <CustomerDashboard />
    </ProtectedRoute>
  }
/>

<Route
  path="/chat"
  element={
    <ProtectedRoute blockedRole="admin">
      <Chat />
    </ProtectedRoute>
  }
/>

          {/* Role-restricted routes */}
          <Route path="/admin"  element={<ProtectedRoute requiredRole="admin"><AdminPanel /></ProtectedRoute>} />
          <Route path="/driver" element={<ProtectedRoute requiredRole="driver"><DriverDashboard /></ProtectedRoute>} />

          {/* Error pages */}
          <Route path="/401" element={<Page401 />} />
          <Route path="/403" element={<Page403 />} />
          <Route path="/404" element={<Page404 />} />

          {/* Catch-all → 404 */}
          <Route path="*" element={<Page404 />} />
        </Routes>
      </div>

      {/* Floating AI Chat — visible on all pages for logged-in users */}
      <FloatingChat />
    </div>
  );
}

// ── Root App ─────────────────────────────────────────────────────────────────
function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Router>
          <TitleUpdater />
          <AppShell />
        </Router>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;