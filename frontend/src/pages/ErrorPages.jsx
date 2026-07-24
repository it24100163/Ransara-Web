import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldOff, Home, ArrowLeft, LogIn } from 'lucide-react';

/* ─── Shared mini-components ─────────────────────────────────────────────── */

function ErrorShell({ accent, bg, children }) {
  return (
    <div style={{
      minHeight: '80vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      animation: 'errFadeIn 0.45s ease-out both',
    }}>
      <style>{`
        @keyframes errFadeIn {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes errFloat {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-10px); }
        }
        .err-btn-primary {
          display: inline-flex; align-items: center; gap: 8px;
          background: var(--color-primary); color: white;
          padding: 12px 24px; border-radius: 10px; border: none;
          font-size: 14px; font-weight: 600; cursor: pointer;
          text-decoration: none; transition: all 0.2s;
        }
        .err-btn-primary:hover { background: var(--color-primary-hover); transform: translateY(-1px); box-shadow: 0 6px 16px rgba(0,162,71,0.25); }
        .err-btn-ghost {
          display: inline-flex; align-items: center; gap: 8px;
          background: white; color: var(--text-main);
          padding: 12px 24px; border-radius: 10px;
          border: 1.5px solid var(--border-light);
          font-size: 14px; font-weight: 600; cursor: pointer;
          text-decoration: none; transition: all 0.2s;
        }
        .err-btn-ghost:hover { border-color: var(--color-primary); color: var(--color-primary); transform: translateY(-1px); }
      `}</style>

      <div style={{
        textAlign: 'center',
        maxWidth: '480px',
        width: '100%',
      }}>
        {/* Floating icon blob */}
        <div style={{
          width: '110px', height: '110px', borderRadius: '28px',
          background: bg,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: '32px',
          animation: 'errFloat 3.5s ease-in-out infinite',
          boxShadow: `0 12px 30px ${accent}28`,
        }}>
          <ShieldOff size={52} color={accent} strokeWidth={1.5} />
        </div>

        {children}
      </div>
    </div>
  );
}

/* ─── 401 — Unauthenticated ───────────────────────────────────────────────── */

export function Page401() {
  const navigate = useNavigate();
  return (
    <ErrorShell accent="#3b82f6" bg="#eff6ff">
      <p style={{ fontSize: '80px', fontWeight: '800', lineHeight: 1, color: '#3b82f6', letterSpacing: '-4px', marginBottom: '8px' }}>
        401
      </p>
      <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '10px' }}>
        Authentication Required
      </h1>
      <p style={{ fontSize: '15px', color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: '32px' }}>
        You need to be signed in to access this page. Please log in to continue.
      </p>
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link to="/login" className="err-btn-primary">
          <LogIn size={16} /> Sign In
        </Link>
        <button onClick={() => navigate(-1)} className="err-btn-ghost">
          <ArrowLeft size={16} /> Go Back
        </button>
      </div>
    </ErrorShell>
  );
}

/* ─── 403 — Forbidden ─────────────────────────────────────────────────────── */

export function Page403() {
  const navigate = useNavigate();
  return (
    <ErrorShell accent="#f59e0b" bg="#fffbeb">
      <p style={{ fontSize: '80px', fontWeight: '800', lineHeight: 1, color: '#f59e0b', letterSpacing: '-4px', marginBottom: '8px' }}>
        403
      </p>
      <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '10px' }}>
        Access Denied
      </h1>
      <p style={{ fontSize: '15px', color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: '32px' }}>
        You don't have permission to view this page. If you think this is a mistake, please contact support.
      </p>
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link to="/" className="err-btn-primary">
          <Home size={16} /> Back to Home
        </Link>
        <button onClick={() => navigate(-1)} className="err-btn-ghost">
          <ArrowLeft size={16} /> Go Back
        </button>
      </div>
    </ErrorShell>
  );
}

/* ─── 404 — Not Found ─────────────────────────────────────────────────────── */

export function Page404() {
  const navigate = useNavigate();
  return (
    <ErrorShell accent="#ef4444" bg="#fef2f2">
      <p style={{ fontSize: '80px', fontWeight: '800', lineHeight: 1, color: '#ef4444', letterSpacing: '-4px', marginBottom: '8px' }}>
        404
      </p>
      <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '10px' }}>
        Page Not Found
      </h1>
      <p style={{ fontSize: '15px', color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: '32px' }}>
        The page you're looking for doesn't exist or has been moved. Check the URL or head back home.
      </p>
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link to="/" className="err-btn-primary">
          <Home size={16} /> Back to Home
        </Link>
        <button onClick={() => navigate(-1)} className="err-btn-ghost">
          <ArrowLeft size={16} /> Go Back
        </button>
      </div>
    </ErrorShell>
  );
}
